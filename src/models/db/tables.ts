export const DB_TABLES = {
  personnel: 'personnel',
  permissions: 'permissions',
  roles: 'roles',
  rolePermissions: 'role_permissions',
  rolePersonnel: 'role_personnel',
  projects: 'projects',
  contactForms: 'contact_forms',
  contactFormProjects: 'contact_form_projects',
  contactFormPdfs: 'contact_form_pdfs',
} as const

export const DB_PATH = 'server/datas/steeltech.db'

export const CONTACT_PDF_DIR = 'datas/files/contact-pdfs'
