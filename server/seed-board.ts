import type Database from 'better-sqlite3'
import { ContactForm } from '../src/models/biz/contact/ContactForm.ts'
import { ProjectForm } from '../src/models/biz/project/ProjectForm.ts'
import { PersonnelForm } from '../src/models/personnel/PersonnelForm.ts'
import { RoleForm } from '../src/models/personnel/RoleForm.ts'
import { BOARD_IMPORT_META } from '../src/data/board/index.ts'

const insertPersonnel = (db: Database.Database) =>
  db.prepare(`
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

export function removeObsoleteRoles(db: Database.Database) {
  const seededRoleIds = RoleForm.ROLE_SEEDS.map((role) => role.id)
  if (!seededRoleIds.length) return

  const placeholders = seededRoleIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM roles WHERE id NOT IN (${placeholders})`).run(...seededRoleIds)
}

export function replaceBoardPersonnelData(db: Database.Database) {
  const insert = insertPersonnel(db)
  const insertRolePersonnel = db.prepare(
    'INSERT OR IGNORE INTO role_personnel (role_id, personnel_id) VALUES (?, ?)',
  )

  const sync = db.transaction(() => {
    removeObsoleteRoles(db)
    db.exec('DELETE FROM role_personnel')
    db.exec('DELETE FROM project_personnel')
    db.exec('DELETE FROM personnel')

    for (const person of PersonnelForm.DEFAULT_SAMPLES) {
      insert.run({
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

    for (const role of RoleForm.ROLE_SEEDS) {
      for (const personnelId of role.personnelIds) {
        insertRolePersonnel.run(role.id, personnelId)
      }
    }
  })

  sync()
}

export function seedBoardBizData(db: Database.Database) {
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
      id, title, received_date, urgency, status, content, expect_reply_date,
      parent_id, root_id, relation_type, sort_order, created_at
    ) VALUES (
      @id, @title, @received_date, @urgency, @status, @content, @expect_reply_date,
      NULL, @root_id, 'primary', 0, @created_at
    )
  `)

  const insertContactProject = db.prepare(`
    INSERT OR IGNORE INTO contact_form_projects (contact_form_id, project_no, source_type)
    VALUES (@contact_form_id, @project_no, 'own')
  `)

  const projectNos = new Set(ProjectForm.DEFAULT_SAMPLES.map((item) => item.projectNo))

  const seed = db.transaction(() => {
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

    for (const contact of ContactForm.DEFAULT_SAMPLES) {
      insertContactForm.run({
        id: contact.id,
        title: contact.title,
        received_date: contact.receivedDate,
        urgency: contact.urgency,
        status: contact.status,
        content: contact.content,
        expect_reply_date: contact.expectReplyDate,
        root_id: contact.id,
        created_at: contact.createdAt,
      })

      for (const projectNo of contact.projectNos) {
        if (!projectNos.has(projectNo)) continue
        insertContactProject.run({
          contact_form_id: contact.id,
          project_no: projectNo,
        })
      }
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

  seed()
}

export function replaceBoardBizData(db: Database.Database) {
  db.exec('DELETE FROM contact_form_pdfs')
  db.exec('DELETE FROM contact_form_projects')
  db.exec('DELETE FROM contact_forms')
  db.exec('DELETE FROM project_personnel')
  db.exec('DELETE FROM project_natures')
  db.exec('DELETE FROM projects')
  seedBoardBizData(db)
}

export function replaceBoardData(db: Database.Database) {
  replaceBoardPersonnelData(db)
  replaceBoardBizData(db)
}

export function shouldReplaceBoardBizData(db: Database.Database) {
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='contact_forms'").get()) {
    return false
  }

  const contactCount = (
    db.prepare('SELECT COUNT(*) AS count FROM contact_forms').get() as { count: number }
  ).count
  const personnelCount = (
    db.prepare('SELECT COUNT(*) AS count FROM personnel').get() as { count: number }
  ).count

  return (
    contactCount < BOARD_IMPORT_META.contacts ||
    personnelCount !== BOARD_IMPORT_META.personnel
  )
}
