<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchProjectList } from '@/api/projects'
import { fetchPersonnelList } from '@/api/personnel'
import MyCalendarPanel from '@/components/portal/MyCalendarPanel.vue'
import MyContactSection from '@/components/portal/MyContactSection.vue'
import MyProjectSection from '@/components/portal/MyProjectSection.vue'
import MyTempTaskSection from '@/components/portal/MyTempTaskSection.vue'
import { ProjectForm } from '@/models/biz/project'
import type { ProjectRecord } from '@/models/biz/project'
import type { PersonnelRecord } from '@/models/personnel'
import { getDisplayName, getUser, isAdminUser } from '@/utils/auth'

const user = getUser()
const isAdmin = isAdminUser(user)
const ownPersonnelId = user?.personnelId ?? ''
const ownPersonnelTeam = user?.profile?.team ?? ''
const ownDisplayName = getDisplayName()
const hasPersonnelProfile = Boolean(ownPersonnelId)

const personnelOptions = ref<PersonnelRecord[]>([])
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

const activeDisplayName = computed(
  () => selectedPersonnel.value?.name ?? ownDisplayName,
)

const canViewPage = computed(() =>
  isAdmin ? Boolean(activePersonnelId.value) : hasPersonnelProfile,
)

const calendarProjects = ref<ProjectRecord[]>([])
const calendarLoading = ref(false)

const contactSectionRef = ref<InstanceType<typeof MyContactSection>>()
const projectSectionRef = ref<InstanceType<typeof MyProjectSection>>()
const calendarPanelRef = ref<InstanceType<typeof MyCalendarPanel>>()
const highlightedContactId = ref('')
const highlightedProjectNo = ref('')
const calendarFocusedProjectNo = ref('')

const pageTip = computed(() => {
  if (isAdmin && personnelOptionsLoading.value) {
    return '正在加载员工列表…'
  }
  if (canViewPage.value) {
    return `查看分配给 ${activeDisplayName.value} 的项目、联系单与日程`
  }
  if (isAdmin) {
    return '请选择员工查看其项目、联系单与日程'
  }
  return '当前账号未关联人员档案，无法查询个人相关数据'
})

async function loadPersonnelOptions() {
  if (!isAdmin) return
  personnelOptionsLoading.value = true
  try {
    personnelOptions.value = await fetchPersonnelList({ status: 'active' })
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
  calendarLoading.value = true
  try {
    const projectResult = await fetchProjectList({
      all: true,
      assignedPersonnelId: activePersonnelId.value,
    })
    calendarProjects.value = projectResult.list
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载日历数据失败')
  } finally {
    calendarLoading.value = false
  }
}

function focusCalendarToProject(project: ProjectRecord) {
  calendarPanelRef.value?.focusToProject(project)
}

async function handleSelectProject(projectNo: string) {
  highlightedProjectNo.value = ProjectForm.parseBaseProjectNo(projectNo)
  highlightedContactId.value = ''
  calendarFocusedProjectNo.value = ''
  await projectSectionRef.value?.focusProject(projectNo)
}

function handleProjectSectionSelect(project: ProjectRecord) {
  const displayNo = ProjectForm.getDisplayProjectNo(project)
  highlightedProjectNo.value = displayNo
  highlightedContactId.value = ''
  calendarFocusedProjectNo.value = displayNo
  focusCalendarToProject(project)
}

async function handleSelectContact(contactFormId: string) {
  highlightedContactId.value = contactFormId
  highlightedProjectNo.value = ''
  calendarFocusedProjectNo.value = ''
  await contactSectionRef.value?.focusContact(contactFormId)
}

function clearSelection() {
  highlightedContactId.value = ''
  highlightedProjectNo.value = ''
  calendarFocusedProjectNo.value = ''
}

function handleProjectUpdated(project: ProjectRecord) {
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
  calendarProjects.value = calendarProjects.value.filter((item) => item.projectNo !== projectNo)
  if (calendarFocusedProjectNo.value === ProjectForm.parseBaseProjectNo(projectNo)) {
    calendarFocusedProjectNo.value = ''
  }
}

watch(activePersonnelId, (nextId, prevId) => {
  if (!nextId || nextId === prevId) return
  clearSelection()
  void loadCalendarData()
})

onMounted(async () => {
  if (isAdmin) {
    await loadPersonnelOptions()
  }
  if (canViewPage.value) {
    void loadCalendarData()
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

    <div v-else class="my-page-layout">
      <section class="my-page-top">
        <MyContactSection
          ref="contactSectionRef"
          :personnel-id="activePersonnelId"
          :highlighted-contact-id="highlightedContactId"
          class="my-page-top__contact"
          @select-project="handleSelectProject"
          @clear-selection="clearSelection"
        />
        <MyProjectSection
          ref="projectSectionRef"
          :personnel-id="activePersonnelId"
          :personnel-team="activePersonnelTeam"
          :highlighted-project-no="highlightedProjectNo"
          class="my-page-top__project"
          @select-contact="handleSelectContact"
          @select-project="handleProjectSectionSelect"
          @clear-selection="clearSelection"
          @project-updated="handleProjectUpdated"
          @project-left="handleProjectLeft"
        />
      </section>

      <section class="my-page-bottom">
        <MyTempTaskSection
          :personnel-id="activePersonnelId"
          class="my-page-bottom__tasks"
        />
        <MyCalendarPanel
          ref="calendarPanelRef"
          :projects="calendarProjects"
          :loading="calendarLoading"
          :highlighted-project-no="calendarFocusedProjectNo"
          class="my-page-bottom__calendar"
        />
      </section>
    </div>
  </el-card>
</template>

<style scoped>
.my-page-card {
  --layout-top-height: 48px;
  --layout-tabs-height: 40px;
  --layout-main-padding: 30px;
  --el-card-padding: 20px;
  --biz-table-row-height: 32px;
  --my-table-visible-rows: 10;
  --my-table-header-height: 32px;
  --my-table-height: calc(
    var(--my-table-header-height) + var(--biz-table-row-height) * var(--my-table-visible-rows) + 40px
  );
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

.my-page-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.my-page-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 10px;
  align-items: stretch;
  flex-shrink: 0;
}

.my-page-bottom {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 3fr);
  gap: 10px;
  padding-top: 2px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.my-page-bottom__tasks {
  min-width: 0;
  min-height: 0;
}

.my-page-bottom__calendar {
  min-width: 0;
  min-height: 0;
}

@media (max-width: 1100px) {
  .my-page-top {
    grid-template-columns: 1fr;
  }

  .my-page-bottom {
    grid-template-columns: 1fr;
  }

  .my-page-bottom__tasks :deep(.my-temp-task-panel) {
    border-right: none;
    border-bottom: 1px solid var(--el-border-color-lighter);
    padding-bottom: 8px;
    max-height: 220px;
  }
}
</style>
