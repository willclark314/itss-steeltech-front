import type { ServerResponse } from 'node:http'
import { computePaginatedWindow, parseListPageQuery } from '../list-window'
import { getDb } from '../db'
import type { ApiContext } from '../utils'
import { sendJson } from '../utils'

type ContactRow = {
  id: string
  title: string
  received_date: string
  urgency: string
  status: string
  content: string
  expect_reply_date: string
  created_at: string
}

type PdfRow = {
  id: string
  file_name: string
  file_path: string
}

function getProjectNosMap(contactFormIds: string[]) {
  const map = new Map<string, string[]>()
  if (!contactFormIds.length) return map

  const db = getDb()
  const placeholders = contactFormIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT contact_form_id, project_no
       FROM contact_form_projects
       WHERE contact_form_id IN (${placeholders})
       ORDER BY project_no`,
    )
    .all(...contactFormIds) as Array<{ contact_form_id: string; project_no: string }>

  for (const row of rows) {
    const list = map.get(row.contact_form_id) ?? []
    list.push(row.project_no)
    map.set(row.contact_form_id, list)
  }

  return map
}

function getAttachmentsMap(contactFormIds: string[]) {
  const map = new Map<string, Array<{ id: string; name: string; url: string }>>()
  if (!contactFormIds.length) return map

  const db = getDb()
  const placeholders = contactFormIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT contact_form_id, id, file_name, file_path
       FROM contact_form_pdfs
       WHERE contact_form_id IN (${placeholders})
       ORDER BY sort_order, created_at`,
    )
    .all(...contactFormIds) as Array<PdfRow & { contact_form_id: string }>

  for (const row of rows) {
    const list = map.get(row.contact_form_id) ?? []
    list.push({
      id: row.id,
      name: row.file_name,
      url: `/${row.file_path.replace(/\\/g, '/')}`,
    })
    map.set(row.contact_form_id, list)
  }

  return map
}

function mapContact(
  row: ContactRow,
  projectNosMap: Map<string, string[]>,
  attachmentsMap: Map<string, Array<{ id: string; name: string; url: string }>>,
) {
  return {
    id: row.id,
    title: row.title,
    projectNos: projectNosMap.get(row.id) ?? [],
    receivedDate: row.received_date,
    urgency: row.urgency,
    status: row.status,
    content: row.content,
    expectReplyDate: row.expect_reply_date,
    attachments: attachmentsMap.get(row.id) ?? [],
    createdAt: row.created_at,
  }
}

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
        SELECT cf.id, ROW_NUMBER() OVER (ORDER BY cf.created_at DESC, cf.id DESC) - 1 AS rank
        FROM contact_forms cf
        ${whereClause}
      )
      SELECT rank FROM ranked WHERE id = ?`,
    )
    .get(...params, contactId) as { rank: number } | undefined

  return row?.rank
}

export async function handleContactList(ctx: ApiContext, res: ServerResponse) {
  const db = getDb()
  const keyword = (ctx.query.get('keyword') || '').trim().toLowerCase()
  const status = ctx.query.get('status') || ''
  const pageQuery = parseListPageQuery(ctx)
  const { whereClause, params } = buildContactFilters(keyword, status)

  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM contact_forms cf
       ${whereClause}`,
    )
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
       ORDER BY cf.created_at DESC, cf.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, window.limit, window.offset) as ContactRow[]

  const contactIds = rows.map((row) => row.id)
  const projectNosMap = getProjectNosMap(contactIds)
  const attachmentsMap = getAttachmentsMap(contactIds)
  const list = rows.map((row) => mapContact(row, projectNosMap, attachmentsMap))

  sendJson(res, 200, {
    list,
    total,
    page: window.page,
    pageSize: pageQuery.pageSize,
    totalPages: window.totalPages,
  })
  return true
}
