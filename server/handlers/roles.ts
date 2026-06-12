import type { ServerResponse } from 'node:http'
import { getDb } from '../db'
import { RoleForm } from '../../src/models/personnel/RoleForm.ts'
import type { ApiContext } from '../utils'
import { matchRoute, sendError, sendJson } from '../utils'

type RoleRow = {
  id: string
  name: string
  code: string
  description: string
  status: string
}

type PermissionRow = {
  id: string
  code: string
  name: string
  module: string
  path?: string | null
  page_key?: string | null
  page_name?: string | null
  action?: string | null
}

function mapPermission(row: PermissionRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    module: row.module,
    path: row.path?.trim() || '',
    pageKey: row.page_key?.trim() || '',
    pageName: row.page_name?.trim() || '',
    action: (row.action?.trim() || 'view') as 'view' | 'create' | 'update' | 'delete',
  }
}

type RoleAssigneeRow = {
  id: string
  name: string
  team: string
}

type RoleWritePayload = {
  id?: string
  name?: string
  code?: string
  description?: string
  status?: string
  permissionIds?: string[]
  assignedPersonnelIds?: string[]
}

function getRolePermissions(roleId: string) {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT p.id, p.code, p.name, p.module, p.path, p.page_key, p.page_name, p.action
       FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
    )
    .all(roleId) as PermissionRow[]

  return RoleForm.sortPermissions(rows.map(mapPermission))
}

function getRolePersonnel(roleId: string) {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.team
       FROM role_personnel rp
       INNER JOIN personnel p ON p.id = rp.personnel_id
       WHERE rp.role_id = ?
       ORDER BY p.team, p.name`,
    )
    .all(roleId) as RoleAssigneeRow[]

  return rows
}

function mapRole(row: RoleRow) {
  const permissions = getRolePermissions(row.id)
  const assignedPersonnel = getRolePersonnel(row.id)

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    permissionIds: permissions.map((item) => item.id),
    permissions,
    assignedPersonnelIds: assignedPersonnel.map((item) => item.id),
    assignedPersonnel,
  }
}

function getRoleById(id: string) {
  const db = getDb()
  return db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as RoleRow | undefined
}

function permissionExists(permissionId: string) {
  const db = getDb()
  const row = db
    .prepare('SELECT id FROM permissions WHERE id = ?')
    .get(permissionId) as { id: string } | undefined
  return !!row
}

function personnelExists(personnelId: string) {
  const db = getDb()
  const row = db
    .prepare('SELECT id FROM personnel WHERE id = ?')
    .get(personnelId) as { id: string } | undefined
  return !!row
}

function normalizePermissionIds(permissionIds?: string[]) {
  const unique = [...new Set((permissionIds ?? []).map((item) => item.trim()).filter(Boolean))]
  for (const permissionId of unique) {
    if (!permissionExists(permissionId)) {
      return { error: '权限不存在' }
    }
  }
  return { value: unique }
}

function normalizeAssignedPersonnelIds(assignedPersonnelIds?: string[]) {
  const unique = [...new Set((assignedPersonnelIds ?? []).map((item) => item.trim()).filter(Boolean))]
  for (const personnelId of unique) {
    if (!personnelExists(personnelId)) {
      return { error: '关联人员不存在' }
    }
  }
  return { value: unique }
}

function syncRolePermissions(roleId: string, permissionIds: string[]) {
  const db = getDb()
  db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId)
  const insert = db.prepare(
    'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
  )
  for (const permissionId of permissionIds) {
    insert.run(roleId, permissionId)
  }
}

function syncRolePersonnel(roleId: string, personnelIds: string[]) {
  const db = getDb()
  db.prepare('DELETE FROM role_personnel WHERE role_id = ?').run(roleId)
  const insert = db.prepare(
    'INSERT OR IGNORE INTO role_personnel (role_id, personnel_id) VALUES (?, ?)',
  )
  for (const personnelId of personnelIds) {
    insert.run(roleId, personnelId)
  }
}

function generateRoleId() {
  const db = getDb()
  const rows = db
    .prepare("SELECT id FROM roles WHERE id LIKE 'ROLE%' ORDER BY id DESC LIMIT 1")
    .all() as Array<{ id: string }>

  if (!rows.length) return 'ROLE001'

  const lastNumber = Number.parseInt(rows[0].id.replace('ROLE', ''), 10)
  return `ROLE${String((Number.isNaN(lastNumber) ? 0 : lastNumber) + 1).padStart(3, '0')}`
}

export async function handlePermissionList(_ctx: ApiContext, res: ServerResponse) {
  const db = getDb()
  const rows = db
    .prepare(
      'SELECT id, code, name, module, path, page_key, page_name, action FROM permissions',
    )
    .all() as PermissionRow[]

  sendJson(res, 200, RoleForm.sortPermissions(rows.map(mapPermission)))
  return true
}

export async function handleRoleList(ctx: ApiContext, res: ServerResponse) {
  const db = getDb()
  const keyword = (ctx.query.get('keyword') || '').trim().toLowerCase()
  const status = ctx.query.get('status') || ''

  const rows = db.prepare('SELECT * FROM roles ORDER BY id').all() as RoleRow[]

  const list = rows
    .map(mapRole)
    .filter((item) => {
      const matchStatus = !status || item.status === status
      if (!keyword) return matchStatus

      const searchable = [
        item.id,
        item.name,
        item.code,
        item.description,
        ...item.permissions.map((permission) => `${permission.name} ${permission.code}`),
        ...item.assignedPersonnel.map((person) => `${person.name} ${person.team}`),
      ]
        .join(' ')
        .toLowerCase()

      return matchStatus && searchable.includes(keyword)
    })

  sendJson(res, 200, list)
  return true
}

export async function handleRoleCreate(ctx: ApiContext, res: ServerResponse) {
  const payload = ctx.body as RoleWritePayload
  const name = payload.name?.trim()
  const code = payload.code?.trim()

  if (!name) {
    sendError(res, 400, '角色名称不能为空')
    return true
  }

  if (!code) {
    sendError(res, 400, '角色编码不能为空')
    return true
  }

  const db = getDb()
  const existingCode = db
    .prepare('SELECT id FROM roles WHERE code = ?')
    .get(code) as { id: string } | undefined

  if (existingCode) {
    sendError(res, 409, `角色编码 ${code} 已存在`)
    return true
  }

  const permissionResult = normalizePermissionIds(payload.permissionIds)
  if (permissionResult.error) {
    sendError(res, 400, permissionResult.error)
    return true
  }

  const assigneeResult = normalizeAssignedPersonnelIds(payload.assignedPersonnelIds)
  if (assigneeResult.error) {
    sendError(res, 400, assigneeResult.error)
    return true
  }

  const roleId = payload.id?.trim() || generateRoleId()
  if (getRoleById(roleId)) {
    sendError(res, 409, `角色 ${roleId} 已存在`)
    return true
  }

  const status = payload.status?.trim() || 'active'

  const createRole = db.transaction(() => {
    db.prepare(
      `INSERT INTO roles (id, name, code, description, status)
       VALUES (@id, @name, @code, @description, @status)`,
    ).run({
      id: roleId,
      name,
      code,
      description: payload.description?.trim() ?? '',
      status,
    })

    syncRolePermissions(roleId, permissionResult.value!)
    syncRolePersonnel(roleId, assigneeResult.value!)
  })

  createRole()

  const created = getRoleById(roleId)
  sendJson(res, 201, mapRole(created!))
  return true
}

export async function handleRoleUpdate(ctx: ApiContext, res: ServerResponse) {
  const params = matchRoute(ctx.pathname, 'roles/:id')
  if (!params) return false

  const existing = getRoleById(params.id)
  if (!existing) {
    sendError(res, 404, '角色不存在')
    return true
  }

  const payload = ctx.body as RoleWritePayload
  const name = payload.name?.trim()
  const code = payload.code?.trim()

  if (!name) {
    sendError(res, 400, '角色名称不能为空')
    return true
  }

  if (!code) {
    sendError(res, 400, '角色编码不能为空')
    return true
  }

  const db = getDb()
  const duplicateCode = db
    .prepare('SELECT id FROM roles WHERE code = ? AND id != ?')
    .get(code, params.id) as { id: string } | undefined

  if (duplicateCode) {
    sendError(res, 409, `角色编码 ${code} 已存在`)
    return true
  }

  const permissionResult = normalizePermissionIds(
    payload.permissionIds ?? getRolePermissions(params.id).map((item) => item.id),
  )
  if (permissionResult.error) {
    sendError(res, 400, permissionResult.error)
    return true
  }

  const assigneeResult = normalizeAssignedPersonnelIds(
    payload.assignedPersonnelIds ?? getRolePersonnel(params.id).map((item) => item.id),
  )
  if (assigneeResult.error) {
    sendError(res, 400, assigneeResult.error)
    return true
  }

  const status = payload.status?.trim() || existing.status

  const updateRole = db.transaction(() => {
    db.prepare(
      `UPDATE roles SET
        name = @name,
        code = @code,
        description = @description,
        status = @status,
        updated_at = datetime('now', 'localtime')
      WHERE id = @id`,
    ).run({
      id: params.id,
      name,
      code,
      description: payload.description?.trim() ?? '',
      status,
    })

    syncRolePermissions(params.id, permissionResult.value!)
    syncRolePersonnel(params.id, assigneeResult.value!)
  })

  updateRole()

  const updated = getRoleById(params.id)
  sendJson(res, 200, mapRole(updated!))
  return true
}

export async function handleRoleDelete(ctx: ApiContext, res: ServerResponse) {
  const params = matchRoute(ctx.pathname, 'roles/:id')
  if (!params) return false

  const existing = getRoleById(params.id)
  if (!existing) {
    sendError(res, 404, '角色不存在')
    return true
  }

  const db = getDb()
  db.prepare('DELETE FROM roles WHERE id = ?').run(params.id)
  sendJson(res, 200, { id: params.id })
  return true
}
