import fs from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { ContactFormPdf } from '../src/models/db/ContactFormPdf.ts'
import { CONTACT_PDF_ROOT } from './paths.ts'

export type ContactRelationType = 'primary' | 'supplement' | 'revision' | 'follow_up' | 'cancel'
export type ProjectSourceType = 'own' | 'inherited' | 'added' | 'cancelled'
export type AttachmentType = 'primary' | 'supplement'
export type ProjectMode = 'inherit' | 'split' | 'append'
export type CancelScope = 'full' | 'partial'

export type ContactRow = {
  id: string
  title: string
  received_date: string
  urgency: string
  status: string
  content: string
  expect_reply_date: string
  parent_id: string | null
  root_id: string
  relation_type: ContactRelationType
  sort_order: number
  cancel_scope: CancelScope | null
  created_at: string
  updated_at?: string
}

export type ProjectLinkRow = {
  contact_form_id: string
  project_no: string
  source_type: ProjectSourceType
  source_contact_form_id: string | null
}

export type PdfRow = {
  id: string
  contact_form_id: string
  file_name: string
  file_path: string
  attachment_type: AttachmentType
  sort_order: number
}

export type PdfUploadInput = {
  fileName: string
  content: string
}

export type ProjectLinkView = {
  projectNo: string
  sourceType: ProjectSourceType
  sourceContactFormId?: string
}

export type ContactView = {
  id: string
  title: string
  projectNos: string[]
  projectLinks: ProjectLinkView[]
  receivedDate: string
  urgency: string
  status: string
  content: string
  expectReplyDate: string
  parentId?: string
  rootId: string
  relationType: ContactRelationType
  sortOrder: number
  childCount: number
  cancelScope?: CancelScope
  primaryPdf?: { id: string; name: string; url: string }
  attachments: Array<{ id: string; name: string; url: string }>
  createdAt: string
}

export const CONTACT_LIST_ORDER = `COALESCE(cf.root_id, cf.id) DESC, cf.sort_order ASC, cf.id ASC`

function nowLocal() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function generateContactId(db: Database.Database) {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const prefix = `DTP${yy}${mm}${dd}`
  const countRow = db
    .prepare(`SELECT COUNT(*) AS count FROM contact_forms WHERE id LIKE ?`)
    .get(`${prefix}%`) as { count: number }
  return `${prefix}${String(countRow.count + 1)}`
}

function generatePdfId() {
  return `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function generateCancellationId() {
  return `canc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function savePdfFile(contactFormId: string, fileName: string, base64Content: string) {
  const safeName = path.basename(fileName).replace(/[^\w.\-()\u4e00-\u9fff]/g, '_') || 'file.pdf'
  const dir = path.join(CONTACT_PDF_ROOT, contactFormId)
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, safeName)
  fs.writeFileSync(filePath, Buffer.from(base64Content, 'base64'))
  const relativePath = ContactFormPdf.buildFilePath(contactFormId, safeName)
  return { fileName: safeName, filePath: relativePath, fileSize: fs.statSync(filePath).size }
}

export function getProjectLinksMap(db: Database.Database, contactFormIds: string[]) {
  const map = new Map<string, ProjectLinkView[]>()
  if (!contactFormIds.length) return map

  const placeholders = contactFormIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT contact_form_id, project_no, source_type, source_contact_form_id
       FROM contact_form_projects
       WHERE contact_form_id IN (${placeholders})
       ORDER BY project_no`,
    )
    .all(...contactFormIds) as ProjectLinkRow[]

  for (const row of rows) {
    const list = map.get(row.contact_form_id) ?? []
    list.push({
      projectNo: row.project_no,
      sourceType: row.source_type,
      sourceContactFormId: row.source_contact_form_id || undefined,
    })
    map.set(row.contact_form_id, list)
  }

  return map
}

export function getPdfsMap(db: Database.Database, contactFormIds: string[]) {
  const primaryMap = new Map<string, { id: string; name: string; url: string }>()
  const supplementMap = new Map<string, Array<{ id: string; name: string; url: string }>>()
  if (!contactFormIds.length) return { primaryMap, supplementMap }

  const placeholders = contactFormIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT contact_form_id, id, file_name, file_path, attachment_type
       FROM contact_form_pdfs
       WHERE contact_form_id IN (${placeholders})
       ORDER BY sort_order, created_at`,
    )
    .all(...contactFormIds) as PdfRow[]

  for (const row of rows) {
    const item = {
      id: row.id,
      name: row.file_name,
      url: `/${row.file_path.replace(/\\/g, '/')}`,
    }
    if (row.attachment_type === 'primary') {
      primaryMap.set(row.contact_form_id, item)
      continue
    }
    const list = supplementMap.get(row.contact_form_id) ?? []
    list.push(item)
    supplementMap.set(row.contact_form_id, list)
  }

  return { primaryMap, supplementMap }
}

export function getChildCountMap(db: Database.Database, rootIds: string[]) {
  const map = new Map<string, number>()
  if (!rootIds.length) return map

  const placeholders = rootIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT root_id, COUNT(*) AS total
       FROM contact_forms
       WHERE root_id IN (${placeholders})
       GROUP BY root_id`,
    )
    .all(...rootIds) as Array<{ root_id: string; total: number }>

  for (const row of rows) {
    map.set(row.root_id, Math.max(0, row.total - 1))
  }

  return map
}

export function mapContactView(
  row: ContactRow,
  projectLinksMap: Map<string, ProjectLinkView[]>,
  primaryMap: Map<string, { id: string; name: string; url: string }>,
  supplementMap: Map<string, Array<{ id: string; name: string; url: string }>>,
  childCountMap: Map<string, number>,
): ContactView {
  const projectLinks = projectLinksMap.get(row.id) ?? []
  return {
    id: row.id,
    title: row.title,
    projectNos: projectLinks.map((item) => item.projectNo),
    projectLinks,
    receivedDate: row.received_date,
    urgency: row.urgency,
    status: row.status,
    content: row.content || '',
    expectReplyDate: row.expect_reply_date || '',
    parentId: row.parent_id || undefined,
    rootId: row.root_id,
    relationType: row.relation_type,
    sortOrder: row.sort_order,
    childCount: childCountMap.get(row.root_id) ?? 0,
    cancelScope: row.cancel_scope || undefined,
    primaryPdf: primaryMap.get(row.id),
    attachments: supplementMap.get(row.id) ?? [],
    createdAt: row.created_at,
  }
}

export function getContactById(db: Database.Database, contactId: string) {
  const row = db.prepare('SELECT * FROM contact_forms WHERE id = ?').get(contactId) as ContactRow | undefined
  if (!row) return null

  const projectLinksMap = getProjectLinksMap(db, [contactId])
  const { primaryMap, supplementMap } = getPdfsMap(db, [contactId])
  const childCountMap = getChildCountMap(db, [row.root_id])
  return mapContactView(row, projectLinksMap, primaryMap, supplementMap, childCountMap)
}

function insertProjectLinks(
  db: Database.Database,
  contactFormId: string,
  links: ProjectLinkView[],
) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO contact_form_projects (
      contact_form_id, project_no, source_type, source_contact_form_id
    ) VALUES (?, ?, ?, ?)`,
  )
  for (const link of links) {
    insert.run(contactFormId, link.projectNo, link.sourceType, link.sourceContactFormId ?? null)
  }
}

function insertPdfRecords(
  db: Database.Database,
  contactFormId: string,
  primaryPdf?: PdfUploadInput,
  supplementFiles: PdfUploadInput[] = [],
  createdAt = nowLocal(),
) {
  const insert = db.prepare(
    `INSERT INTO contact_form_pdfs (
      id, contact_form_id, file_name, file_path, file_size, mime_type,
      attachment_type, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  if (primaryPdf?.content) {
    const saved = savePdfFile(contactFormId, primaryPdf.fileName, primaryPdf.content)
    insert.run(
      generatePdfId(),
      contactFormId,
      saved.fileName,
      saved.filePath,
      saved.fileSize,
      ContactFormPdf.MIME_TYPE,
      'primary',
      0,
      createdAt,
    )
  }

  supplementFiles.forEach((file, index) => {
    if (!file.content) return
    const saved = savePdfFile(contactFormId, file.fileName, file.content)
    insert.run(
      generatePdfId(),
      contactFormId,
      saved.fileName,
      saved.filePath,
      saved.fileSize,
      ContactFormPdf.MIME_TYPE,
      'supplement',
      index + 1,
      createdAt,
    )
  })
}

function getParentProjectLinks(db: Database.Database, parentId: string) {
  const rows = db
    .prepare(
      `SELECT project_no, source_type, source_contact_form_id
       FROM contact_form_projects
       WHERE contact_form_id = ?
       ORDER BY project_no`,
    )
    .all(parentId) as Array<{
    project_no: string
    source_type: ProjectSourceType
    source_contact_form_id: string | null
  }>

  return rows.map((row) => ({
    projectNo: row.project_no,
    sourceType: row.source_type === 'cancelled' ? 'cancelled' as const : 'inherited' as const,
    sourceContactFormId: parentId,
  }))
}

export function buildChildProjectLinks(
  parentLinks: ProjectLinkView[],
  projectMode: ProjectMode,
  projectNos: string[] = [],
  relationType: ContactRelationType,
  cancelledProjectNos: string[] = [],
): ProjectLinkView[] {
  if (relationType === 'cancel') {
    return cancelledProjectNos.map((projectNo) => ({
      projectNo,
      sourceType: 'cancelled',
    }))
  }

  const parentActive = parentLinks.filter((item) => item.sourceType !== 'cancelled')

  if (projectMode === 'inherit') {
    return parentActive.map((item) => ({
      projectNo: item.projectNo,
      sourceType: 'inherited',
      sourceContactFormId: item.sourceContactFormId,
    }))
  }

  if (projectMode === 'split') {
    const selected = new Set(projectNos)
    return parentActive
      .filter((item) => selected.has(item.projectNo))
      .map((item) => ({
        projectNo: item.projectNo,
        sourceType: 'inherited',
        sourceContactFormId: item.sourceContactFormId,
      }))
  }

  const added = new Set(projectNos)
  const inherited = parentActive.map((item) => ({
    projectNo: item.projectNo,
    sourceType: 'inherited' as const,
    sourceContactFormId: item.sourceContactFormId,
  }))
  const appended = [...added]
    .filter((projectNo) => !parentActive.some((item) => item.projectNo === projectNo))
    .map((projectNo) => ({
      projectNo,
      sourceType: 'added' as const,
    }))
  return [...inherited, ...appended]
}

function applyCancelEffects(
  db: Database.Database,
  cancelContactId: string,
  targetContactId: string,
  cancelScope: CancelScope,
  cancelledProjectNos: string[],
) {
  const target = db.prepare('SELECT * FROM contact_forms WHERE id = ?').get(targetContactId) as ContactRow
  if (!target) return

  const rootId = target.root_id
  const cancelledAt = nowLocal()
  const insertAudit = db.prepare(
    `INSERT INTO contact_form_project_cancellations (
      id, cancel_contact_id, target_contact_id, project_no, cancelled_at
    ) VALUES (?, ?, ?, ?, ?)`,
  )
  const deleteProjectLink = db.prepare(
    `DELETE FROM contact_form_projects WHERE contact_form_id = ? AND project_no = ?`,
  )
  const updateStatus = db.prepare(
    `UPDATE contact_forms SET status = 'cancelled', updated_at = ? WHERE id = ?`,
  )

  if (cancelScope === 'full') {
    const groupRows = db
      .prepare(`SELECT id FROM contact_forms WHERE root_id = ?`)
      .all(rootId) as Array<{ id: string }>
    for (const row of groupRows) {
      if (row.id === cancelContactId) continue
      updateStatus.run(cancelledAt, row.id)
    }
    return
  }

  for (const projectNo of cancelledProjectNos) {
    insertAudit.run(generateCancellationId(), cancelContactId, targetContactId, projectNo, cancelledAt)
    const linkedContacts = db
      .prepare(`SELECT contact_form_id FROM contact_form_projects WHERE project_no = ?`)
      .all(projectNo) as Array<{ contact_form_id: string }>
    for (const linked of linkedContacts) {
      const contact = db
        .prepare('SELECT root_id FROM contact_forms WHERE id = ?')
        .get(linked.contact_form_id) as { root_id: string } | undefined
      if (contact?.root_id === rootId) {
        deleteProjectLink.run(linked.contact_form_id, projectNo)
      }
    }
  }

  const remaining = db
    .prepare(`SELECT COUNT(*) AS count FROM contact_form_projects WHERE contact_form_id = ?`)
    .get(targetContactId) as { count: number }
  if (remaining.count === 0) {
    updateStatus.run(cancelledAt, targetContactId)
  }
}

export type CreateContactInput = {
  title: string
  receivedDate: string
  urgency?: string
  content?: string
  expectReplyDate?: string
  projectNos?: string[]
  primaryPdf?: PdfUploadInput
  supplementFiles?: PdfUploadInput[]
}

export function createContact(db: Database.Database, input: CreateContactInput) {
  const id = generateContactId(db)
  const createdAt = nowLocal()
  const insert = db.prepare(
    `INSERT INTO contact_forms (
      id, title, received_date, urgency, status, content, expect_reply_date,
      parent_id, root_id, relation_type, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, NULL, ?, 'primary', 0, ?, ?)`,
  )
  insert.run(
    id,
    input.title,
    input.receivedDate,
    input.urgency || '普通',
    input.content || '',
    input.expectReplyDate || '',
    id,
    createdAt,
    createdAt,
  )

  const projectLinks = (input.projectNos || []).map((projectNo) => ({
    projectNo,
    sourceType: 'own' as const,
  }))
  insertProjectLinks(db, id, projectLinks)
  insertPdfRecords(db, id, input.primaryPdf, input.supplementFiles || [], createdAt)

  return getContactById(db, id)!
}

export type UpdateContactInput = {
  title?: string
  receivedDate?: string
  urgency?: string
  content?: string
  expectReplyDate?: string
  status?: string
  projectNos?: string[]
}

export function updateContact(db: Database.Database, contactId: string, input: UpdateContactInput) {
  const existing = db.prepare('SELECT id FROM contact_forms WHERE id = ?').get(contactId)
  if (!existing) return null

  const fields: string[] = []
  const values: unknown[] = []

  if (input.title !== undefined) {
    fields.push('title = ?')
    values.push(input.title)
  }
  if (input.receivedDate !== undefined) {
    fields.push('received_date = ?')
    values.push(input.receivedDate)
  }
  if (input.urgency !== undefined) {
    fields.push('urgency = ?')
    values.push(input.urgency)
  }
  if (input.content !== undefined) {
    fields.push('content = ?')
    values.push(input.content)
  }
  if (input.expectReplyDate !== undefined) {
    fields.push('expect_reply_date = ?')
    values.push(input.expectReplyDate)
  }
  if (input.status !== undefined) {
    fields.push('status = ?')
    values.push(input.status)
  }

  if (fields.length) {
    fields.push('updated_at = ?')
    values.push(nowLocal())
    values.push(contactId)
    db.prepare(`UPDATE contact_forms SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  if (input.projectNos) {
    db.prepare('DELETE FROM contact_form_projects WHERE contact_form_id = ?').run(contactId)
    insertProjectLinks(
      db,
      contactId,
      input.projectNos.map((projectNo) => ({ projectNo, sourceType: 'own' })),
    )
  }

  return getContactById(db, contactId)
}

export function appendSupplementAttachments(
  db: Database.Database,
  contactId: string,
  files: PdfUploadInput[],
) {
  const existing = db.prepare('SELECT id FROM contact_forms WHERE id = ?').get(contactId)
  if (!existing) return null

  const maxSort = db
    .prepare(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_sort
       FROM contact_form_pdfs
       WHERE contact_form_id = ? AND attachment_type = 'supplement'`,
    )
    .get(contactId) as { max_sort: number }

  const insert = db.prepare(
    `INSERT INTO contact_form_pdfs (
      id, contact_form_id, file_name, file_path, file_size, mime_type,
      attachment_type, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'supplement', ?, ?)`,
  )
  const createdAt = nowLocal()

  files.forEach((file, index) => {
    if (!file.content) return
    const saved = savePdfFile(contactId, file.fileName, file.content)
    insert.run(
      generatePdfId(),
      contactId,
      saved.fileName,
      saved.filePath,
      saved.fileSize,
      ContactFormPdf.MIME_TYPE,
      maxSort.max_sort + index + 1,
      createdAt,
    )
  })

  return getContactById(db, contactId)
}

export type CreateChildContactInput = {
  title: string
  receivedDate: string
  urgency?: string
  content?: string
  relationType: ContactRelationType
  projectMode?: ProjectMode
  projectNos?: string[]
  cancelScope?: CancelScope
  cancelledProjectNos?: string[]
  primaryPdf?: PdfUploadInput
  supplementFiles?: PdfUploadInput[]
}

export function createChildContact(
  db: Database.Database,
  parentId: string,
  input: CreateChildContactInput,
) {
  const parent = db.prepare('SELECT * FROM contact_forms WHERE id = ?').get(parentId) as ContactRow | undefined
  if (!parent) return null

  const maxSort = db
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM contact_forms WHERE root_id = ?`)
    .get(parent.root_id) as { max_sort: number }

  const id = generateContactId(db)
  const createdAt = nowLocal()
  const status = input.relationType === 'cancel' ? 'done' : 'pending'

  db.prepare(
    `INSERT INTO contact_forms (
      id, title, received_date, urgency, status, content, expect_reply_date,
      parent_id, root_id, relation_type, sort_order, cancel_scope, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.title,
    input.receivedDate,
    input.urgency || parent.urgency || '普通',
    status,
    input.content || '',
    parentId,
    parent.root_id,
    input.relationType,
    maxSort.max_sort + 1,
    input.relationType === 'cancel' ? input.cancelScope || 'partial' : null,
    createdAt,
    createdAt,
  )

  const parentLinks = getParentProjectLinks(db, parentId)
  const projectLinks = buildChildProjectLinks(
    parentLinks,
    input.projectMode || 'inherit',
    input.projectNos || [],
    input.relationType,
    input.cancelledProjectNos || [],
  )
  insertProjectLinks(db, id, projectLinks)
  insertPdfRecords(db, id, input.primaryPdf, input.supplementFiles || [], createdAt)

  if (input.relationType === 'cancel') {
    applyCancelEffects(
      db,
      id,
      parent.root_id,
      input.cancelScope || 'partial',
      input.cancelledProjectNos || projectLinks.map((item) => item.projectNo),
    )
  }

  return getContactById(db, id)
}

export function deleteContact(db: Database.Database, contactId: string) {
  const row = db.prepare('SELECT id FROM contact_forms WHERE id = ?').get(contactId)
  if (!row) return false
  db.prepare('DELETE FROM contact_forms WHERE id = ?').run(contactId)
  const dir = path.join(CONTACT_PDF_ROOT, contactId)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  return true
}
