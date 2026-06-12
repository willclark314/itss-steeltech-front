import type { ServerResponse } from 'node:http'
import { computePaginatedWindow, parseListPageQuery } from '../list-window'
import {
  appendSupplementAttachments,
  CONTACT_LIST_ORDER,
  createChildContact,
  createContact,
  deleteContact,
  getChildCountMap,
  getContactById,
  getPdfsMap,
  getProjectLinksMap,
  mapContactView,
  updateContact,
  type ContactRow,
  type PdfUploadInput,
} from '../contact-store'
import { getDb } from '../db'
import type { ApiContext } from '../utils'
import { matchRoute, sendError, sendJson } from '../utils'

function buildContactFilters(keyword: string, status: string) {
  const conditions: string[] = []
  const params: unknown[] = []

  if (status) {
    conditions.push('cf.status = ?')
    params.push(status)
  }

  if (keyword) {
    conditions.push(`(
      LOWER(cf.id) LIKE ?
      OR LOWER(cf.title) LIKE ?
      OR LOWER(cf.received_date) LIKE ?
      OR EXISTS (
        SELECT 1
        FROM contact_form_projects cfp
        WHERE cfp.contact_form_id = cf.id AND LOWER(cfp.project_no) LIKE ?
      )
    )`)
    const likeKeyword = `%${keyword}%`
    params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return { whereClause, params }
}

function getContactRank(whereClause: string, params: unknown[], contactId: string) {
  const db = getDb()
  const row = db
    .prepare(
      `WITH ranked AS (
        SELECT cf.id, ROW_NUMBER() OVER (ORDER BY ${CONTACT_LIST_ORDER}) - 1 AS rank
        FROM contact_forms cf
        ${whereClause}
      )
      SELECT rank FROM ranked WHERE id = ?`,
    )
    .get(...params, contactId) as { rank: number } | undefined

  return row?.rank
}

function mapListRows(rows: ContactRow[]) {
  const db = getDb()
  const contactIds = rows.map((row) => row.id)
  const rootIds = [...new Set(rows.map((row) => row.root_id))]
  const projectLinksMap = getProjectLinksMap(db, contactIds)
  const { primaryMap, supplementMap } = getPdfsMap(db, contactIds)
  const childCountMap = getChildCountMap(db, rootIds)
  return rows.map((row) =>
    mapContactView(row, projectLinksMap, primaryMap, supplementMap, childCountMap),
  )
}

function readPdfFiles(body: Record<string, unknown>, field: string): PdfUploadInput[] {
  const raw = body[field]
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is { fileName: string; content: string } => {
      return !!item && typeof item === 'object' && 'fileName' in item && 'content' in item
    })
    .map((item) => ({ fileName: String(item.fileName), content: String(item.content) }))
}

export async function handleContactList(ctx: ApiContext, res: ServerResponse) {
  const db = getDb()
  const keyword = (ctx.query.get('keyword') || '').trim().toLowerCase()
  const status = ctx.query.get('status') || ''
  const pageQuery = parseListPageQuery(ctx)
  const { whereClause, params } = buildContactFilters(keyword, status)

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM contact_forms cf ${whereClause}`)
    .get(...params) as { total: number }

  const total = countRow.total
  let anchorIndex: number | undefined

  if (pageQuery.anchor) {
    anchorIndex = getContactRank(whereClause, params, pageQuery.anchor)
  }

  const window = computePaginatedWindow({
    total,
    pageSize: pageQuery.pageSize,
    page: pageQuery.anchor ? undefined : pageQuery.page,
    anchorIndex,
  })

  const rows = db
    .prepare(
      `SELECT cf.*
       FROM contact_forms cf
       ${whereClause}
       ORDER BY ${CONTACT_LIST_ORDER}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, window.limit, window.offset) as ContactRow[]

  sendJson(res, 200, {
    list: mapListRows(rows),
    total,
    page: window.page,
    pageSize: pageQuery.pageSize,
    totalPages: window.totalPages,
  })
  return true
}

export async function handleContactCreate(ctx: ApiContext, res: ServerResponse) {
  const body = (ctx.body || {}) as Record<string, unknown>
  const title = String(body.title || '').trim()
  const receivedDate = String(body.receivedDate || '').trim()

  if (!title || !receivedDate) {
    sendError(res, 400, '联系主题和收单日期不能为空')
    return true
  }

  const db = getDb()
  const created = createContact(db, {
    title,
    receivedDate,
    urgency: String(body.urgency || '普通'),
    content: String(body.content || ''),
    expectReplyDate: String(body.expectReplyDate || ''),
    projectNos: Array.isArray(body.projectNos) ? body.projectNos.map(String) : [],
    primaryPdf: body.primaryPdf as PdfUploadInput | undefined,
    supplementFiles: readPdfFiles(body, 'supplementFiles'),
  })

  sendJson(res, 201, created)
  return true
}

export async function handleContactUpdate(ctx: ApiContext, res: ServerResponse) {
  const params = matchRoute(ctx.pathname, 'contacts/:id')
  if (!params?.id) {
    sendError(res, 404, '未找到联系单')
    return true
  }

  const body = (ctx.body || {}) as Record<string, unknown>
  const db = getDb()
  const updated = updateContact(db, params.id, {
    title: body.title !== undefined ? String(body.title) : undefined,
    receivedDate: body.receivedDate !== undefined ? String(body.receivedDate) : undefined,
    urgency: body.urgency !== undefined ? String(body.urgency) : undefined,
    content: body.content !== undefined ? String(body.content) : undefined,
    expectReplyDate: body.expectReplyDate !== undefined ? String(body.expectReplyDate) : undefined,
    status: body.status !== undefined ? String(body.status) : undefined,
    projectNos: Array.isArray(body.projectNos) ? body.projectNos.map(String) : undefined,
  })

  if (!updated) {
    sendError(res, 404, '联系单不存在')
    return true
  }

  sendJson(res, 200, updated)
  return true
}

export async function handleContactDelete(ctx: ApiContext, res: ServerResponse) {
  const params = matchRoute(ctx.pathname, 'contacts/:id')
  if (!params?.id) {
    sendError(res, 404, '未找到联系单')
    return true
  }

  const deleted = deleteContact(getDb(), params.id)
  if (!deleted) {
    sendError(res, 404, '联系单不存在')
    return true
  }

  sendJson(res, 200, { ok: true })
  return true
}

export async function handleContactAppendAttachments(ctx: ApiContext, res: ServerResponse) {
  const params = matchRoute(ctx.pathname, 'contacts/:id/attachments')
  if (!params?.id) {
    sendError(res, 404, '未找到联系单')
    return true
  }

  const body = (ctx.body || {}) as Record<string, unknown>
  const files = readPdfFiles(body, 'files')
  if (!files.length) {
    sendError(res, 400, '请提供 PDF 附件')
    return true
  }

  const updated = appendSupplementAttachments(getDb(), params.id, files)
  if (!updated) {
    sendError(res, 404, '联系单不存在')
    return true
  }

  sendJson(res, 200, updated)
  return true
}

export async function handleContactCreateChild(ctx: ApiContext, res: ServerResponse) {
  const params = matchRoute(ctx.pathname, 'contacts/:parentId/children')
  if (!params?.parentId) {
    sendError(res, 404, '未找到父联系单')
    return true
  }

  const body = (ctx.body || {}) as Record<string, unknown>
  const title = String(body.title || '').trim()
  const receivedDate = String(body.receivedDate || '').trim()
  const relationType = String(body.relationType || 'supplement') as
    | 'supplement'
    | 'revision'
    | 'follow_up'
    | 'cancel'

  if (!title || !receivedDate) {
    sendError(res, 400, '联系主题和收单日期不能为空')
    return true
  }

  const created = createChildContact(getDb(), params.parentId, {
    title,
    receivedDate,
    urgency: String(body.urgency || '普通'),
    content: String(body.content || ''),
    relationType,
    projectMode: (body.projectMode as 'inherit' | 'split' | 'append') || 'inherit',
    projectNos: Array.isArray(body.projectNos) ? body.projectNos.map(String) : [],
    cancelScope: body.cancelScope as 'full' | 'partial' | undefined,
    cancelledProjectNos: Array.isArray(body.cancelledProjectNos)
      ? body.cancelledProjectNos.map(String)
      : [],
    primaryPdf: body.primaryPdf as PdfUploadInput | undefined,
    supplementFiles: readPdfFiles(body, 'supplementFiles'),
  })

  if (!created) {
    sendError(res, 404, '父联系单不存在')
    return true
  }

  sendJson(res, 201, created)
  return true
}

export async function handleContactGet(ctx: ApiContext, res: ServerResponse) {
  const params = matchRoute(ctx.pathname, 'contacts/:id')
  if (!params?.id) {
    sendError(res, 404, '未找到联系单')
    return true
  }

  const contact = getContactById(getDb(), params.id)
  if (!contact) {
    sendError(res, 404, '联系单不存在')
    return true
  }

  sendJson(res, 200, contact)
  return true
}
