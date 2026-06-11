import type Database from 'better-sqlite3'
import { RoleForm } from '../src/models/personnel/RoleForm.ts'
import { removeObsoleteRoles, replaceBoardData, shouldReplaceBoardBizData } from './seed-board'

function getColumnNames(db: Database.Database, table: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return new Set(rows.map((row) => row.name))
}

function tableExists(db: Database.Database, table: string) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { name: string } | undefined
  return !!row
}

function migrateProjectRelationTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_natures (
      project_no  TEXT NOT NULL,
      nature      TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (project_no, nature),
      FOREIGN KEY (project_no) REFERENCES projects (project_no) ON DELETE CASCADE,
      CHECK (nature IN ('design', 'detail'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_personnel (
      project_no    TEXT NOT NULL,
      personnel_id  TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (project_no, personnel_id),
      FOREIGN KEY (project_no) REFERENCES projects (project_no) ON DELETE CASCADE,
      FOREIGN KEY (personnel_id) REFERENCES personnel (id) ON DELETE CASCADE
    )
  `)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_project_natures_project_no ON project_natures (project_no)`)
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_project_personnel_project_no ON project_personnel (project_no)`,
  )
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_project_personnel_personnel_id ON project_personnel (personnel_id)`,
  )
}

function migrateLegacyProjectFields(db: Database.Database) {
  if (!tableExists(db, 'projects')) return

  const columns = getColumnNames(db, 'projects')
  const hasLegacyNature = columns.has('nature')
  const hasLegacyAssignee = columns.has('assigned_personnel_id')

  if (!hasLegacyNature && !hasLegacyAssignee) return

  const projects = db
    .prepare(
      `SELECT project_no${hasLegacyNature ? ', nature' : ''}${hasLegacyAssignee ? ', assigned_personnel_id' : ''} FROM projects`,
    )
    .all() as Array<{
      project_no: string
      nature?: string
      assigned_personnel_id?: string | null
    }>

  const countNatures = db.prepare(
    'SELECT COUNT(*) AS count FROM project_natures WHERE project_no = ?',
  )
  const countPersonnel = db.prepare(
    'SELECT COUNT(*) AS count FROM project_personnel WHERE project_no = ?',
  )
  const insertNature = db.prepare(
    'INSERT OR IGNORE INTO project_natures (project_no, nature) VALUES (?, ?)',
  )
  const insertPersonnel = db.prepare(
    'INSERT OR IGNORE INTO project_personnel (project_no, personnel_id) VALUES (?, ?)',
  )

  for (const project of projects) {
    const natureCount = (countNatures.get(project.project_no) as { count: number }).count
    if (natureCount === 0 && hasLegacyNature && project.nature) {
      if (project.nature === 'both') {
        insertNature.run(project.project_no, 'design')
        insertNature.run(project.project_no, 'detail')
      } else if (project.nature === 'design' || project.nature === 'detail') {
        insertNature.run(project.project_no, project.nature)
      }
    }

    const personnelCount = (countPersonnel.get(project.project_no) as { count: number }).count
    if (
      personnelCount === 0 &&
      hasLegacyAssignee &&
      project.assigned_personnel_id?.trim()
    ) {
      insertPersonnel.run(project.project_no, project.assigned_personnel_id.trim())
    }
  }
}

function migrateProjectsTable(db: Database.Database) {
  const columns = getColumnNames(db, 'projects')

  if (!columns.has('nature')) {
    db.exec(`ALTER TABLE projects ADD COLUMN nature TEXT NOT NULL DEFAULT ''`)
  }

  if (!columns.has('assigned_personnel_id')) {
    db.exec(`ALTER TABLE projects ADD COLUMN assigned_personnel_id TEXT`)
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_projects_assigned_personnel ON projects (assigned_personnel_id)`,
    )
  }
}

function migrateProjectReceivedDateField(db: Database.Database) {
  if (!tableExists(db, 'projects')) return

  const columns = getColumnNames(db, 'projects')
  if (!columns.has('received_date')) {
    db.exec(`ALTER TABLE projects ADD COLUMN received_date TEXT`)
  }

  db.exec(`
    UPDATE projects
    SET received_date = planned_start_date
    WHERE IFNULL(received_date, '') = ''
      AND IFNULL(planned_start_date, '') != ''
  `)
}

function migrateProjectLocalWorkPathField(db: Database.Database) {
  if (!tableExists(db, 'projects')) return

  const columns = getColumnNames(db, 'projects')
  if (!columns.has('local_work_path')) {
    db.exec(`ALTER TABLE projects ADD COLUMN local_work_path TEXT`)
  }
}

function migrateProjectDateFields(db: Database.Database) {
  if (!tableExists(db, 'projects')) return

  const columns = getColumnNames(db, 'projects')
  const dateColumns = [
    'planned_start_date',
    'planned_end_date',
    'actual_start_date',
    'actual_end_date',
  ] as const

  for (const column of dateColumns) {
    if (!columns.has(column)) {
      db.exec(`ALTER TABLE projects ADD COLUMN ${column} TEXT`)
    }
  }

  const hasLegacyStart = columns.has('start_date')
  const hasLegacyEnd = columns.has('end_date')
  if (!hasLegacyStart && !hasLegacyEnd) return

  const projects = db
    .prepare('SELECT project_no, start_date, end_date FROM projects')
    .all() as Array<{
      project_no: string
      start_date?: string | null
      end_date?: string | null
    }>

  const update = db.prepare(
    `UPDATE projects SET
      planned_start_date = CASE
        WHEN IFNULL(planned_start_date, '') = '' THEN @planned_start_date
        ELSE planned_start_date
      END,
      planned_end_date = CASE
        WHEN IFNULL(planned_end_date, '') = '' THEN @planned_end_date
        ELSE planned_end_date
      END
    WHERE project_no = @project_no`,
  )

  for (const project of projects) {
    update.run({
      project_no: project.project_no,
      planned_start_date: project.start_date?.trim() || '',
      planned_end_date: project.end_date?.trim() || '',
    })
  }
}

function migrateRoleTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id          TEXT PRIMARY KEY,
      code        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      module      TEXT NOT NULL,
      path        TEXT NOT NULL DEFAULT '',
      page_key    TEXT NOT NULL DEFAULT '',
      page_name   TEXT NOT NULL DEFAULT '',
      action      TEXT NOT NULL DEFAULT 'view',
      created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  const permissionColumns = getColumnNames(db, 'permissions')
  if (!permissionColumns.has('path')) {
    db.exec(`ALTER TABLE permissions ADD COLUMN path TEXT NOT NULL DEFAULT ''`)
  }
  if (!permissionColumns.has('page_key')) {
    db.exec(`ALTER TABLE permissions ADD COLUMN page_key TEXT NOT NULL DEFAULT ''`)
  }
  if (!permissionColumns.has('page_name')) {
    db.exec(`ALTER TABLE permissions ADD COLUMN page_name TEXT NOT NULL DEFAULT ''`)
  }
  if (!permissionColumns.has('action')) {
    db.exec(`ALTER TABLE permissions ADD COLUMN action TEXT NOT NULL DEFAULT 'view'`)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      code        TEXT NOT NULL UNIQUE,
      description TEXT,
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id       TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS role_personnel (
      role_id       TEXT NOT NULL,
      personnel_id  TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (role_id, personnel_id),
      FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
      FOREIGN KEY (personnel_id) REFERENCES personnel (id) ON DELETE CASCADE
    )
  `)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions (module)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_roles_status ON roles (status)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions (role_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_role_personnel_role_id ON role_personnel (role_id)`)
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_role_personnel_personnel_id ON role_personnel (personnel_id)`,
  )

  const permissionCount = (
    db.prepare('SELECT COUNT(*) AS count FROM permissions').get() as { count: number }
  ).count

  if (permissionCount === 0) {
    seedPermissions(db)
  }

  seedDefaultRolesIfEmpty(db)
}

function seedPermissions(db: Database.Database) {
  const insertPermission = db.prepare(
    `INSERT OR IGNORE INTO permissions (
      id, code, name, module, path, page_key, page_name, action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  for (const permission of RoleForm.PERMISSION_CATALOG) {
    insertPermission.run(
      permission.id,
      permission.code,
      permission.name,
      permission.module,
      permission.path,
      permission.pageKey,
      permission.pageName,
      permission.action,
    )
  }
}

function seedRoleSamples(db: Database.Database) {
  const insertRole = db.prepare(
    'INSERT OR IGNORE INTO roles (id, name, code, description, status) VALUES (?, ?, ?, ?, ?)',
  )
  const insertRolePermission = db.prepare(
    'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
  )
  const insertRolePersonnel = db.prepare(
    'INSERT OR IGNORE INTO role_personnel (role_id, personnel_id) VALUES (?, ?)',
  )

  for (const role of RoleForm.ROLE_SEEDS) {
    insertRole.run(role.id, role.name, role.code, role.description, role.status)
    for (const permissionId of role.permissionIds) {
      insertRolePermission.run(role.id, permissionId)
    }
    for (const personnelId of role.personnelIds) {
      insertRolePersonnel.run(role.id, personnelId)
    }
  }
}

function seedDefaultRolesIfEmpty(db: Database.Database) {
  const roleCount = (db.prepare('SELECT COUNT(*) AS count FROM roles').get() as { count: number })
    .count

  if (roleCount > 0) return

  seedRoleSamples(db)
}

function migrateActionBasedPermissions(db: Database.Database) {
  if (!tableExists(db, 'permissions')) return

  const expectedCount = RoleForm.PERMISSION_CATALOG.length
  const hasActionModel = db
    .prepare(
      "SELECT 1 AS ok FROM permissions WHERE code = 'contact:create' AND page_key = 'contact' AND action = 'create' LIMIT 1",
    )
    .get() as { ok: number } | undefined
  const permissionCount = (
    db.prepare('SELECT COUNT(*) AS count FROM permissions').get() as { count: number }
  ).count

  if (hasActionModel && permissionCount === expectedCount) return

  db.exec('DELETE FROM role_personnel')
  db.exec('DELETE FROM role_permissions')
  db.exec('DELETE FROM roles')
  db.exec('DELETE FROM permissions')
  seedPermissions(db)
  seedRoleSamples(db)
}

function migrateBoardBizData(db: Database.Database) {
  if (!shouldReplaceBoardBizData(db)) return
  replaceBoardData(db)
}

function migrateObsoleteRoles(db: Database.Database) {
  if (!tableExists(db, 'roles')) return
  removeObsoleteRoles(db)
}

function migrateAccountPasswordsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_passwords (
      account     TEXT PRIMARY KEY,
      password    TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)
}

function migrateSystemSettingsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)
}

export function runMigrations(db: Database.Database) {
  migrateProjectsTable(db)
  migrateProjectRelationTables(db)
  migrateLegacyProjectFields(db)
  migrateProjectDateFields(db)
  migrateProjectLocalWorkPathField(db)
  migrateProjectReceivedDateField(db)
  migrateRoleTables(db)
  migrateAccountPasswordsTable(db)
  migrateSystemSettingsTable(db)
  migrateActionBasedPermissions(db)
  migrateObsoleteRoles(db)
  migrateBoardBizData(db)
}
