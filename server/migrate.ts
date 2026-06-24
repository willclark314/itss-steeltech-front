import type Database from 'better-sqlite3'

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

function migrateContactFormRelations(db: Database.Database) {
  if (!tableExists(db, 'contact_forms')) return

  const columns = getColumnNames(db, 'contact_forms')
  if (!columns.has('parent_id')) {
    db.exec(`ALTER TABLE contact_forms ADD COLUMN parent_id TEXT`)
  }
  if (!columns.has('root_id')) {
    db.exec(`ALTER TABLE contact_forms ADD COLUMN root_id TEXT`)
  }
  if (!columns.has('relation_type')) {
    db.exec(`ALTER TABLE contact_forms ADD COLUMN relation_type TEXT NOT NULL DEFAULT 'primary'`)
  }
  if (!columns.has('sort_order')) {
    db.exec(`ALTER TABLE contact_forms ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`)
  }
  if (!columns.has('cancel_scope')) {
    db.exec(`ALTER TABLE contact_forms ADD COLUMN cancel_scope TEXT`)
  }

  db.exec(`UPDATE contact_forms SET root_id = id WHERE IFNULL(root_id, '') = ''`)
  db.exec(`UPDATE contact_forms SET relation_type = 'primary' WHERE IFNULL(relation_type, '') = ''`)
  db.exec(`UPDATE contact_forms SET sort_order = 0 WHERE sort_order IS NULL`)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_contact_forms_root_sort ON contact_forms (root_id, sort_order)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_contact_forms_parent ON contact_forms (parent_id)`)

  const projectColumns = getColumnNames(db, 'contact_form_projects')
  if (!projectColumns.has('source_type')) {
    db.exec(`ALTER TABLE contact_form_projects ADD COLUMN source_type TEXT NOT NULL DEFAULT 'own'`)
  }
  if (!projectColumns.has('source_contact_form_id')) {
    db.exec(`ALTER TABLE contact_form_projects ADD COLUMN source_contact_form_id TEXT`)
  }
  db.exec(`UPDATE contact_form_projects SET source_type = 'own' WHERE IFNULL(source_type, '') = ''`)

  const pdfColumns = getColumnNames(db, 'contact_form_pdfs')
  if (!pdfColumns.has('attachment_type')) {
    db.exec(`ALTER TABLE contact_form_pdfs ADD COLUMN attachment_type TEXT NOT NULL DEFAULT 'supplement'`)
  }
  if (!pdfColumns.has('remark')) {
    db.exec(`ALTER TABLE contact_form_pdfs ADD COLUMN remark TEXT`)
  }
  db.exec(`
    UPDATE contact_form_pdfs
    SET attachment_type = CASE WHEN sort_order = 0 THEN 'primary' ELSE 'supplement' END
    WHERE IFNULL(attachment_type, '') = ''
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_form_project_cancellations (
      id                TEXT PRIMARY KEY,
      cancel_contact_id TEXT NOT NULL,
      target_contact_id TEXT NOT NULL,
      project_no        TEXT NOT NULL,
      cancelled_at      TEXT NOT NULL,
      FOREIGN KEY (cancel_contact_id) REFERENCES contact_forms (id) ON DELETE CASCADE,
      FOREIGN KEY (target_contact_id) REFERENCES contact_forms (id) ON DELETE CASCADE,
      FOREIGN KEY (project_no) REFERENCES projects (project_no) ON DELETE CASCADE
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cfpc_cancel ON contact_form_project_cancellations (cancel_contact_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cfpc_target ON contact_form_project_cancellations (target_contact_id)`)
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
  migrateContactFormRelations(db)
}
