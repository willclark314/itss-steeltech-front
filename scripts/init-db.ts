import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { ContactForm } from '../src/models/biz/contact/ContactForm.ts'
import { ProjectForm } from '../src/models/biz/project/ProjectForm.ts'
import { PersonnelForm } from '../src/models/personnel/PersonnelForm.ts'
import { RoleForm } from '../src/models/personnel/RoleForm.ts'
import { ContactFormPdf } from '../src/models/db/ContactFormPdf.ts'
import { CONTACT_PDF_DIR } from '../src/models/db/tables.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const datasDir = path.join(rootDir, 'datas')
const dbPath = path.join(datasDir, 'steeltech.db')
const schemaPath = path.join(datasDir, 'schema.sql')
const pdfRootDir = path.join(rootDir, CONTACT_PDF_DIR)

fs.mkdirSync(datasDir, { recursive: true })
fs.mkdirSync(pdfRootDir, { recursive: true })

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath)
}

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')
db.exec(fs.readFileSync(schemaPath, 'utf-8'))

const insertPersonnel = db.prepare(`
  INSERT INTO personnel (
    id, name, employee_no, id_card_no, passport_no, passport_expiry,
    position, nationality, workshop, team, birth_date, age, gender, ethnicity,
    native_place, education, home_address, graduation_school, major,
    indonesia_phone, domestic_phone, dormitory_no, status
  ) VALUES (
    @id, @name, @employee_no, @id_card_no, @passport_no, @passport_expiry,
    @position, @nationality, @workshop, @team, @birth_date, @age, @gender, @ethnicity,
    @native_place, @education, @home_address, @graduation_school, @major,
    @indonesia_phone, @domestic_phone, @dormitory_no, @status
  )
`)

const insertProject = db.prepare(`
  INSERT INTO projects (
    project_no, name, customer, status, received_date,
    planned_start_date, planned_end_date, actual_start_date, actual_end_date,
    local_work_path
  ) VALUES (
    @project_no, @name, @customer, @status, @received_date,
    @planned_start_date, @planned_end_date, @actual_start_date, @actual_end_date,
    @local_work_path
  )
`)

const insertProjectNature = db.prepare(`
  INSERT OR IGNORE INTO project_natures (project_no, nature)
  VALUES (@project_no, @nature)
`)

const insertProjectPersonnel = db.prepare(`
  INSERT OR IGNORE INTO project_personnel (project_no, personnel_id)
  VALUES (@project_no, @personnel_id)
`)

const insertContactForm = db.prepare(`
  INSERT INTO contact_forms (
    id, title, received_date, urgency, status, content, expect_reply_date, created_at
  ) VALUES (
    @id, @title, @received_date, @urgency, @status, @content, @expect_reply_date, @created_at
  )
`)

const insertPermission = db.prepare(`
  INSERT OR IGNORE INTO permissions (id, code, name, module, path, page_key, page_name, action)
  VALUES (@id, @code, @name, @module, @path, @page_key, @page_name, @action)
`)

const insertRole = db.prepare(`
  INSERT INTO roles (id, name, code, description, status)
  VALUES (@id, @name, @code, @description, @status)
`)

const insertRolePermission = db.prepare(`
  INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  VALUES (@role_id, @permission_id)
`)

const insertRolePersonnel = db.prepare(`
  INSERT OR IGNORE INTO role_personnel (role_id, personnel_id)
  VALUES (@role_id, @personnel_id)
`)

const insertContactProject = db.prepare(`
  INSERT OR IGNORE INTO contact_form_projects (contact_form_id, project_no)
  VALUES (@contact_form_id, @project_no)
`)

const insertContactPdf = db.prepare(`
  INSERT INTO contact_form_pdfs (
    id, contact_form_id, file_name, file_path, file_size, mime_type, sort_order, created_at
  ) VALUES (
    @id, @contact_form_id, @file_name, @file_path, @file_size, @mime_type, @sort_order, @created_at
  )
`)

const seedPersonnel = db.transaction(() => {
  for (const person of PersonnelForm.DEFAULT_SAMPLES) {
    insertPersonnel.run({
      id: person.id,
      name: person.name,
      employee_no: person.employeeNo,
      id_card_no: person.idCardNo,
      passport_no: person.passportNo,
      passport_expiry: person.passportExpiry,
      position: person.position,
      nationality: person.nationality,
      workshop: person.workshop,
      team: person.team,
      birth_date: person.birthDate,
      age: person.age,
      gender: person.gender,
      ethnicity: person.ethnicity,
      native_place: person.nativePlace,
      education: person.education,
      home_address: person.homeAddress,
      graduation_school: person.graduationSchool,
      major: person.major,
      indonesia_phone: person.indonesiaPhone,
      domestic_phone: person.domesticPhone,
      dormitory_no: person.dormitoryNo,
      status: person.status,
    })
  }
})

const seedRoles = db.transaction(() => {
  for (const permission of RoleForm.PERMISSION_CATALOG) {
    insertPermission.run({
      id: permission.id,
      code: permission.code,
      name: permission.name,
      module: permission.module,
      path: permission.path,
      page_key: permission.pageKey,
      page_name: permission.pageName,
      action: permission.action,
    })
  }

  for (const role of RoleForm.DEFAULT_SAMPLES) {
    insertRole.run({
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description,
      status: role.status,
    })

    for (const permissionId of role.permissionIds) {
      insertRolePermission.run({
        role_id: role.id,
        permission_id: permissionId,
      })
    }

    for (const personnelId of role.assignedPersonnelIds) {
      insertRolePersonnel.run({
        role_id: role.id,
        personnel_id: personnelId,
      })
    }
  }
})

const seedProjects = db.transaction(() => {
  for (const project of ProjectForm.DEFAULT_SAMPLES) {
    insertProject.run({
      project_no: project.projectNo,
      name: project.name,
      customer: project.customer,
      status: project.status,
      received_date: project.receivedDate ?? project.plannedStartDate ?? '',
      planned_start_date: project.plannedStartDate,
      planned_end_date: project.plannedEndDate,
      actual_start_date: project.actualStartDate,
      actual_end_date: project.actualEndDate,
      local_work_path: project.localWorkPath ?? '',
    })

    for (const nature of project.natures) {
      insertProjectNature.run({
        project_no: project.projectNo,
        nature,
      })
    }

    for (const personnelId of project.assignedPersonnelIds) {
      insertProjectPersonnel.run({
        project_no: project.projectNo,
        personnel_id: personnelId,
      })
    }
  }
})

const seedContacts = db.transaction(() => {
  for (const contact of ContactForm.DEFAULT_SAMPLES) {
    insertContactForm.run({
      id: contact.id,
      title: contact.title,
      received_date: contact.receivedDate,
      urgency: contact.urgency,
      status: contact.status,
      content: contact.content,
      expect_reply_date: contact.expectReplyDate,
      created_at: contact.createdAt,
    })

    for (const projectNo of contact.projectNos) {
      insertContactProject.run({
        contact_form_id: contact.id,
        project_no: projectNo,
      })
    }

    contact.attachments.forEach((attachment, index) => {
      const pdfRecord = ContactFormPdf.create({
        id: attachment.id,
        contactFormId: contact.id,
        fileName: attachment.name,
        sortOrder: index,
        createdAt: contact.createdAt,
      })

      const contactPdfDir = path.join(rootDir, CONTACT_PDF_DIR, contact.id)
      fs.mkdirSync(contactPdfDir, { recursive: true })

      insertContactPdf.run({
        id: pdfRecord.id,
        contact_form_id: pdfRecord.contactFormId,
        file_name: pdfRecord.fileName,
        file_path: pdfRecord.filePath,
        file_size: pdfRecord.fileSize,
        mime_type: pdfRecord.mimeType,
        sort_order: pdfRecord.sortOrder,
        created_at: pdfRecord.createdAt,
      })
    })
  }

  for (const project of ProjectForm.DEFAULT_SAMPLES) {
    for (const contactFormId of project.contactFormIds) {
      insertContactProject.run({
        contact_form_id: contactFormId,
        project_no: project.projectNo,
      })
    }
  }
})

seedPersonnel()
seedRoles()
seedProjects()
seedContacts()

const counts = {
  personnel: db.prepare('SELECT COUNT(*) AS count FROM personnel').get() as { count: number },
  permissions: db.prepare('SELECT COUNT(*) AS count FROM permissions').get() as { count: number },
  roles: db.prepare('SELECT COUNT(*) AS count FROM roles').get() as { count: number },
  projects: db.prepare('SELECT COUNT(*) AS count FROM projects').get() as { count: number },
  contactForms: db.prepare('SELECT COUNT(*) AS count FROM contact_forms').get() as { count: number },
  contactPdfs: db.prepare('SELECT COUNT(*) AS count FROM contact_form_pdfs').get() as { count: number },
  contactProjects: db
    .prepare('SELECT COUNT(*) AS count FROM contact_form_projects')
    .get() as { count: number },
}

db.close()

console.log(`SQLite 数据库已初始化: ${dbPath}`)
console.log(`- 人员: ${counts.personnel.count} 条`)
console.log(`- 权限: ${counts.permissions.count} 条`)
console.log(`- 角色: ${counts.roles.count} 条`)
console.log(`- 项目: ${counts.projects.count} 条`)
console.log(`- 联系单: ${counts.contactForms.count} 条`)
console.log(`- 联系单 PDF: ${counts.contactPdfs.count} 条`)
console.log(`- 联系单-项目关联: ${counts.contactProjects.count} 条`)
