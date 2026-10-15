import type { FormRules } from 'element-plus'

export type PersonnelStatus = 'active' | 'inactive' | 'leave'
export type PersonnelNationality = '中国' | '印度尼西亚'

export interface PersonnelRecord {
  id: string
  name: string
  employeeNo: string
  idCardNo: string
  passportNo: string
  passportExpiry: string
  position: string
  nationality: PersonnelNationality
  workshop: string
  team: string
  birthDate: string
  age: number
  gender: string
  ethnicity: string
  nativePlace: string
  education: string
  homeAddress: string
  graduationSchool: string
  major: string
  indonesiaPhone: string
  domesticPhone: string
  dormitoryNo: string
  status: PersonnelStatus
}

export interface PersonnelFilterParams {
  keyword?: string
  status?: string
}

export interface PersonnelSelectOption {
  id: string
  name: string
  team: string
}

export interface PersonnelRecordGroup {
  key: string
  label: string
  members: PersonnelRecord[]
}

export type PersonnelGroupBy = '' | 'team' | 'nationality' | 'dormitory'

export type PersonnelDormitoryZone = 'B' | 'N' | 'other'

export type PersonnelFormData = PersonnelRecord

export class PersonnelForm {
  static readonly WORKSHOP = '钢结构技术科' as const
  static readonly WORKSHOP_DEV = '开发人员' as const

  /** 班组 → 默认科室 */
  static readonly TEAM_WORKSHOP_MAP: Record<string, string> = {
    设计组: PersonnelForm.WORKSHOP,
    细化组: PersonnelForm.WORKSHOP,
    开发组: PersonnelForm.WORKSHOP_DEV,
  }

  static readonly WORKSHOP_ORDER = [
    PersonnelForm.WORKSHOP,
    PersonnelForm.WORKSHOP_DEV,
  ] as const

  static readonly STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    LEAVE: 'leave',
  } as const

  static readonly STATUS_OPTIONS = [
    { label: '全部', value: '' },
    { label: '在职', value: PersonnelForm.STATUS.ACTIVE },
    { label: '离职', value: PersonnelForm.STATUS.INACTIVE },
    { label: '休假', value: PersonnelForm.STATUS.LEAVE },
  ]

  static readonly TEAM_OPTIONS = [
    { label: '设计组', value: '设计组' },
    { label: '细化组', value: '细化组' },
    { label: '开发组', value: '开发组' },
  ] as const

  static resolveWorkshopByTeam(team = '', fallback: string = PersonnelForm.WORKSHOP) {
    const mapped = PersonnelForm.TEAM_WORKSHOP_MAP[team.trim()]
    return mapped || fallback || PersonnelForm.WORKSHOP
  }

  static readonly NATIONALITY = {
    CHINA: '中国',
    INDONESIA: '印度尼西亚',
  } as const

  static readonly NATIONALITY_OPTIONS = [
    { label: '中国', value: PersonnelForm.NATIONALITY.CHINA },
    { label: '印度尼西亚', value: PersonnelForm.NATIONALITY.INDONESIA },
  ] as const

  static readonly GROUP_BY_OPTIONS = [
    { label: '列表', value: '' as PersonnelGroupBy },
    { label: '按班组', value: 'team' as PersonnelGroupBy },
    { label: '按国籍', value: 'nationality' as PersonnelGroupBy },
    { label: '按宿舍', value: 'dormitory' as PersonnelGroupBy },
  ] as const

  static readonly B_BUILDINGS = ['B3', 'B4', 'B5', 'B7'] as const
  static readonly N_BUILDINGS = [
    'N1',
    'N2',
    'N3',
    'N4',
    'N5',
    'N6',
    'N7',
    'N8',
    'N9',
    'N10',
    'N11',
  ] as const

  static readonly DORMITORY_ZONE_LABELS: Record<PersonnelDormitoryZone, string> = {
    B: 'B栋宿舍（6层）',
    N: 'N栋宿舍（3层）',
    other: '其他宿舍',
  }

  static readonly DORMITORY_ZONE_ORDER: PersonnelDormitoryZone[] = ['B', 'N', 'other']

  static readonly GENDER_OPTIONS = ['男', '女'] as const

  static readonly FORM_RULES: FormRules = {
    name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
    employeeNo: [{ required: true, message: '请输入工号', trigger: 'blur' }],
    nationality: [{ required: true, message: '请选择国籍', trigger: 'change' }],
    status: [{ required: true, message: '请选择状态', trigger: 'change' }],
  }

  static readonly STATUS_MAP: Record<
    PersonnelStatus,
    { label: string; type: 'primary' | 'success' | 'info' }
  > = {
    active: { label: '在职', type: 'success' },
    inactive: { label: '离职', type: 'info' },
    leave: { label: '休假', type: 'primary' },
  }

  static isLeadershipPosition(position = '') {
    return position.includes('组长') || position.includes('科长')
  }

  static getPositionTagType(position = ''): 'warning' | 'primary' | undefined {
    if (position.includes('科长')) return 'warning'
    if (position.includes('组长')) return 'primary'
    return undefined
  }

  static buildDormitoryNo(building: string, floor: number, room: number) {
    return `${building}_${floor}${String(room).padStart(2, '0')}`
  }

  static parseDormitoryNo(dormitoryNo: string) {
    const match = dormitoryNo.match(/^([BN]\d+)_(\d)(\d{2})$/)
    if (!match) return null

    const [, building, floorText, roomText] = match
    return {
      building: building!,
      floor: Number(floorText),
      room: Number(roomText),
      zone: PersonnelForm.getDormitoryZone(dormitoryNo),
    }
  }

  static getDormitoryZone(dormitoryNo: string): PersonnelDormitoryZone {
    if (dormitoryNo.startsWith('B')) return 'B'
    if (dormitoryNo.startsWith('N')) return 'N'
    return 'other'
  }

  static formatDormitoryNo(dormitoryNo: string) {
    const parsed = PersonnelForm.parseDormitoryNo(dormitoryNo)
    if (!parsed) return dormitoryNo

    const floorLabel = parsed.zone === 'B' ? '6层' : '3层'
    return `${parsed.building}栋 ${parsed.floor}楼 ${String(parsed.room).padStart(2, '0')}室（${floorLabel}宿舍）`
  }

  static sample(
    id: string,
    name: string,
    team: '设计组' | '细化组' | '开发组',
    overrides: Partial<PersonnelRecord> = {},
  ): PersonnelRecord {
    const index = Number(id.replace('PER', ''))
    const isDesign = team === '设计组'
    const nationality: PersonnelNationality = PersonnelForm.NATIONALITY.CHINA
    const dormitoryNo =
      index <= 11
        ? PersonnelForm.buildDormitoryNo(
            PersonnelForm.B_BUILDINGS[index % PersonnelForm.B_BUILDINGS.length]!,
            (index % 6) + 1,
            (index % 12) + 1,
          )
        : PersonnelForm.buildDormitoryNo(
            PersonnelForm.N_BUILDINGS[(index - 12) % PersonnelForm.N_BUILDINGS.length]!,
            ((index - 12) % 3) + 1,
            (index % 10) + 1,
          )

    return {
      id,
      name,
      employeeNo: `4260${String(5000 + index)}`,
      idCardNo: `50010419${String(800000 + index)}`,
      passportNo: `ER39${String(10000 + index)}`,
      passportExpiry: '2035-12-31',
      position: isDesign ? '设计工程师' : '细化工程师',
      nationality,
      workshop: PersonnelForm.resolveWorkshopByTeam(team),
      team,
      birthDate: `199${index % 10}-${String((index % 12) + 1).padStart(2, '0')}-15`,
      age: 28 + (index % 12),
      gender: index % 3 === 0 ? '女' : '男',
      ethnicity: '汉族',
      nativePlace: '重庆市',
      education: index % 2 === 0 ? '本科' : '研究生',
      homeAddress: `重庆市渝北区示例路 ${index} 号`,
      graduationSchool: index % 2 === 0 ? '重庆大学' : '西南交通大学',
      major: isDesign ? '土木工程' : '机械工程',
      indonesiaPhone: `0819348313${String(30 + index).padStart(2, '0')}`,
      domesticPhone: `1380000${String(1000 + index)}`,
      dormitoryNo,
      status: 'active',
      ...overrides,
    }
  }

  static createEmptyForm(): PersonnelFormData {
    return {
      id: '',
      name: '',
      employeeNo: '',
      idCardNo: '',
      passportNo: '',
      passportExpiry: '',
      position: '',
      nationality: PersonnelForm.NATIONALITY.CHINA,
      workshop: PersonnelForm.WORKSHOP,
      team: '',
      birthDate: '',
      age: 0,
      gender: '',
      ethnicity: '',
      nativePlace: '',
      education: '',
      homeAddress: '',
      graduationSchool: '',
      major: '',
      indonesiaPhone: '',
      domesticPhone: '',
      dormitoryNo: '',
      status: 'active',
    }
  }

  readonly record: PersonnelRecord

  constructor(record: PersonnelRecord) {
    this.record = record
  }

  static wrap(record: PersonnelRecord) {
    return new PersonnelForm(record)
  }

  static cloneRecord(record: PersonnelRecord): PersonnelRecord {
    return { ...record }
  }

  static createFormFromRecord(record: PersonnelRecord): PersonnelFormData {
    return PersonnelForm.cloneRecord(record)
  }

  applyForm(form: PersonnelFormData) {
    Object.assign(this.record, form, {
      workshop: PersonnelForm.resolveWorkshopByTeam(form.team, form.workshop),
    })
  }

  static cloneSamples(data: PersonnelRecord[]) {
    return data.map((item) => PersonnelForm.cloneRecord(item))
  }

  static groupRecords(
    records: PersonnelRecord[],
    groupBy: PersonnelGroupBy,
  ): PersonnelRecordGroup[] {
    if (!groupBy) return []

    if (groupBy === 'team') {
      return PersonnelForm.groupByField(
        records,
        (record) => record.team,
        PersonnelForm.TEAM_OPTIONS.map((item) => item.value),
      )
    }

    if (groupBy === 'nationality') {
      return PersonnelForm.groupByField(
        records,
        (record) => record.nationality,
        PersonnelForm.NATIONALITY_OPTIONS.map((item) => item.value),
      )
    }

    return PersonnelForm.groupByField(
      records,
      (record) => PersonnelForm.getDormitoryZone(record.dormitoryNo),
      PersonnelForm.DORMITORY_ZONE_ORDER,
      (key) => PersonnelForm.DORMITORY_ZONE_LABELS[key as PersonnelDormitoryZone] ?? key,
    )
  }

  private static groupByField(
    records: PersonnelRecord[],
    getKey: (record: PersonnelRecord) => string,
    orderedKeys: readonly string[],
    getLabel?: (key: string) => string,
  ): PersonnelRecordGroup[] {
    const groups = new Map<string, PersonnelRecord[]>()

    for (const record of records) {
      const key = getKey(record)
      const members = groups.get(key) ?? []
      members.push(record)
      groups.set(key, members)
    }

    const extraKeys = [...groups.keys()].filter((key) => !orderedKeys.includes(key))
    const keySequence = [...orderedKeys, ...extraKeys]

    return keySequence
      .map((key) => ({
        key,
        label: getLabel?.(key) ?? key,
        members: (groups.get(key) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
      }))
      .filter((group) => group.members.length > 0)
  }

  static filter(
    records: PersonnelRecord[],
    { keyword = '', status = '' }: PersonnelFilterParams = {},
  ) {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return records.filter((item) => {
      const searchableText = [
        item.id,
        item.name,
        item.employeeNo,
        item.idCardNo,
        item.passportNo,
        item.position,
        item.nationality,
        item.workshop,
        item.team,
        item.gender,
        item.ethnicity,
        item.nativePlace,
        item.education,
        item.homeAddress,
        item.graduationSchool,
        item.major,
        item.indonesiaPhone,
        item.domesticPhone,
        item.dormitoryNo,
      ]
        .join(' ')
        .toLowerCase()

      const matchKeyword = !normalizedKeyword || searchableText.includes(normalizedKeyword)
      const matchStatus = !status || item.status === status
      return matchKeyword && matchStatus
    })
  }

  static readonly EMPTY_WORKSHOP_KEY = '__empty_workshop__'

  static normalizeWorkshopKey(workshop = '') {
    const text = workshop.trim()
    return text || PersonnelForm.EMPTY_WORKSHOP_KEY
  }

  static formatWorkshopLabel(workshopKey: string) {
    if (workshopKey === PersonnelForm.EMPTY_WORKSHOP_KEY || !workshopKey.trim()) {
      return '未分配科室'
    }
    return workshopKey
  }

  /** 按车间/科室生成 Tab，默认科室优先，其余按名称排序 */
  static collectWorkshopTabs(records: PersonnelRecord[]) {
    const counts = new Map<string, number>()
    for (const record of records) {
      const key = PersonnelForm.normalizeWorkshopKey(record.workshop)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const preferredOrder = PersonnelForm.WORKSHOP_ORDER as readonly string[]
    const keys = [...counts.keys()].sort((a, b) => {
      const aPreferred = preferredOrder.indexOf(a)
      const bPreferred = preferredOrder.indexOf(b)
      if (aPreferred !== -1 || bPreferred !== -1) {
        if (aPreferred === -1) return 1
        if (bPreferred === -1) return -1
        return aPreferred - bPreferred
      }
      if (a === PersonnelForm.EMPTY_WORKSHOP_KEY) return 1
      if (b === PersonnelForm.EMPTY_WORKSHOP_KEY) return -1
      return a.localeCompare(b, 'zh-CN')
    })

    return keys.map((key) => ({
      key,
      label: PersonnelForm.formatWorkshopLabel(key),
      count: counts.get(key) ?? 0,
    }))
  }

  static filterByWorkshop(records: PersonnelRecord[], workshopKey: string) {
    if (!workshopKey) return records
    return records.filter(
      (record) => PersonnelForm.normalizeWorkshopKey(record.workshop) === workshopKey,
    )
  }

  static formatSelectLabel(person: Pick<PersonnelSelectOption, 'name' | 'team'>) {
    return `${person.name} · ${person.team}`
  }

  static buildAssignSelectOptions(
    personnel: PersonnelSelectOption[],
    extraAssignees: PersonnelSelectOption[] = [],
  ): PersonnelSelectOption[] {
    const optionMap = new Map<string, PersonnelSelectOption>()

    for (const person of personnel) {
      optionMap.set(person.id, person)
    }

    for (const person of extraAssignees) {
      if (!optionMap.has(person.id)) {
        optionMap.set(person.id, person)
      }
    }

    return [...optionMap.values()].sort((a, b) => {
      const teamCompare = a.team.localeCompare(b.team, 'zh-CN')
      return teamCompare !== 0 ? teamCompare : a.name.localeCompare(b.name, 'zh-CN')
    })
  }

  static filterAssignSelectOptions(
    options: PersonnelSelectOption[],
    team = '',
  ): PersonnelSelectOption[] {
    if (!team) return options
    return options.filter((person) => person.team === team)
  }

  static collectTeamFilterOptions(options: PersonnelSelectOption[]) {
    const teams = [...new Set(options.map((person) => person.team).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'zh-CN'),
    )
    return [{ label: '全部班组', value: '' }, ...teams.map((team) => ({ label: team, value: team }))]
  }
}
