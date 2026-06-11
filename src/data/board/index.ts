import type { ContactRecord } from '../../models/biz/contact'
import type { ProjectRecord } from '../../models/biz/project'
import type { PersonnelRecord } from '../../models/personnel'
import contactsJson from './contacts.json'
import projectsJson from './projects.json'
import personnelJson from './personnel.json'
import metaJson from './meta.json'

export interface BoardImportMeta {
  source: string
  importedAt: string
  rawRows: number
  contacts: number
  projects: number
  personnel: number
}

export const BOARD_CONTACTS = contactsJson as ContactRecord[]
export const BOARD_PROJECTS = projectsJson as ProjectRecord[]
export const BOARD_PERSONNEL = personnelJson as PersonnelRecord[]
export const BOARD_IMPORT_META = metaJson as BoardImportMeta
