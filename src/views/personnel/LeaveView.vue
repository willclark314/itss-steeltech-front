<script setup lang="ts">
/**
 * 人员休假年历页
 *
 * 数据流：loadPersonnel（一次性）→ loadCalendarData（按年刷新）
 * 工具栏人员按钮在首次加载后固定；换年只更新 disable 态与日历，不增删按钮。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchPersonnelList } from '@/api/personnel'
import { PersonnelForm, PersonnelLeaveForm } from '@/models/personnel'
import type {
  CalendarDayCell,
  CalendarMonth,
  LeaveEntryStatus,
  LeaveEntryType,
  PersonnelLeavePolicy,
  PersonnelRecord,
  TeamGroupItem,
} from '@/models/personnel'
import {
  fetchLeaveCalendar,
  fetchLeaveScope,
  fetchMyLeaveCalendar,
  savePolicy,
  type LeaveCalendarResponse,
  type LeaveEntryDTO,
  type LeaveScope,
} from '@/api/leave'
import LeaveEditDialog from '@/components/personnel/LeaveEditDialog.vue'
import LeaveYearCalendarPanel from '@/components/personnel/LeaveYearCalendarPanel.vue'
import { getUser, isAdminUser } from '@/utils/auth'

const teamOptions = PersonnelForm.TEAM_OPTIONS

/** 后端确认的可见范围（避免 localStorage 角色与 JWT 不一致导致先加载全员） */
const scope = ref<LeaveScope | null>(null)
const scopeLoading = ref(true)
/** 初始化时固定的页面角色，避免 scope 响应式更新与异步请求竞态 */
const pageRole = ref<'admin' | 'member'>('member')
/** 页面视图模式：pending 期间不挂载任何业务 DOM */
const viewMode = ref<'pending' | 'admin' | 'member'>('pending')

const isPageAdmin = computed(() => viewMode.value === 'admin')
const scopedPersonnelId = computed(() => scope.value?.personnelId ?? '')

function filterEntriesForScope<T extends { personnelId: string }>(entries: T[]): T[] {
  if (isPageAdmin.value) return entries
  const pid = scopedPersonnelId.value
  if (!pid) return []
  return entries.filter((entry) => entry.personnelId === pid)
}

/** 普通员工视图：数据校验通过后才为 true，避免挂载日历前闪现他人数据 */
const memberReady = ref(false)
/** 普通员工日历快照（仅 actualEntries，一次性赋值，避免 reactive 中间态） */
const memberCalendarSnapshot = shallowRef<CalendarMonth[] | null>(null)
const memberDtoLookup = shallowRef(new Map<string, LeaveEntryDTO>())

const emptyMonthPersonnelIds = new Set<string>()

function calendarPersonToRecord(
  person: LeaveCalendarResponse['personnel'][number],
): PersonnelRecord {
  return {
    id: person.id,
    name: person.name,
    employeeNo: person.employeeNo,
    idCardNo: '',
    passportNo: '',
    passportExpiry: '',
    position: person.position || '',
    nationality: (person.nationality || '中国') as PersonnelRecord['nationality'],
    workshop: PersonnelForm.WORKSHOP,
    team: person.team || '',
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
    status: (person.status || 'active') as PersonnelRecord['status'],
  }
}

/** 客户端二次过滤，确保普通员工日历中不会出现他人记录 */
function sanitizeMemberCalendar(
  data: LeaveCalendarResponse,
  personnelId: string,
): LeaveCalendarResponse {
  return {
    ...data,
    personnel: data.personnel.filter((person) => person.id === personnelId),
    policies: data.policies.filter((policy) => policy.personnelId === personnelId),
    actualEntries: data.actualEntries.filter((entry) => entry.personnelId === personnelId),
    computedEntries: data.computedEntries.filter((entry) => entry.personnelId === personnelId),
  }
}

function applyCalendarLookup(data: LeaveCalendarResponse) {
  const lookup = new Map<string, LeaveEntryDTO>()
  for (const dto of data.actualEntries) {
    lookup.set(dto.id, dto)
  }
  for (const dto of data.computedEntries) {
    lookup.set(dto.id, dto)
  }
  dtoLookup.value = lookup
}

function applyMemberDtoLookup(entries: LeaveEntryDTO[]) {
  const lookup = new Map<string, LeaveEntryDTO>()
  for (const dto of entries) {
    lookup.set(dto.id, dto)
  }
  memberDtoLookup.value = lookup
}

/** 无实际记录时合并一段假设初始休假（推算值，不入库） */
function resolveMemberDisplayEntries(
  data: LeaveCalendarResponse,
  displayYear: number,
): LeaveDisplayEntry[] {
  const actualEntries = data.actualEntries.map(dtoToEntry)
  if (actualEntries.length > 0) return actualEntries

  let computedEntries: LeaveDisplayEntry[] = data.computedEntries.map(dtoToEntry)
  if (!computedEntries.length && data.personnel.length) {
    const policies: PersonnelLeavePolicy[] = data.policies.length
      ? data.policies.map(calendarPolicyToFormPolicy)
      : PersonnelLeaveForm.generatePolicies(data.personnel.map((person) => ({ id: person.id })))
    computedEntries = PersonnelLeaveForm.buildAllEntries(policies, displayYear).map(
      leaveEntryToDisplayEntry,
    )
  }
  if (!computedEntries.length) return actualEntries

  const today = data.today || new Date().toISOString().slice(0, 10)
  const yearStart = `${displayYear}-01-01`
  const yearEnd = `${displayYear}-12-31`
  const inYear = computedEntries
    .filter((entry) => entry.startDate <= yearEnd && entry.endDate >= yearStart)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const upcoming = inYear.filter((entry) => entry.endDate >= today)
  const initialLeave = upcoming[0] ?? inYear[0]
  return initialLeave ? [initialLeave] : actualEntries
}

/** 普通员工：有实际记录仅展示实际；无记录时展示一段假设初始休假 */
function buildMemberCalendarSnapshot(
  data: LeaveCalendarResponse,
  displayYear: number,
): CalendarMonth[] {
  const records = data.personnel.map(calendarPersonToRecord)
  const entries = resolveMemberDisplayEntries(data, displayYear)
  const rows = PersonnelLeaveForm.buildTableRows(entries, records, { year: displayYear })
  return PersonnelLeaveForm.buildYearCalendar(displayYear, rows)
}

function entryToMemberDto(
  entry: LeaveDisplayEntry,
  data: LeaveCalendarResponse,
): LeaveEntryDTO {
  const existing =
    data.actualEntries.find((dto) => dto.id === entry.id) ??
    data.computedEntries.find((dto) => dto.id === entry.id)
  if (existing) return existing

  return {
    id: entry.id,
    personnelId: entry.personnelId,
    type: entry.type as LeaveEntryDTO['type'],
    startDate: entry.startDate,
    endDate: entry.endDate,
    plannedDays: entry.plannedDays ?? 0,
    status: entry.status as LeaveEntryDTO['status'],
    parentEntryId: '',
    reason: entry.reason || '',
    remark: entry.remark || '',
    computed: true,
  }
}

/** 一次性提交员工视图状态，避免 calendarData / memberReady 分步更新导致中间渲染 */
function commitMemberViewState(data: LeaveCalendarResponse, displayYear: number) {
  console.log('🟦 [commitMemberViewState] 接收 data.personnel:', data.personnel.length, '人, actualEntries:', data.actualEntries.length, '条')
  const snapshot = buildMemberCalendarSnapshot(data, displayYear)
  console.log('🟦 [commitMemberViewState] snapshot', snapshot.length, '个月, 第一个月 events 总数:', snapshot[0]?.days.reduce((sum, d) => sum + d.events.length, 0) ?? 0)
  applyMemberPersonnel(data.personnel.map(calendarPersonToRecord))
  const displayEntries = resolveMemberDisplayEntries(data, displayYear)
  applyMemberDtoLookup(displayEntries.map((entry) => entryToMemberDto(entry, data)))
  calendarData.value = data
  loadedCalendarYear.value = displayYear
  useBackend.value = true
  memberCalendarSnapshot.value = snapshot
  memberReady.value = true
}

function applyPersonnelList(list: PersonnelRecord[]) {
  personnelList.value = list
  personnelIds.value = list.map((item) => item.id)
  teamGroups.value = Object.freeze(
    PersonnelLeaveForm.buildTeamGroups(list, teamOptions),
  ) as TeamGroupItem[]
  for (const person of list) {
    if (personVisible[person.id] === undefined) {
      personVisible[person.id] = true
    }
  }
  personnelReady.value = true
}

/** 普通员工：只保留本人，不构建组/按钮相关状态 */
function applyMemberPersonnel(list: PersonnelRecord[]) {
  personnelList.value = list
  personnelIds.value = list.map((item) => item.id)
}

function resetPageState() {
  personnelReady.value = false
  memberReady.value = false
  viewMode.value = 'pending'
  personnelList.value = []
  personnelIds.value = []
  teamGroups.value = Object.freeze([]) as unknown as readonly TeamGroupItem[]
  soloPersonnelId.value = null
  pageRole.value = 'member'
  for (const key of Object.keys(personVisible)) {
    delete personVisible[key]
  }
  calendarData.value = null
  useBackend.value = false
  loadedCalendarYear.value = null
  calendarLoading.value = false
  calendarLoadFailed.value = false
  dtoLookup.value = new Map()
  memberCalendarSnapshot.value = null
  memberDtoLookup.value = new Map()
}

// ── 人员与工具栏 ──
const personnelList = ref<PersonnelRecord[]>([])
const personnelIds = ref<string[]>([])
/** 页面加载后固定，换年不更新 */
const teamGroups = shallowRef<readonly TeamGroupItem[]>([])
const personnelReady = ref(false)

const groupExpanded = reactive<Record<string, boolean>>({
  设计组: true,
  细化组: true,
})

/** 各人员是否在日历中显示（组级开关会批量修改此表） */
const personVisible = reactive<Record<string, boolean>>({})
/** 右键「仅显示」：跨年份保持，换年不清空 */
const soloPersonnelId = ref<string | null>(null)
/** 鼠标悬停姓名时，日历中高亮该人的休假格 */
const hoveredPersonnelId = ref<string | null>(null)

// ── 日历状态 ──
const year = ref(PersonnelLeaveForm.getCurrentYear())
const calendarData = ref<LeaveCalendarResponse | null>(null)
/** calendarData 对应的年份；与 year 不一致时表示正在换年加载中 */
const loadedCalendarYear = ref<number | null>(null)
/** 后端日历可用时为 true；接口失败时回退到前端策略推算（仅管理员） */
const useBackend = ref(false)
const calendarLoading = ref(false)
const calendarLoadFailed = ref(false)
const dtoLookup = ref(new Map<string, LeaveEntryDTO>())
/** 悬停月份标题时，高亮该月有休假的人员 */
const hoveredMonth = ref<number | null>(null)
/** 点击月份标题锁定筛选：只显示该月有休假的人员，跨年份保持 */
const pinnedMonth = ref<number | null>(null)

function dtoToEntry(dto: LeaveEntryDTO) {
  return {
    id: dto.id,
    personnelId: dto.personnelId,
    type: dto.type as LeaveEntryType,
    startDate: dto.startDate,
    endDate: dto.endDate,
    plannedDays: dto.plannedDays,
    actualDays: dto.actualDays ?? undefined,
    status: dto.status as LeaveEntryStatus,
    reason: dto.reason || undefined,
    remark: dto.remark || undefined,
    createdAt: dto.createdAt || '',
  }
}

type LeaveDisplayEntry = ReturnType<typeof dtoToEntry>

function calendarPolicyToFormPolicy(
  policy: LeaveCalendarResponse['policies'][number],
): PersonnelLeavePolicy {
  return {
    id: policy.id,
    personnelId: policy.personnelId,
    workDays: policy.workDays,
    leaveDays: policy.leaveDays,
    cycleStartDate: policy.cycleStartDate,
    effectiveFrom: policy.cycleStartDate,
  }
}

function leaveEntryToDisplayEntry(
  entry: ReturnType<typeof PersonnelLeaveForm.buildAllEntries>[number],
): LeaveDisplayEntry {
  return {
    id: entry.id,
    personnelId: entry.personnelId,
    type: entry.type,
    startDate: entry.startDate,
    endDate: entry.endDate,
    plannedDays: entry.plannedDays,
    actualDays: entry.actualDays,
    status: entry.status,
    reason: entry.reason,
    remark: entry.remark,
    createdAt: entry.createdAt || '',
  }
}

const leaveEntries = computed(() => {
  // 员工视图走 memberCalendarSnapshot，不参与共享 leaveEntries 计算
  if (viewMode.value === 'member') return []
  if (!personnelList.value.length || !scope.value) return []

  const backendReady =
    useBackend.value && calendarData.value && loadedCalendarYear.value === year.value

  if (backendReady) {
    const all: ReturnType<typeof dtoToEntry>[] = []
    for (const dto of calendarData.value!.actualEntries) {
      all.push(dtoToEntry(dto))
    }
    for (const dto of calendarData.value!.computedEntries) {
      all.push(dtoToEntry(dto))
    }
    return filterEntriesForScope(all)
  }

  // 接口失败时，仅管理员可回退到前端推算（generatePolicies 会为全员生成推算段）
  if (viewMode.value === 'admin' && calendarLoadFailed.value) {
    const policies = PersonnelLeaveForm.generatePolicies(personnelList.value)
    return PersonnelLeaveForm.buildAllEntries(policies, year.value)
  }

  // 加载中：不展示任何推算数据
  return []
})

/** 当前年份日历是否已就绪 */
const calendarReady = computed(() => {
  if (calendarLoading.value) return false
  if (!useBackend.value || !calendarData.value) return false
  return loadedCalendarYear.value === year.value
})

/** 页面内容可展示：pending 期间绝不挂载日历/工具栏 */
const pageReady = computed(() => {
  if (viewMode.value === 'pending' || scopeLoading.value || !scope.value) return false
  if (viewMode.value === 'admin') {
    return (
      personnelReady.value &&
      calendarReady.value &&
      !calendarLoading.value
    )
  }
  return memberReady.value && memberCalendarSnapshot.value !== null
})

/** 双重校验：localStorage 非管理员则强制员工视图，忽略后端误报的 admin */
function resolveViewMode(nextScope: LeaveScope): 'admin' | 'member' {
  if (!isAdminUser()) return 'member'
  if (nextScope.role !== 'admin') return 'member'
  if (nextScope.editablePersonnelIds.length <= 1) return 'member'
  return 'admin'
}

/** 日历组件 key：换年或换用户时强制重建，避免残留渲染 */
const calendarPanelKey = computed(
  () => `${scopedPersonnelId.value || 'unknown'}_${year.value}_${loadedCalendarYear.value ?? 'pending'}`,
)

/** 日历着色用的人员 ID 列表（普通员工固定为本人） */
const effectivePersonnelIds = computed(() => {
  if (isPageAdmin.value) return personnelIds.value
  return scopedPersonnelId.value ? [scopedPersonnelId.value] : []
})

const filteredRows = computed(() =>
  PersonnelLeaveForm.buildTableRows(leaveEntries.value, personnelList.value, { year: year.value }),
)

/** 当前年份有休假记录（含推算）的人员 ID，用于按钮 disable */
const personnelIdsWithLeave = computed(
  () => new Set(filteredRows.value.map((row) => row.personnelId)),
)

function hasLeaveInYear(personnelId: string) {
  return personnelIdsWithLeave.value.has(personnelId)
}

/** 某月内有休假记录的人员 ID（用于月份悬停/锁定筛选） */
function getMonthPersonnelIds(month: number): Set<string> {
  const mm = String(month).padStart(2, '0')
  const lastDayNum = new Date(year.value, month, 0).getDate()
  const firstDay = `${year.value}-${mm}-01`
  const lastDay = `${year.value}-${mm}-${lastDayNum}`

  const ids = new Set<string>()
  for (const row of filteredRows.value) {
    if (row.startDate <= lastDay && row.endDate >= firstDay) {
      ids.add(row.personnelId)
    }
  }
  return ids
}

const hoveredMonthPersonnelIds = computed(() => {
  if (hoveredMonth.value === null) return new Set<string>()
  return getMonthPersonnelIds(hoveredMonth.value)
})

const pinnedMonthPersonnelIds = computed(() => {
  if (pinnedMonth.value === null) return null
  return getMonthPersonnelIds(pinnedMonth.value)
})

/** 用户主动勾选可见的人员（solo 模式下退化为单人） */
const filterPersonnelIds = computed(() => {
  if (soloPersonnelId.value !== null) {
    return [soloPersonnelId.value]
  }
  return personnelIds.value.filter((id) => personVisible[id])
})

/**
 * 最终参与日历渲染的人员范围：
 * solo > 锁定月份 > 勾选可见
 */
const effectiveVisibleIds = computed(() => {
  if (soloPersonnelId.value !== null) {
    return [soloPersonnelId.value]
  }
  if (pinnedMonthPersonnelIds.value !== null) {
    return [...pinnedMonthPersonnelIds.value]
  }
  return filterPersonnelIds.value
})

/**
 * 传给 buildYearCalendar 的休假行：
 * solo 时严格单人；否则保留悬停人员/悬停月份的额外高亮行
 */
const visibleRows = computed(() => {
  const pid = scopedPersonnelId.value
  const rows = filteredRows.value.filter((row) => {
    if (!isPageAdmin.value && pid && row.personnelId !== pid) {
      return false
    }
    if (soloPersonnelId.value !== null) {
      return row.personnelId === soloPersonnelId.value
    }
    return (
      effectiveVisibleIds.value.includes(row.personnelId) ||
      row.personnelId === hoveredPersonnelId.value ||
      hoveredMonthPersonnelIds.value.has(row.personnelId)
    )
  })
  return rows
})

const calendarMonths = computed(() =>
  PersonnelLeaveForm.buildYearCalendar(year.value, visibleRows.value),
)

/** 员工日历：只读快照（无实际记录时含一段假设初始休假） */
const memberCalendarMonths = computed(() => memberCalendarSnapshot.value ?? [])

/** 员工视图：仅 actualEntries 的 ID 集合 */
const memberActualEntryIds = computed(() => {
  if (!calendarData.value) return new Set<string>()
  return new Set(calendarData.value.actualEntries.map((dto) => dto.id))
})

/** 已保存到后端的记录 ID，日历格子上显示勾选标记 */
const actualEntryIds = computed(() => {
  if (!calendarData.value) return new Set<string>()
  return new Set(calendarData.value.actualEntries.map((dto) => dto.id))
})

let calendarRequestId = 0
let initRequestId = 0

async function loadAdminCalendar() {
  const requestedYear = year.value
  const requestId = ++calendarRequestId
  calendarLoading.value = true
  calendarLoadFailed.value = false

  calendarData.value = null
  useBackend.value = false
  loadedCalendarYear.value = null
  dtoLookup.value = new Map()

  try {
    const data = await fetchLeaveCalendar({ year: requestedYear })
    if (requestId !== calendarRequestId || requestedYear !== year.value) return
    calendarData.value = data
    loadedCalendarYear.value = requestedYear
    useBackend.value = true
    applyCalendarLookup(data)
  } catch (error) {
    if (requestId !== calendarRequestId || requestedYear !== year.value) return
    useBackend.value = false
    loadedCalendarYear.value = null
    calendarLoadFailed.value = true
    calendarData.value = null
    dtoLookup.value = new Map()
    ElMessage.error(error instanceof Error ? error.message : '加载休假数据失败')
  } finally {
    if (requestId === calendarRequestId) {
      calendarLoading.value = false
    }
  }
}

/** 普通员工：换年保留旧日历直至新数据校验通过，避免空白或闪现 */
async function loadMemberCalendar(personnelId: string) {
  const requestedYear = year.value
  const requestId = ++calendarRequestId
  calendarLoading.value = true
  calendarLoadFailed.value = false

  try {
    const raw = await fetchMyLeaveCalendar(requestedYear)
    if (requestId !== calendarRequestId || requestedYear !== year.value) return

    console.log('🔷 [loadMemberCalendar] 后端原始响应 personnel:', raw.personnel.length, '人, actualEntries:', raw.actualEntries.length, '条, computedEntries:', raw.computedEntries.length, '条')
    console.log('🔷 [loadMemberCalendar] 后端 personnel IDs:', raw.personnel.map(p => p.id))

    const data = sanitizeMemberCalendar(raw, personnelId)
    console.log('🔶 [loadMemberCalendar] sanitize 后 personnel:', data.personnel.length, '人, actualEntries:', data.actualEntries.length, '条')
    if (!data.personnel.length) {
      memberReady.value = false
      memberCalendarSnapshot.value = null
      calendarLoadFailed.value = true
      ElMessage.error('无法识别当前用户的人员信息')
      return
    }

    // 保留 computedEntries，由 commitMemberViewState 在无实际记录时展示假设初始休假
    commitMemberViewState(data, requestedYear)
  } catch (error) {
    if (requestId !== calendarRequestId || requestedYear !== year.value) return
    memberReady.value = false
    memberCalendarSnapshot.value = null
    calendarLoadFailed.value = true
    ElMessage.error(error instanceof Error ? error.message : '加载休假数据失败')
  } finally {
    if (requestId === calendarRequestId) {
      calendarLoading.value = false
    }
  }
}

/** 换年只刷新日历数据，不清空 solo / pinnedMonth / 人员筛选 */
function changeYear(delta: number) {
  year.value += delta
  if (viewMode.value === 'admin') {
    void loadAdminCalendar()
    return
  }
  const pid = scopedPersonnelId.value
  if (pid) {
    void loadMemberCalendar(pid)
  }
}

function togglePinMonth(month: number) {
  pinnedMonth.value = pinnedMonth.value === month ? null : month
}

/** 按钮激活态：solo 时只看是否为目标人，不受月份锁定影响 */
function isPersonShown(personnelId: string) {
  if (soloPersonnelId.value !== null) {
    return personnelId === soloPersonnelId.value
  }
  return Boolean(personVisible[personnelId])
}

/** 组名按钮激活态：组内成员全部可见时为「开」 */
function isGroupFullyShown(team: string) {
  const group = teamGroups.value.find((g) => g.team === team)
  if (!group?.members.length) return false
  if (soloPersonnelId.value !== null) {
    return group.members.length === 1 && group.members[0].personnelId === soloPersonnelId.value
  }
  return group.members.every((m) => personVisible[m.personnelId])
}

// ── 人员右键菜单 ──
const ctxMenuVisible = ref(false)
const ctxMenuTarget = ref<string | null>(null)
const ctxMenuX = ref(0)
const ctxMenuY = ref(0)

function openContextMenu(event: MouseEvent, personnelId: string) {
  ctxMenuTarget.value = personnelId
  ctxMenuX.value = event.clientX
  ctxMenuY.value = event.clientY
  ctxMenuVisible.value = true
}

function closeContextMenu() {
  ctxMenuVisible.value = false
}

function setSolo(personnelId: string) {
  soloPersonnelId.value = personnelId
  closeContextMenu()
}

function clearSolo() {
  soloPersonnelId.value = null
}

function showAll() {
  soloPersonnelId.value = null
  for (const person of personnelList.value) {
    personVisible[person.id] = true
  }
  closeContextMenu()
}

function hideAll() {
  soloPersonnelId.value = null
  for (const person of personnelList.value) {
    personVisible[person.id] = false
  }
  closeContextMenu()
}

// ── 休假记录编辑对话框 ──
const dialogVisible = ref(false)
const editingEntry = ref<LeaveEntryDTO | null>(null)
const editingPerson = ref<PersonnelRecord | null>(null)

function buildDtoLookup(data: LeaveCalendarResponse) {
  const lookup = new Map<string, LeaveEntryDTO>()
  for (const dto of data.actualEntries) {
    lookup.set(dto.id, dto)
  }
  for (const dto of data.computedEntries) {
    lookup.set(dto.id, dto)
  }
  return lookup
}

/** 点击日历格：已有 DTO 则编辑，否则用格子数据构造待保存的推算记录 */
function openEditForEvent(event: CalendarDayCell['events'][number]) {
  const lookup = isPageAdmin.value
    ? (calendarData.value ? buildDtoLookup(calendarData.value) : new Map<string, LeaveEntryDTO>())
    : memberDtoLookup.value

  const dto = lookup.get(event.id)
  if (dto) {
    editingEntry.value = dto
  } else {
    editingEntry.value = {
      id: event.id,
      personnelId: event.personnelId,
      type: event.type as LeaveEntryDTO['type'],
      startDate: event.startDate,
      endDate: event.endDate,
      plannedDays: 0,
      status: event.status as LeaveEntryDTO['status'],
      parentEntryId: '',
      reason: event.reason || '',
      remark: '',
      computed: true,
    }
  }
  editingPerson.value =
    personnelList.value.find((p) => p.id === event.personnelId) ?? null
  dialogVisible.value = true
}

function reloadCurrentCalendar() {
  if (viewMode.value === 'admin') {
    void loadAdminCalendar()
    return
  }
  const pid = scopedPersonnelId.value
  if (pid) {
    void loadMemberCalendar(pid)
  }
}

function onDialogSaved(_entry: LeaveEntryDTO) {
  reloadCurrentCalendar()
}

function onDialogDeleted(_id: string) {
  reloadCurrentCalendar()
}

// ── 休假策略（工作/休息周期）编辑 ──
const policyDialogVisible = ref(false)
const policyEditingPerson = ref<PersonnelRecord | null>(null)
const policyForm = reactive({
  workDays: 150,
  leaveDays: 19,
  cycleStartDate: '',
})
const policySaving = ref(false)

function openPolicyDialog(personnelId: string) {
  const person = personnelList.value.find((p) => p.id === personnelId)
  if (!person) return
  policyEditingPerson.value = person

  const existing = calendarData.value?.policies.find(
    (p) => p.personnelId === personnelId,
  )
  if (existing) {
    policyForm.workDays = existing.workDays
    policyForm.leaveDays = existing.leaveDays
    policyForm.cycleStartDate = existing.cycleStartDate
  } else {
    policyForm.workDays = 150
    policyForm.leaveDays = 19
    policyForm.cycleStartDate = '2024-06-01'
  }

  policyDialogVisible.value = true
  closeContextMenu()
}

async function handlePolicySave() {
  if (!policyEditingPerson.value) return
  const personnelId = policyEditingPerson.value.id
  const existing = calendarData.value?.policies.find(
    (p) => p.personnelId === personnelId,
  )

  policySaving.value = true
  try {
    await savePolicy({
      id: existing?.id,
      personnelId,
      workDays: policyForm.workDays,
      leaveDays: policyForm.leaveDays,
      cycleStartDate: policyForm.cycleStartDate,
    })
    ElMessage.success('休假策略已保存')
    policyDialogVisible.value = false
    await loadAdminCalendar()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    policySaving.value = false
  }
}

function getTeamMembers(team: string) {
  return personnelList.value.filter((person) => person.team === team)
}

/** solo 模式下点击成员可切换目标人，点击当前目标人则退出 solo */
function toggleGroupVisibility(team: string) {
  if (soloPersonnelId.value !== null) return
  const members = getTeamMembers(team)
  const allShown = members.every((person) => personVisible[person.id])
  for (const member of members) {
    personVisible[member.id] = !allShown
  }
}

function toggleGroupExpanded(team: string) {
  groupExpanded[team] = !groupExpanded[team]
}

function togglePersonVisibility(personnelId: string) {
  if (!hasLeaveInYear(personnelId)) return
  if (soloPersonnelId.value !== null) {
    soloPersonnelId.value =
      personnelId === soloPersonnelId.value ? null : personnelId
    return
  }
  personVisible[personnelId] = !personVisible[personnelId]
}

async function initializePage() {
  const requestId = ++initRequestId
  resetPageState()
  scope.value = null
  scopeLoading.value = true
  console.log('🔵 [initializePage] START, isAdminUser():', isAdminUser(), 'localStorage user:', getUser())

  try {
    const nextScope = await fetchLeaveScope()
    if (requestId !== initRequestId) return

    console.log('🟢 [initializePage] /my-scope 返回:', JSON.stringify(nextScope))

    const mode = resolveViewMode(nextScope)
    console.log('🟡 [initializePage] resolveViewMode 结果:', mode)
    viewMode.value = mode
    pageRole.value = mode
    scope.value = nextScope

    if (mode === 'admin') {
      console.log('🟠 [initializePage] 进入管理员路径，加载全员数据...')
      const list = await fetchPersonnelList()
      if (requestId !== initRequestId) return
      applyPersonnelList(list)
      console.log('🟠 [initializePage] fetchPersonnelList 返回', list.length, '人')
      await loadAdminCalendar()
      console.log('🟠 [initializePage] 管理员日历加载完成')
      return
    }

    const personnelId = nextScope.personnelId
    console.log('🟣 [initializePage] 进入普通员工路径, personnelId:', personnelId)
    if (!personnelId) {
      ElMessage.error('无法识别当前用户的人员信息')
      return
    }

    await loadMemberCalendar(personnelId)
    console.log('🟣 [initializePage] 普通员工日历加载完成')
  } catch (error) {
    if (requestId !== initRequestId) return
    console.error('🔴 [initializePage] 错误:', error)
    ElMessage.error(error instanceof Error ? error.message : '加载休假页面失败')
  } finally {
    if (requestId === initRequestId) {
      scopeLoading.value = false
      console.log('🔵 [initializePage] scopeLoading = false, pageReady 将变为 true')
    }
  }
}

onMounted(() => {
  void initializePage()
})

onBeforeUnmount(() => {
  initRequestId += 1
  calendarRequestId += 1
  resetPageState()
  scope.value = null
  scopeLoading.value = false
})
</script>

<template>
  <div class="leave-page">
    <!-- pending / 加载中：不挂载工具栏/日历 -->
    <div
      v-if="viewMode === 'pending' || !pageReady"
      class="page-loading-shell"
      v-loading="true"
      element-loading-background="var(--el-bg-color)"
    >
      <el-empty v-if="calendarLoadFailed && !scopeLoading" description="休假数据加载失败" />
    </div>

    <template v-else-if="viewMode === 'admin'">
      <!-- 管理员：工具栏 + 完整交互日历 -->
      <div class="leave-toolbar">
      <div class="year-switcher">
        <el-button link @click="changeYear(-1)">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <span class="year-label">{{ year }}</span>
        <el-button link @click="changeYear(1)">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>

      <div class="team-groups-panel">
        <div
          v-for="group in teamGroups"
          :key="group.team"
          class="team-group"
        >
          <div class="team-group-head">
            <button
              type="button"
              class="team-toggle"
              :class="{ 'is-off': !isGroupFullyShown(group.team) }"
              @click="toggleGroupVisibility(group.team)"
            >
              <i class="team-dot" :class="{ 'is-off': !isGroupFullyShown(group.team) }" />
              {{ group.team }}
            </button>

            <button
              type="button"
              class="team-expand"
              :title="groupExpanded[group.team] ? '收起成员' : '展开成员'"
              @click="toggleGroupExpanded(group.team)"
            >
              <el-icon>
                <ArrowDown v-if="groupExpanded[group.team]" />
                <ArrowRight v-else />
              </el-icon>
            </button>
          </div>

          <div v-show="groupExpanded[group.team]" class="team-members">
            <button
              v-for="member in group.members"
              :key="member.personnelId"
              type="button"
              class="member-toggle"
              :class="{
                'is-off': !isPersonShown(member.personnelId),
                'is-hovered': hoveredPersonnelId === member.personnelId,
                'is-solo': soloPersonnelId === member.personnelId,
                'is-no-leave': !hasLeaveInYear(member.personnelId),
              }"
              :disabled="!hasLeaveInYear(member.personnelId)"
              :title="hasLeaveInYear(member.personnelId) ? member.name : `${member.name}（${year} 年无休假记录）`"
              @click="togglePersonVisibility(member.personnelId)"
              @mouseenter="hoveredPersonnelId = member.personnelId"
              @mouseleave="hoveredPersonnelId = null"
              @contextmenu.prevent="openContextMenu($event, member.personnelId)"
            >
              <i class="legend-dot" :style="{ background: member.color }" />
              {{ member.name }}
            </button>
          </div>
        </div>
      </div>
      </div>

      <div class="calendar-wrapper">
        <LeaveYearCalendarPanel
          :key="calendarPanelKey"
          :personnel-ids="effectivePersonnelIds"
          :calendar-months="calendarMonths"
          :dto-lookup="dtoLookup"
          :hovered-month="hoveredMonth"
          :pinned-month="pinnedMonth"
          :actual-entry-ids="actualEntryIds"
          :hovered-personnel-id="hoveredPersonnelId"
          :hovered-month-personnel-ids="hoveredMonthPersonnelIds"
          @edit-entry="openEditForEvent"
          @load-calendar="loadAdminCalendar"
          @toggle-pin-month="togglePinMonth"
          @hover-month="hoveredMonth = $event"
        />
      </div>
    </template>

    <template v-else-if="viewMode === 'member'">
      <!-- 普通员工：年份切换 + 本人日历（可编辑） -->
      <div class="leave-toolbar leave-toolbar--member">
        <div class="year-switcher">
          <el-button link @click="changeYear(-1)">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <span class="year-label">{{ year }}</span>
          <el-button link @click="changeYear(1)">
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>

      <div class="calendar-wrapper" v-loading="calendarLoading">
        <LeaveYearCalendarPanel
          :key="calendarPanelKey"
          simple-mode
          editable
          :personnel-ids="effectivePersonnelIds"
          :calendar-months="memberCalendarMonths"
          :dto-lookup="memberDtoLookup"
          :hovered-month="null"
          :pinned-month="null"
          :actual-entry-ids="memberActualEntryIds"
          :hovered-personnel-id="null"
          :hovered-month-personnel-ids="emptyMonthPersonnelIds"
          @edit-entry="openEditForEvent"
          @load-calendar="reloadCurrentCalendar"
        />
      </div>
    </template>

    <!-- 人员姓名右键菜单（仅管理员） -->
    <Teleport v-if="isPageAdmin" to="body">
      <div
        v-if="ctxMenuVisible"
        class="ctx-menu-backdrop"
        @click="closeContextMenu"
        @contextmenu.prevent="closeContextMenu"
      >
        <div
          class="ctx-menu-card"
          :style="{ left: ctxMenuX + 'px', top: ctxMenuY + 'px' }"
          @click.stop
        >
          <button
            type="button"
            class="ctx-menu-item"
            @click="setSolo(ctxMenuTarget!)"
          >
            <el-icon><View /></el-icon>
            仅显示
          </button>
          <button
            v-if="soloPersonnelId"
            type="button"
            class="ctx-menu-item"
            @click="clearSolo()"
          >
            <el-icon><RefreshLeft /></el-icon>
            取消仅显示
          </button>
          <button
            type="button"
            class="ctx-menu-item"
            @click="openPolicyDialog(ctxMenuTarget!)"
          >
            <el-icon><Setting /></el-icon>
            编辑休假策略
          </button>
          <div class="ctx-menu-divider" />
          <button
            type="button"
            class="ctx-menu-item"
            @click="showAll()"
          >
            <el-icon><Select /></el-icon>
            全部显示
          </button>
          <button
            type="button"
            class="ctx-menu-item"
            @click="hideAll()"
          >
            <el-icon><CloseBold /></el-icon>
            全部关闭
          </button>
        </div>
      </div>
    </Teleport>

    <LeaveEditDialog
      v-model:visible="dialogVisible"
      :entry="editingEntry"
      :person="editingPerson"
      @saved="onDialogSaved"
      @deleted="onDialogDeleted"
    />

    <el-dialog
      v-if="isPageAdmin"
      v-model="policyDialogVisible"
      :title="`休假策略 — ${policyEditingPerson?.name ?? ''}`"
      width="420px"
      :close-on-click-modal="false"
      @close="policyDialogVisible = false"
    >
      <el-form label-position="top" size="default">
        <el-form-item label="工作天数（间隔）">
          <el-input-number
            v-model="policyForm.workDays"
            :min="1"
            :max="365"
            style="width: 100%"
          />
          <div class="field-hint">连续工作多少天后休假</div>
        </el-form-item>
        <el-form-item label="休假天数（时长）">
          <el-input-number
            v-model="policyForm.leaveDays"
            :min="1"
            :max="90"
            style="width: 100%"
          />
          <div class="field-hint">每次休假持续多少天</div>
        </el-form-item>
        <el-form-item label="周期起始日期">
          <el-date-picker
            v-model="policyForm.cycleStartDate"
            type="date"
            placeholder="选择起始日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
          <div class="field-hint">无实际休假记录时，以此为锚点推算（有新记录后自动前移）</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="policyDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="policySaving" @click="handlePolicySave">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 撑满标签页内容区，日历与工具栏纵向排列 */
.leave-page {
  --layout-top-height: 48px;
  --layout-tabs-height: 40px;
  margin: -20px -20px -10px;
  height: calc(100vh - var(--layout-top-height) - var(--layout-tabs-height));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.calendar-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.page-loading-shell {
  flex: 1;
  min-height: 320px;
  background: var(--el-bg-color);
}

/* 左侧年份 + 右侧两组纵向排列（设计组一行、细化组一行） */
.leave-toolbar {
  display: flex;
  align-items: flex-start;
  flex: 0 1 auto;
  max-height: 32%;
  overflow-y: auto;
  gap: 12px;
  margin-bottom: 6px;
  padding: 0 2px;
}

.year-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding-top: 2px;
  min-width: 72px;
}

/* 关键：纵向 flex，禁止设计组/细化组并排 */
.team-groups-panel {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  min-width: 0;
}

.team-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  flex: 0 0 auto;
}

.team-group-head {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.leave-toolbar--member {
  justify-content: flex-start;
}

.leave-toolbar--member .year-switcher {
  padding-top: 4px;
}

.year-label {
  min-width: 48px;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.team-toggle,
.member-toggle,
.team-expand {
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  cursor: pointer;
}

.team-toggle,
.member-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  color: var(--el-text-color-regular);
  line-height: 1.4;
  transition: border-color 0.15s, background-color 0.15s;
}

.team-toggle:hover,
.member-toggle:hover,
.team-expand:hover {
  border-color: var(--el-border-color);
  background: var(--el-fill-color);
}

.team-toggle.is-off,
.member-toggle.is-off {
  opacity: 0.45;
}

.member-toggle.is-no-leave,
.member-toggle:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.member-toggle.is-no-leave:hover,
.member-toggle:disabled:hover {
  border-color: var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.member-toggle:not(:disabled).is-hovered {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  opacity: 1;
}

.team-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
  flex-shrink: 0;
}

.team-dot.is-off {
  background: var(--el-text-color-placeholder);
}

.team-expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 4px;
  color: var(--el-text-color-secondary);
  transition: border-color 0.15s, background-color 0.15s;
}

.team-members {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.member-toggle.is-solo {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-7);
  color: #fff;
  opacity: 1;
}

.member-toggle.is-solo .legend-dot {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6);
}

.field-hint {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  line-height: 1.3;
}

.ctx-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
}

.ctx-menu-card {
  position: fixed;
  z-index: 3001;
  min-width: 140px;
  padding: 4px 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  animation: ctx-in 0.1s ease;
}

@keyframes ctx-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

.ctx-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-primary);
  text-align: left;
  transition: background 0.1s;
}

.ctx-menu-item:hover {
  background: var(--el-fill-color-light);
}

.ctx-menu-item .el-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.ctx-menu-divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--el-border-color-lighter);
}
</style>
