import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import type { ContactRecord, ContactStatus } from '../../src/models/biz/contact/ContactForm.ts'
import { BusinessSystemConfig } from '../../src/models/biz/BusinessSystemConfig.ts'
import type { ProjectNatureCode, ProjectRecord, ProjectStatus } from '../../src/models/biz/project/ProjectForm.ts'
import { PersonnelForm } from '../../src/models/personnel/PersonnelForm.ts'
import type { PersonnelRecord } from '../../src/models/personnel/PersonnelForm.ts'
import { PROJECT_ROOT, SERVER_BOARD_XLSX_PATH } from '../paths.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = PROJECT_ROOT
const xlsxPath = SERVER_BOARD_XLSX_PATH
const outputDir = path.join(rootDir, 'src', 'data', 'board')

type RawRow = {
  rowIndex: number
  receivedDate: string
  category: string
  projectNos: string[]
  contactRawId: string
  title: string
  structureType: string
  workload: string
  statusText: string
  remark: string
  filePath: string
  leadNames: string[]
}

type ContactGroup = {
  id: string
  rows: RawRow[]
}

type ProjectAccumulator = {
  projectNo: string
  name: string
  contactFormIds: Set<string>
  natures: Set<ProjectNatureCode>
  status: ProjectStatus
  receivedDate: string
  earliestReceivedDate: string
  leadNames: Set<string>
  category: string
  localWorkPath: string
}

type LeadProfile = {
  name: string
  team: '设计组' | '细化组'
  projectCount: number
}

function parseExcelDate(value: unknown): string {
  if (!value) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    if (value.getFullYear() > 2100) return ''
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return ''
    const yyyy = parsed.y
    if (yyyy > 2100) return ''
    const mm = String(parsed.m).padStart(2, '0')
    const dd = String(parsed.d).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  return text
}

function parseProjectNos(value: unknown): string[] {
  if (!value) return []
  const text = String(value).trim()
  if (!text) return []
  const matches = text.toUpperCase().match(/[A-Z]{2,3}\d{4,6}/g)
  return matches ? [...new Set(matches)] : []
}

function parseLeadNames(value: unknown): string[] {
  if (!value) return []
  return String(value)
    .split(/[,，、/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeText(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function mapContactStatus(statusText: string): ContactStatus {
  switch (statusText) {
    case '已完成':
      return 'done'
    case '进行中':
      return 'processing'
    case '已取消':
      return 'cancelled'
    case '项目暂停':
    case '未开始':
    default:
      return 'pending'
  }
}

function mapProjectStatus(statusText: string): ProjectStatus {
  switch (statusText) {
    case '已完成':
      return 'done'
    case '已取消':
      return 'paused'
    case '项目暂停':
      return 'paused'
    case '进行中':
    case '未开始':
    default:
      return 'active'
  }
}

function mapNatures(category: string): ProjectNatureCode[] {
  if (!category) return []
  const natures = new Set<ProjectNatureCode>()
  if (category.includes('设计')) natures.add('design')
  if (
    category.includes('细化') ||
    category.includes('加工单') ||
    category.includes('排版') ||
    category.includes('楼层板') ||
    category.includes('瓦片')
  ) {
    natures.add('detail')
  }
  if (category.includes('设计') && !natures.has('detail') && category.includes('问题处理')) {
    natures.add('design')
  }
  return [...natures]
}

function buildContent(row: RawRow): string {
  const parts: string[] = []
  if (row.category) parts.push(`项目分类：${row.category}`)
  if (row.structureType) parts.push(`结构形式：${row.structureType}`)
  if (row.workload) parts.push(`工程量：${row.workload}`)
  if (row.remark) parts.push(`备注：${row.remark}`)
  if (row.filePath) parts.push(`路径：${row.filePath}`)
  if (row.leadNames.length) parts.push(`项目负责人：${row.leadNames.join('、')}`)
  if (parts.length) return parts.join('\n')
  return row.title || '联系单看板导入'
}

function formatDateTime(dateText: string): string {
  if (!dateText) return ''
  return `${dateText} 09:00:00`
}

function collectLeadProfiles(rawRows: RawRow[]): LeadProfile[] {
  const stats = new Map<string, { design: number; detail: number; both: number }>()

  for (const row of rawRows) {
    const natures = mapNatures(row.category)
    const isDesign = natures.includes('design')
    const isDetail = natures.includes('detail')

    for (const name of row.leadNames) {
      const current = stats.get(name) ?? { design: 0, detail: 0, both: 0 }
      if (isDesign && isDetail) current.both += 1
      else if (isDesign) current.design += 1
      else if (isDetail) current.detail += 1
      stats.set(name, current)
    }
  }

  return [...stats.entries()]
    .map(([name, counts]) => ({
      name,
      team: counts.detail > counts.design ? '细化组' : '设计组',
      projectCount: counts.design + counts.detail + counts.both,
    }))
    .sort((a, b) => {
      if (a.team !== b.team) return a.team === '设计组' ? -1 : 1
      return b.projectCount - a.projectCount
    })
}

function buildPersonnel(profiles: LeadProfile[]): PersonnelRecord[] {
  return profiles.map((profile, index) => {
    const id = `PER${String(index + 1).padStart(3, '0')}`
    const isDesign = profile.team === '设计组'

    const overrides: Partial<PersonnelRecord> = {
      position:
        profile.name === '陈魏'
          ? '钢结构技术副科长'
          : profile.name === '王少鑫'
            ? '设计组组长'
            : profile.name === '杨茂林'
              ? '细化组组长'
              : isDesign
                ? '设计工程师'
                : '细化工程师',
    }

    if (profile.name === '王少鑫') {
      overrides.employeeNo = '424051037'
    }

    if (profile.name.toUpperCase() === 'DILA') {
      overrides.nationality = PersonnelForm.NATIONALITY.INDONESIA
    }

    return PersonnelForm.sample(id, profile.name, profile.team, overrides)
  })
}

function buildPersonnelNameMap(personnel: PersonnelRecord[]) {
  return new Map(personnel.map((person) => [person.name, person.id]))
}

function resolvePersonnelIds(
  leadNames: string[],
  personnelByName: Map<string, string>,
): string[] {
  const ids = new Set<string>()
  for (const name of leadNames) {
    const id = personnelByName.get(name)
    if (id) ids.add(id)
  }
  return [...ids]
}

function getContactGroupKey(contactRawId: string, rowIndex: number): string {
  const normalized = contactRawId.trim()
  if (/^DTP\d+$/i.test(normalized)) return normalized.toUpperCase()
  return `ROW_${rowIndex}`
}

function buildContactId(groupKey: string, row: RawRow): string {
  if (/^DTP\d+$/i.test(groupKey)) return groupKey.toUpperCase()
  const suffix = row.projectNos[0] || String(row.rowIndex).padStart(4, '0')
  const datePart = row.receivedDate.replace(/-/g, '').slice(2) || '000000'
  return `BRD${datePart}${suffix.replace(/[^A-Z0-9]/gi, '').slice(-6)}${String(row.rowIndex).padStart(4, '0')}`
}

function readRawRows(): RawRow[] {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`找不到 Excel 文件: ${xlsxPath}`)
  }

  const workbook = XLSX.readFile(xlsxPath, { cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]!]
  if (!sheet) throw new Error('Excel 中没有可用工作表')

  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })

  const rows: RawRow[] = []
  for (let index = 1; index < matrix.length; index += 1) {
    const line = matrix[index] ?? []
    const receivedDate = parseExcelDate(line[0])
    const category = normalizeText(line[1])
    const projectNos = parseProjectNos(line[2])
    const contactRawId = normalizeText(line[3])
    const title = normalizeText(line[4])
    const structureType = normalizeText(line[5])
    const workload = normalizeText(line[6])
    const statusText = normalizeText(line[7])
    const remark = normalizeText(line[8])
    const filePath = normalizeText(line[9])
    const leadNames = parseLeadNames(line[10])

    if (!title && !projectNos.length && !contactRawId && !category) continue
    if (!title && !projectNos.length && !/^DTP\d+$/i.test(contactRawId)) continue

    rows.push({
      rowIndex: index + 1,
      receivedDate,
      category,
      projectNos,
      contactRawId,
      title,
      structureType,
      workload,
      statusText,
      remark,
      filePath,
      leadNames,
    })
  }

  return rows
}

function groupRows(rawRows: RawRow[]): ContactGroup[] {
  const groups = new Map<string, ContactGroup>()

  for (const row of rawRows) {
    const groupKey = getContactGroupKey(row.contactRawId, row.rowIndex)
    const existing = groups.get(groupKey)
    if (existing) {
      existing.rows.push(row)
      continue
    }
    groups.set(groupKey, {
      id: buildContactId(groupKey, row),
      rows: [row],
    })
  }

  return [...groups.values()]
}

function mergeContact(group: ContactGroup): ContactRecord {
  const sortedRows = [...group.rows].sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))
  const primary = sortedRows[0] ?? group.rows[0]!
  const projectNos = [...new Set(group.rows.flatMap((row) => row.projectNos))]
  const receivedDate =
    [...group.rows]
      .map((row) => row.receivedDate)
      .filter(Boolean)
      .sort()[0] ||
    primary.receivedDate ||
    '2026-01-01'

  const status =
    sortedRows.find((row) => row.statusText === '进行中')?.statusText ||
    sortedRows.find((row) => row.statusText === '未开始')?.statusText ||
    primary.statusText

  return {
    id: group.id,
    title: primary.title || projectNos.join('、') || group.id,
    projectNos,
    receivedDate,
    urgency: primary.statusText === '进行中' ? '紧急' : '普通',
    status: mapContactStatus(status),
    content: buildContent(primary),
    expectReplyDate: '',
    attachments: [],
    createdAt: formatDateTime(receivedDate),
  }
}

function buildProjects(
  contacts: ContactRecord[],
  rawRows: RawRow[],
  personnelByName: Map<string, string>,
): ProjectRecord[] {
  const projectMap = new Map<string, ProjectAccumulator>()

  const upsertFromRow = (row: RawRow, contactId?: string) => {
    for (const projectNo of row.projectNos) {
      const existing = projectMap.get(projectNo)
      const natures = mapNatures(row.category)
      const nextStatus = mapProjectStatus(row.statusText)

      if (!existing) {
        projectMap.set(projectNo, {
          projectNo,
          name: row.title || projectNo,
          contactFormIds: new Set(contactId ? [contactId] : []),
          natures: new Set(natures),
          status: nextStatus,
          receivedDate: row.receivedDate,
          earliestReceivedDate: row.receivedDate,
          leadNames: new Set(row.leadNames),
          category: row.category,
          localWorkPath: BusinessSystemConfig.normalizeRelativePath(row.filePath),
        })
        continue
      }

      if (row.title) existing.name = row.title
      if (row.filePath) {
        const normalized = BusinessSystemConfig.normalizeRelativePath(row.filePath)
        if (normalized) existing.localWorkPath = normalized
      }
      if (contactId) existing.contactFormIds.add(contactId)
      for (const nature of natures) existing.natures.add(nature)
      for (const lead of row.leadNames) existing.leadNames.add(lead)
      if (row.category) existing.category = row.category
      if (row.receivedDate) {
        if (!existing.earliestReceivedDate || row.receivedDate < existing.earliestReceivedDate) {
          existing.earliestReceivedDate = row.receivedDate
        }
        if (!existing.receivedDate || row.receivedDate > existing.receivedDate) {
          existing.receivedDate = row.receivedDate
        }
      }
      if (nextStatus === 'active' && existing.status === 'done') {
        existing.status = nextStatus
      } else if (nextStatus === 'paused') {
        existing.status = nextStatus
      }
    }
  }

  for (const row of rawRows) {
    const groupKey = getContactGroupKey(row.contactRawId, row.rowIndex)
    const contactId = /^DTP\d+$/i.test(groupKey)
      ? groupKey.toUpperCase()
      : buildContactId(groupKey, row)
    upsertFromRow(row, contactId)
  }

  for (const contact of contacts) {
    for (const projectNo of contact.projectNos) {
      const existing = projectMap.get(projectNo)
      if (existing) {
        existing.contactFormIds.add(contact.id)
      }
    }
  }

  return [...projectMap.values()]
    .sort((a, b) => a.projectNo.localeCompare(b.projectNo, 'en'))
    .map((item) => {
      const natures = [...item.natures]
      const personnelIds = resolvePersonnelIds([...item.leadNames], personnelByName)

      return {
        projectNo: item.projectNo,
        name: item.name,
        contactFormIds: [...item.contactFormIds],
        customer: '',
        status: item.status,
        natures: natures.length ? natures : mapNatures(item.category),
        assignedPersonnelIds: personnelIds,
        assignedPersonnel: [],
        receivedDate: item.earliestReceivedDate || item.receivedDate,
        plannedStartDate: item.receivedDate,
        plannedEndDate: '',
        actualStartDate: item.status === 'done' ? item.receivedDate : '',
        actualEndDate: item.status === 'done' ? item.receivedDate : '',
        localWorkPath: item.localWorkPath,
      } satisfies ProjectRecord
    })
}

function enrichProjects(
  projects: ProjectRecord[],
  personnel: PersonnelRecord[],
): ProjectRecord[] {
  const personnelMap = new Map(personnel.map((person) => [person.id, person]))

  return projects.map((project) => {
    const assignedPersonnel = project.assignedPersonnelIds
      .map((id) => personnelMap.get(id))
      .filter((person): person is NonNullable<typeof person> => !!person)
      .map((person) => ({
        id: person.id,
        name: person.name,
        team: person.team,
      }))

    return {
      ...project,
      assignedPersonnel,
      customer: assignedPersonnel.map((person) => person.name).join('、'),
    }
  })
}

function main() {
  const rawRows = readRawRows()
  const groups = groupRows(rawRows)
  const contacts = groups
    .map(mergeContact)
    .filter((contact) => contact.projectNos.length > 0 || /^DTP\d+$/i.test(contact.id))
    .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))
  const leadProfiles = collectLeadProfiles(rawRows)
  const personnel = buildPersonnel(leadProfiles)
  const personnelByName = buildPersonnelNameMap(personnel)
  const projects = enrichProjects(buildProjects(contacts, rawRows, personnelByName), personnel)

  fs.mkdirSync(outputDir, { recursive: true })

  const contactsPath = path.join(outputDir, 'contacts.json')
  const projectsPath = path.join(outputDir, 'projects.json')
  const personnelPath = path.join(outputDir, 'personnel.json')
  const metaPath = path.join(outputDir, 'meta.json')

  fs.writeFileSync(contactsPath, `${JSON.stringify(contacts, null, 2)}\n`, 'utf-8')
  fs.writeFileSync(projectsPath, `${JSON.stringify(projects, null, 2)}\n`, 'utf-8')
  fs.writeFileSync(personnelPath, `${JSON.stringify(personnel, null, 2)}\n`, 'utf-8')
  fs.writeFileSync(
    metaPath,
    `${JSON.stringify(
      {
        source: 'server/datas/联系单看板.xlsx',
        importedAt: new Date().toISOString(),
        rawRows: rawRows.length,
        contacts: contacts.length,
        projects: projects.length,
        personnel: personnel.length,
      },
      null,
      2,
    )}\n`,
    'utf-8',
  )

  console.log(`已导入联系单看板数据:`)
  console.log(`- 原始行: ${rawRows.length}`)
  console.log(`- 联系单: ${contacts.length} -> ${contactsPath}`)
  console.log(`- 项目: ${projects.length} -> ${projectsPath}`)
  console.log(`- 人员: ${personnel.length} -> ${personnelPath}`)
}

main()
