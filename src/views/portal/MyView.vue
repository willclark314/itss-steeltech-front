<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchProjectList } from '@/api/projects'
import { fetchPersonnelList } from '@/api/personnel'
import { fetchRoleList } from '@/api/roles'
import MyCalendarPanel from '@/components/portal/MyCalendarPanel.vue'
import MyContactSection from '@/components/portal/MyContactSection.vue'
import MyProjectSection from '@/components/portal/MyProjectSection.vue'
import MyTempTaskSection from '@/components/portal/MyTempTaskSection.vue'
import { ProjectForm } from '@/models/biz/project'
import type { ProjectRecord } from '@/models/biz/project'
import { MyProjectForm } from '@/models/portal/MyProjectForm'
import type { PersonnelRecord } from '@/models/personnel'
import type { RoleRecord } from '@/models/personnel/RoleForm'
import { getDisplayName, getUser, isAdminUser } from '@/utils/auth'

const user = getUser()
const isAdmin = isAdminUser(user)
const ownPersonnelId = user?.personnelId ?? ''
const ownPersonnelTeam = user?.profile?.team ?? ''
const ownDisplayName = getDisplayName()
const hasPersonnelProfile = Boolean(ownPersonnelId)

const personnelOptions = ref<PersonnelRecord[]>([])
const roleOptions = ref<RoleRecord[]>([])
const selectedPersonnelId = ref(ownPersonnelId)
const personnelOptionsLoading = ref(false)

const activePersonnelId = computed(() =>
  isAdmin ? selectedPersonnelId.value : ownPersonnelId,
)

const selectedPersonnel = computed(() =>
  personnelOptions.value.find((item) => item.id === activePersonnelId.value),
)

const activePersonnelTeam = computed(
  () => selectedPersonnel.value?.team ?? ownPersonnelTeam,
)

const activePersonnelRoleCodes = computed(() => {
  const personnelId = activePersonnelId.value
  if (!personnelId) return []

  if (!isAdmin || personnelId === ownPersonnelId) {
    return getUser()?.roles ?? []
  }

  const codes: string[] = []
  for (const role of roleOptions.value) {
    if (role.assignedPersonnelIds.includes(personnelId)) {
      codes.push(role.code)
    }
  }
  return codes
})

const activeDisplayName = computed(
  () => selectedPersonnel.value?.name ?? ownDisplayName,
)

const canViewPage = computed(() =>
  isAdmin ? Boolean(activePersonnelId.value) : hasPersonnelProfile,
)

type MyPageTab = 'contact' | 'project' | 'temp-task' | 'calendar'

const calendarProjects = ref<ProjectRecord[]>([])
const calendarLoading = ref(false)
const calendarLoadedPersonnelId = ref('')
let calendarLoadPromise: Promise<void> | null = null
const activeTab = ref<MyPageTab>('contact')

const contactSectionRef = ref<InstanceType<typeof MyContactSection>>()
const projectSectionRef = ref<InstanceType<typeof MyProjectSection>>()
const calendarPanelRef = ref<InstanceType<typeof MyCalendarPanel>>()
const highlightedContactId = ref('')
const highlightedProjectNo = ref('')
const calendarFocusedProjectNo = ref('')

const seesAllDetailProjects = computed(() =>
  MyProjectForm.shouldSeeAllDetailProjects(activePersonnelRoleCodes.value),
)

const calendarReady = computed(
  () =>
    Boolean(activePersonnelId.value) &&
    calendarLoadedPersonnelId.value === activePersonnelId.value,
)

const pageTip = computed(() => {
  if (isAdmin && personnelOptionsLoading.value) {
    return '正在加载员工列表…'
  }
  if (canViewPage.value) {
    if (seesAllDetailProjects.value) {
      return `查看 ${activeDisplayName.value} 的联系单、临时任务与日程；项目为全部细化项目`
    }
    return `查看分配给 ${activeDisplayName.value} 的联系单、项目、临时任务与日程`
  }
  if (isAdmin) {
    return '请选择员工查看其联系单、项目、临时任务与日程'
  }
  return '当前账号未关联人员档案，无法查询个人相关数据'
})

async function loadPersonnelOptions() {
  if (!isAdmin) return
  personnelOptionsLoading.value = true
  try {
    const [personnel, roles] = await Promise.all([
      fetchPersonnelList({ status: 'active' }),
      fetchRoleList({ status: 'active' }),
    ])
    personnelOptions.value = personnel
    roleOptions.value = roles
    if (!selectedPersonnelId.value && personnelOptions.value.length) {
      selectedPersonnelId.value = personnelOptions.value[0]!.id
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载员工列表失败')
  } finally {
    personnelOptionsLoading.value = false
  }
}

async function loadCalendarData() {
  if (!canViewPage.value || !activePersonnelId.value) return
  const personnelId = activePersonnelId.value
  calendarLoading.value = true
  try {
    const projectResult = await fetchProjectList({
      all: true,
      ...MyProjectForm.buildListFilters({
        personnelId,
        personnelTeam: activePersonnelTeam.value,
        roleCodes: activePersonnelRoleCodes.value,
      }),
    })
    if (activePersonnelId.value !== personnelId) return
    calendarProjects.value = projectResult.list
    calendarLoadedPersonnelId.value = personnelId
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载日历数据失败')
  } finally {
    calendarLoading.value = false
  }
}

async function ensureCalendarData() {
  if (calendarReady.value) return
  if (!calendarLoadPromise) {
    calendarLoadPromise = loadCalendarData().finally(() => {
      calendarLoadPromise = null
    })
  }
  await calendarLoadPromise
}

async function waitForSectionRef<T>(getter: () => T | null | undefined, attempts = 12) {
  for (let i = 0; i < attempts; i += 1) {
    const value = getter()
    if (value) return value
    await nextTick()
  }
  return getter()
}

async function handleSelectProject(projectNo: string) {
  activeTab.value = 'project'
  highlightedProjectNo.value = ProjectForm.parseBaseProjectNo(projectNo)
  highlightedContactId.value = ''
  calendarFocusedProjectNo.value = ''
  const section = await waitForSectionRef(() => projectSectionRef.value)
  await section?.focusProject(projectNo)
}

async function handleProjectSectionSelect(project: ProjectRecord) {
  const displayNo = ProjectForm.getDisplayProjectNo(project)
  highlightedProjectNo.value = displayNo
  highlightedContactId.value = ''
  calendarFocusedProjectNo.value = displayNo
  await ensureCalendarData()
  activeTab.value = 'calendar'
  const panel = await waitForSectionRef(() => calendarPanelRef.value)
  panel?.focusToProject(project)
}

async function handleSelectContact(contactFormId: string) {
  activeTab.value = 'contact'
  highlightedContactId.value = contactFormId
  highlightedProjectNo.value = ''
  calendarFocusedProjectNo.value = ''
  const section = await waitForSectionRef(() => contactSectionRef.value)
  await section?.focusContact(contactFormId)
}

function clearSelection() {
  highlightedContactId.value = ''
  highlightedProjectNo.value = ''
  calendarFocusedProjectNo.value = ''
}

function handleProjectUpdated(project: ProjectRecord) {
  if (!calendarReady.value) return
  const index = calendarProjects.value.findIndex((item) => item.projectNo === project.projectNo)
  if (index === -1) {
    calendarProjects.value = [...calendarProjects.value, project]
    return
  }
  calendarProjects.value = calendarProjects.value.map((item, itemIndex) =>
    itemIndex === index ? project : item,
  )
}

function handleProjectLeft(projectNo: string) {
  if (!calendarReady.value) return
  calendarProjects.value = calendarProjects.value.filter((item) => item.projectNo !== projectNo)
  if (calendarFocusedProjectNo.value === ProjectForm.parseBaseProjectNo(projectNo)) {
    calendarFocusedProjectNo.value = ''
  }
}

watch(activeTab, (tab) => {
  if (tab === 'calendar') {
    void ensureCalendarData()
  }
})

watch(activePersonnelId, (nextId, prevId) => {
  if (!nextId || nextId === prevId) return
  clearSelection()
  calendarProjects.value = []
  calendarLoadedPersonnelId.value = ''
  if (activeTab.value === 'calendar') {
    void ensureCalendarData()
  }
})

onMounted(async () => {
  if (isAdmin) {
    await loadPersonnelOptions()
  }
})
</script>

<template>
  <el-card shadow="never" class="biz-page-card my-page-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">我的</span>
          <el-select
            v-if="isAdmin"
            v-model="selectedPersonnelId"
            class="my-personnel-select"
            filterable
            size="small"
            placeholder="选择员工"
            :loading="personnelOptionsLoading"
          >
            <el-option
              v-for="person in personnelOptions"
              :key="person.id"
              :label="`${person.name}（${person.team}）`"
              :value="person.id"
            />
          </el-select>
          <span class="page-tip">{{ pageTip }}</span>
        </div>
      </div>
    </template>

    <el-empty
      v-if="!canViewPage"
      :description="isAdmin ? '暂无可查看的员工' : '未关联人员档案'"
    />

    <el-tabs v-else v-model="activeTab" class="my-page-tabs">
      <el-tab-pane label="我的联系单" name="contact" lazy>
        <MyContactSection
          ref="contactSectionRef"
          :personnel-id="activePersonnelId"
          :highlighted-contact-id="highlightedContactId"
          @select-project="handleSelectProject"
          @clear-selection="clearSelection"
        />
      </el-tab-pane>
      <el-tab-pane label="我的项目" name="project" lazy>
        <MyProjectSection
          ref="projectSectionRef"
          :personnel-id="activePersonnelId"
          :personnel-team="activePersonnelTeam"
          :personnel-role-codes="activePersonnelRoleCodes"
          :highlighted-project-no="highlightedProjectNo"
          @select-contact="handleSelectContact"
          @select-project="handleProjectSectionSelect"
          @clear-selection="clearSelection"
          @project-updated="handleProjectUpdated"
          @project-left="handleProjectLeft"
        />
      </el-tab-pane>
      <el-tab-pane label="我的临时任务" name="temp-task" lazy>
        <MyTempTaskSection :personnel-id="activePersonnelId" />
      </el-tab-pane>
      <el-tab-pane label="我的日程" name="calendar" lazy>
        <MyCalendarPanel
          ref="calendarPanelRef"
          :projects="calendarProjects"
          :loading="calendarLoading"
          :highlighted-project-no="calendarFocusedProjectNo"
        />
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<style scoped>
.my-page-card {
  --layout-top-height: 48px;
  --layout-tabs-height: 40px;
  --layout-main-padding: 30px;
  --el-card-padding: 20px;
  height: calc(100vh - var(--layout-top-height) - var(--layout-tabs-height) - var(--layout-main-padding));
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.my-page-card :deep(.el-card__header) {
  flex-shrink: 0;
}

.my-page-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px var(--el-card-padding) 12px;
}

.my-personnel-select {
  width: 180px;
}

.page-tip {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--el-text-color-secondary);
}

.my-page-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.my-page-tabs :deep(.el-tabs__header) {
  flex-shrink: 0;
  margin-bottom: 8px;
}

.my-page-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}

.my-page-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.my-page-tabs :deep(.el-tab-pane) {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.my-page-tabs :deep(.my-section),
.my-page-tabs :deep(.my-temp-task-panel),
.my-page-tabs :deep(.my-calendar-panel) {
  height: 100%;
  min-height: 0;
}

.my-page-tabs :deep(.my-section) {
  display: flex;
  flex-direction: column;
  border: none;
  padding: 0;
}

.my-page-tabs :deep(.my-section__title),
.my-page-tabs :deep(.my-temp-task-title),
.my-page-tabs :deep(.my-calendar-title) {
  display: none;
}

.my-page-tabs :deep(.my-section__table-wrap) {
  flex: 1;
  min-height: 0;
  height: auto;
}

.my-page-tabs :deep(.my-temp-task-panel) {
  border-right: none;
  padding: 0;
}

.my-page-tabs :deep(.my-temp-task-header) {
  justify-content: flex-end;
}
</style>
