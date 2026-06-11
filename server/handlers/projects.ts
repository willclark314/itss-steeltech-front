import type { ServerResponse } from 'node:http'
import { BusinessSystemConfig } from '../../src/models/biz/BusinessSystemConfig.ts'
import { computePaginatedWindow, parseListPageQuery } from '../list-window'
import { getDb } from '../db'
import type { ApiContext } from '../utils'
import { matchRoute, sendError, sendJson } from '../utils'

type ProjectRow = {
  project_no: string
  name: string
  customer: string
  status: string
  received_date?: string | null
  planned_start_date?: string | null
  planned_end_date?: string | null
  actual_start_date?: string | null
  actual_end_date?: string | null
  local_work_path?: string | null
  start_date?: string | null
  end_date?: string | null
}

type ProjectAssigneeRow = {
  id: string
  name: string
  team: string
}

const VALID_NATURES = new Set(['design', 'detail'])

type ProjectWritePayload = {
  projectNo?: string
  name?: string
  customer?: string
  status?: string
  natures?: string[]
  assignedPersonnelIds?: string[]
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
  localWorkPath?: string
  contactFormId?: string
}

function getContactFormIds(projectNo: string) {
  const db = getDb()
  const rows = db
    .prepare(
      'SELECT contact_form_id FROM contact_form_projects WHERE project_no = ? ORDER BY contact_form_id',
    )
    .all(projectNo) as Array<{ contact_form_id: string }>

  return rows.map((row) => row.contact_form_id)
}

function getProjectNatures(projectNo: string) {
  const db = getDb()
  const rows = db
    .prepare('SELECT nature FROM project_natures WHERE project_no = ? ORDER BY nature')
    .all(projectNo) as Array<{ nature: string }>

  return rows.map((row) => row.nature).filter((nature) => VALID_NATURES.has(nature))
}

function getReceivedDateFromContacts(projectNo: string) {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT MIN(cf.received_date) AS received_date
       FROM contact_form_projects cfp
       INNER JOIN contact_forms cf ON cf.id = cfp.contact_form_id
       WHERE cfp.project_no = ?`,
    )
    .get(projectNo) as { received_date: string | null } | undefined

  return row?.received_date?.trim() || ''
}

function getContactReceivedDate(contactFormId: string) {
  const db = getDb()
  const row = db
    .prepare('SELECT received_date FROM contact_forms WHERE id = ?')
    .get(contactFormId) as { received_date: string } | undefined

  return row?.received_date?.trim() || ''
}

function resolveReceivedDate(row: ProjectRow) {
  const stored = row.received_date?.trim() || ''
  if (stored) return stored

  const fromContacts = getReceivedDateFromContacts(row.project_no)
  if (fromContacts) return fromContacts

  return row.planned_start_date?.trim() || row.start_date?.trim() || ''
}

function getAssignedPersonnel(projectNo: string) {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.team
       FROM project_personnel pp
       INNER JOIN personnel p ON p.id = pp.personnel_id
       WHERE pp.project_no = ?
       ORDER BY p.team, p.name`,
    )
    .all(projectNo) as ProjectAssigneeRow[]

  return rows
}

function mapProjectDates(row: ProjectRow) {
  return {
    plannedStartDate: row.planned_start_date?.trim() || row.start_date?.trim() || '',
    plannedEndDate: row.planned_end_date?.trim() || row.end_date?.trim() || '',
    actualStartDate: row.actual_start_date?.trim() || '',
    actualEndDate: row.actual_end_date?.trim() || '',
  }
}

function mapProject(row: ProjectRow) {
  const assignedPersonnel = getAssignedPersonnel(row.project_no)

  return {
    projectNo: row.project_no,
    name: row.name,
    customer: row.customer,
    status: row.status,
    natures: getProjectNatures(row.project_no),
    assignedPersonnelIds: assignedPersonnel.map((item) => item.id),
    assignedPersonnel,
    receivedDate: resolveReceivedDate(row),
    ...mapProjectDates(row),
    localWorkPath: normalizeLocalWorkPath(row.local_work_path ?? ''),
    contactFormIds: getContactFormIds(row.project_no),
  }
}

function getProjectNaturesMap(projectNos: string[]) {
  const map = new Map<string, string[]>()
  if (!projectNos.length) return map

  const db = getDb()
  const placeholders = projectNos.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT project_no, nature FROM project_natures
       WHERE project_no IN (${placeholders})
       ORDER BY nature`,
    )
    .all(...projectNos) as Array<{ project_no: string; nature: string }>

  for (const row of rows) {
    if (!VALID_NATURES.has(row.nature)) continue
    const list = map.get(row.project_no) ?? []
    list.push(row.nature)
    map.set(row.project_no, list)
  }

  return map
}

function getAssignedPersonnelMap(projectNos: string[]) {
  const map = new Map<string, ProjectAssigneeRow[]>()
  if (!projectNos.length) return map

  const db = getDb()
  const placeholders = projectNos.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT pp.project_no, p.id, p.name, p.team
       FROM project_personnel pp
       INNER JOIN personnel p ON p.id = pp.personnel_id
       WHERE pp.project_no IN (${placeholders})
       ORDER BY pp.project_no, p.team, p.name`,
    )
    .all(...projectNos) as Array<ProjectAssigneeRow & { project_no: string }>

  for (const row of rows) {
    const list = map.get(row.project_no) ?? []
    list.push({ id: row.id, name: row.name, team: row.team })
    map.set(row.project_no, list)
  }

  return map
}

function getContactFormIdsMap(projectNos: string[]) {
  const map = new Map<string, string[]>()
  if (!projectNos.length) return map

  const db = getDb()
  const placeholders = projectNos.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT project_no, contact_form_id
       FROM contact_form_projects
       WHERE project_no IN (${placeholders})
       ORDER BY contact_form_id`,
    )
    .all(...projectNos) as Array<{ project_no: string; contact_form_id: string }>

  for (const row of rows) {
    const list = map.get(row.project_no) ?? []
    list.push(row.contact_form_id)
    map.set(row.project_no, list)
  }

  return map
}

function mapProjectsBatch(rows: ProjectRow[]) {
  const projectNos = rows.map((row) => row.project_no)
  const naturesMap = getProjectNaturesMap(projectNos)
  const personnelMap = getAssignedPersonnelMap(projectNos)
  const contactFormIdsMap = getContactFormIdsMap(projectNos)

  return rows.map((row) => {
    const assignedPersonnel = personnelMap.get(row.project_no) ?? []
    return {
      projectNo: row.project_no,
      name: row.name,
      customer: row.customer,
      status: row.status,
      natures: naturesMap.get(row.project_no) ?? [],
      assignedPersonnelIds: assignedPersonnel.map((item) => item.id),
      assignedPersonnel,
      receivedDate: resolveReceivedDate(row),
      ...mapProjectDates(row),
      localWorkPath: normalizeLocalWorkPath(row.local_work_path ?? ''),
      contactFormIds: contactFormIdsMap.get(row.project_no) ?? [],
    }
  })
}

function buildProjectFilters(keyword: string, status: string) {
  const conditions: string[] = []
  const params: unknown[] = []

  if (status) {
    conditions.push('p.status = ?')
    params.push(status)
  }

  if (keyword) {
    conditions.push(`(
      LOWER(p.project_no) LIKE ?
      OR LOWER(p.name) LIKE ?
      OR LOWER(IFNULL(p.customer, '')) LIKE ?
      OR LOWER(IFNULL(p.received_date, '')) LIKE ?
      OR LOWER(IFNULL(p.planned_start_date, '')) LIKE ?
      OR LOWER(IFNULL(p.planned_end_date, '')) LIKE ?
      OR LOWER(IFNULL(p.actual_start_date, '')) LIKE ?
      OR LOWER(IFNULL(p.actual_end_date, '')) LIKE ?
      OR LOWER(IFNULL(p.local_work_path, '')) LIKE ?
      OR EXISTS (
        SELECT 1 FROM contact_form_projects cfp
        WHERE cfp.project_no = p.project_no AND LOWER(cfp.contact_form_id) LIKE ?
      )
      OR EXISTS (
        SELECT 1 FROM project_personnel pp
        INNER JOIN personnel per ON per.id = pp.personnel_id
        WHERE pp.project_no = p.project_no
          AND (LOWER(per.name) LIKE ? OR LOWER(per.team) LIKE ?)
      )
      OR EXISTS (
        SELECT 1 FROM project_natures pn
        WHERE pn.project_no = p.project_no
          AND (
            LOWER(pn.nature) LIKE ?
            OR (? LIKE '%设计%' AND pn.nature = 'design')
            OR (? LIKE '%细化%' AND pn.nature = 'detail')
          )
      )
    )`)
    const likeKeyword = `%${keyword}%`
    params.push(
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      keyword,
      keyword,
    )
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return { whereClause, params }
}

function getProjectRank(whereClause: string, params: unknown[], projectNo: string) {
  const db = getDb()
  const row = db
    .prepare(
      `WITH ranked AS (
        SELECT p.project_no, ROW_NUMBER() OVER (ORDER BY p.project_no ASC) - 1 AS rank
        FROM projects p
        ${whereClause}
      )
      SELECT rank FROM ranked WHERE project_no = ?`,
    )
    .get(...params, projectNo) as { rank: number } | undefined

  return row?.rank
}

function getProjectByNo(projectNo: string) {
  const db = getDb()
  return db.prepare('SELECT * FROM projects WHERE project_no = ?').get(projectNo) as
    | ProjectRow
    | undefined
}

function contactFormExists(contactFormId: string) {
  const db = getDb()
  const row = db
    .prepare('SELECT id FROM contact_forms WHERE id = ?')
    .get(contactFormId) as { id: string } | undefined
  return !!row
}

function personnelExists(personnelId: string) {
  const db = getDb()
  const row = db
    .prepare('SELECT id FROM personnel WHERE id = ?')
    .get(personnelId) as { id: string } | undefined
  return !!row
}

function normalizeNatures(natures?: string[]) {
  const unique = [...new Set((natures ?? []).map((item) => item.trim()).filter(Boolean))]
  const invalid = unique.filter((item) => !VALID_NATURES.has(item))
  if (invalid.length) {
    return { error: '项目性质无效' }
  }
  return { value: unique as Array<'design' | 'detail'> }
}

function normalizeAssignedPersonnelIds(assignedPersonnelIds?: string[]) {
  const unique = [...new Set((assignedPersonnelIds ?? []).map((item) => item.trim()).filter(Boolean))]
  for (const personnelId of unique) {
    if (!personnelExists(personnelId)) {
      return { error: '分配人员不存在' }
    }
  }
  return { value: unique }
}

function normalizeDate(value?: string) {
  return value?.trim() ?? ''
}

function normalizeLocalWorkPath(value?: string) {
  return BusinessSystemConfig.normalizeRelativePath(value ?? '')
}

function formatCustomerFromPersonnelIds(personnelIds: string[]) {
  if (!personnelIds.length) return ''

  const db = getDb()
  const placeholders = personnelIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT name FROM personnel WHERE id IN (${placeholders}) ORDER BY name COLLATE NOCASE`,
    )
    .all(...personnelIds) as Array<{ name: string }>

  return rows.map((row) => row.name).join('、')
}

function syncProjectNatures(projectNo: string, natures: string[]) {
  const db = getDb()
  db.prepare('DELETE FROM project_natures WHERE project_no = ?').run(projectNo)
  const insert = db.prepare(
    'INSERT OR IGNORE INTO project_natures (project_no, nature) VALUES (?, ?)',
  )
  for (const nature of natures) {
    insert.run(projectNo, nature)
  }
}

function syncProjectPersonnel(projectNo: string, personnelIds: string[]) {
  const db = getDb()
  db.prepare('DELETE FROM project_personnel WHERE project_no = ?').run(projectNo)
  const insert = db.prepare(
    'INSERT OR IGNORE INTO project_personnel (project_no, personnel_id) VALUES (?, ?)',
  )
  for (const personnelId of personnelIds) {
    insert.run(projectNo, personnelId)
  }
}

export async function handleProjectCreate(ctx: ApiContext, res: ServerResponse) {
  const payload = ctx.body as ProjectWritePayload
  const projectNo = payload.projectNo?.trim()

  if (!projectNo) {
    sendError(res, 400, '项目号不能为空')
    return true
  }

  if (getProjectByNo(projectNo)) {
    sendError(res, 409, `项目号 ${projectNo} 已存在`)
    return true
  }

  const natureResult = normalizeNatures(payload.natures)
  if (natureResult.error) {
    sendError(res, 400, natureResult.error)
    return true
  }

  const assigneeResult = normalizeAssignedPersonnelIds(payload.assignedPersonnelIds)
  if (assigneeResult.error) {
    sendError(res, 400, assigneeResult.error)
    return true
  }

  const db = getDb()
  const name = payload.name?.trim() || projectNo
  const status = payload.status?.trim() || 'active'
  const contactFormId = payload.contactFormId?.trim()
  const receivedDate =
    normalizeDate(payload.plannedStartDate) ||
    (contactFormId ? getContactReceivedDate(contactFormId) : '')

  const createProject = db.transaction(() => {
    db.prepare(
      `INSERT INTO projects (
        project_no, name, customer, status, received_date,
        planned_start_date, planned_end_date, actual_start_date, actual_end_date,
        local_work_path
      ) VALUES (
        @project_no, @name, @customer, @status, @received_date,
        @planned_start_date, @planned_end_date, @actual_start_date, @actual_end_date,
        @local_work_path
      )`,
    ).run({
      project_no: projectNo,
      name,
      customer: formatCustomerFromPersonnelIds(assigneeResult.value!),
      status,
      received_date: receivedDate,
      planned_start_date: normalizeDate(payload.plannedStartDate),
      planned_end_date: normalizeDate(payload.plannedEndDate),
      actual_start_date: normalizeDate(payload.actualStartDate),
      actual_end_date: normalizeDate(payload.actualEndDate),
      local_work_path: normalizeLocalWorkPath(payload.localWorkPath),
    })

    syncProjectNatures(projectNo, natureResult.value!)
    syncProjectPersonnel(projectNo, assigneeResult.value!)
  })

  createProject()

  if (contactFormId && contactFormExists(contactFormId)) {
    db.prepare(
      'INSERT OR IGNORE INTO contact_form_projects (contact_form_id, project_no) VALUES (?, ?)',
    ).run(contactFormId, projectNo)
  }

  const created = getProjectByNo(projectNo)
  sendJson(res, 201, mapProject(created!))
  return true
}

export async function handleProjectUpdate(ctx: ApiContext, res: ServerResponse) {
  const params = matchRoute(ctx.pathname, 'projects/:projectNo')
  if (!params) return false

  const existing = getProjectByNo(params.projectNo)
  if (!existing) {
    sendError(res, 404, '项目不存在')
    return true
  }

  const payload = ctx.body as ProjectWritePayload
  const name = payload.name?.trim()
  if (!name) {
    sendError(res, 400, '项目名称不能为空')
    return true
  }

  const natureResult = normalizeNatures(
    payload.natures ?? getProjectNatures(params.projectNo),
  )
  if (natureResult.error) {
    sendError(res, 400, natureResult.error)
    return true
  }

  const assigneeResult = normalizeAssignedPersonnelIds(
    payload.assignedPersonnelIds ?? getAssignedPersonnel(params.projectNo).map((item) => item.id),
  )
  if (assigneeResult.error) {
    sendError(res, 400, assigneeResult.error)
    return true
  }

  const existingDates = mapProjectDates(existing)
  const db = getDb()
  const status = payload.status?.trim() || existing.status

  const updateProject = db.transaction(() => {
    db.prepare(
      `UPDATE projects SET
        name = @name,
        customer = @customer,
        status = @status,
        planned_start_date = @planned_start_date,
        planned_end_date = @planned_end_date,
        actual_start_date = @actual_start_date,
        actual_end_date = @actual_end_date,
        local_work_path = @local_work_path,
        updated_at = datetime('now', 'localtime')
      WHERE project_no = @project_no`,
    ).run({
      project_no: params.projectNo,
      name,
      customer: formatCustomerFromPersonnelIds(assigneeResult.value!),
      status,
      planned_start_date:
        payload.plannedStartDate !== undefined
          ? normalizeDate(payload.plannedStartDate)
          : existingDates.plannedStartDate,
      planned_end_date:
        payload.plannedEndDate !== undefined
          ? normalizeDate(payload.plannedEndDate)
          : existingDates.plannedEndDate,
      actual_start_date:
        payload.actualStartDate !== undefined
          ? normalizeDate(payload.actualStartDate)
          : existingDates.actualStartDate,
      actual_end_date:
        payload.actualEndDate !== undefined
          ? normalizeDate(payload.actualEndDate)
          : existingDates.actualEndDate,
      local_work_path:
        payload.localWorkPath !== undefined
          ? normalizeLocalWorkPath(payload.localWorkPath)
          : normalizeLocalWorkPath(existing.local_work_path ?? ''),
    })

    syncProjectNatures(params.projectNo, natureResult.value!)
    syncProjectPersonnel(params.projectNo, assigneeResult.value!)
  })

  updateProject()

  const updated = getProjectByNo(params.projectNo)
  sendJson(res, 200, mapProject(updated!))
  return true
}

export async function handleProjectList(ctx: ApiContext, res: ServerResponse) {
  const db = getDb()
  const keyword = (ctx.query.get('keyword') || '').trim().toLowerCase()
  const status = ctx.query.get('status') || ''
  const loadAll = ctx.query.get('all') === 'true'
  const { whereClause, params } = buildProjectFilters(keyword, status)

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM projects p ${whereClause}`)
    .get(...params) as { total: number }

  const total = countRow.total

  if (loadAll) {
    const rows = db
      .prepare(`SELECT p.* FROM projects p ${whereClause} ORDER BY p.project_no ASC`)
      .all(...params) as ProjectRow[]
    const list = mapProjectsBatch(rows)
    sendJson(res, 200, {
      list,
      total,
      page: 1,
      pageSize: list.length,
      totalPages: 1,
    })
    return true
  }

  const pageQuery = parseListPageQuery(ctx)
  let anchorIndex: number | undefined

  if (pageQuery.anchor) {
    anchorIndex = getProjectRank(whereClause, params, pageQuery.anchor)
  }

  const window = computePaginatedWindow({
    total,
    pageSize: pageQuery.pageSize,
    page: pageQuery.anchor ? undefined : pageQuery.page,
    anchorIndex,
  })

  const rows = db
    .prepare(
      `SELECT p.* FROM projects p ${whereClause}
       ORDER BY p.project_no ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, window.limit, window.offset) as ProjectRow[]

  const list = mapProjectsBatch(rows)

  sendJson(res, 200, {
    list,
    total,
    page: window.page,
    pageSize: pageQuery.pageSize,
    totalPages: window.totalPages,
  })
  return true
}

export async function handleProjectCheck(ctx: ApiContext, res: ServerResponse) {
  const raw = (ctx.query.get('nos') || '').trim()
  const projectNos = [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))]
  if (!projectNos.length) {
    sendJson(res, 200, { existing: [] as string[] })
    return true
  }

  const db = getDb()
  const placeholders = projectNos.map(() => '?').join(',')
  const rows = db
    .prepare(`SELECT project_no FROM projects WHERE project_no IN (${placeholders})`)
    .all(...projectNos) as Array<{ project_no: string }>

  sendJson(res, 200, { existing: rows.map((row) => row.project_no) })
  return true
}
