<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchProjectList, updateProject } from '@/api/projects'
import {
  fetchDetailTeamMemberOrder,
  saveDetailTeamMemberOrder,
} from '@/api/detailTeamSchedule'
import { fetchPersonnelList } from '@/api/personnel'
import ProjectEditDialog from '@/components/biz/ProjectEditDialog.vue'
import {
  DetailTeamScheduleForm,
  ProjectForm,
} from '@/models/biz/project'
import type { ProjectRecord } from '@/models/biz/project'

const DRAG_MIME = 'application/x-steeltech-project'
const MEMBER_DRAG_MIME = 'application/x-steeltech-detail-member'
const MEMBER_REORDER_BODY_CLASS = 'is-detail-member-reordering'
const MEMBER_REORDER_SOURCE_CLASS = 'is-source-member-drag'

let memberReorderSourceId: string | null = null

interface DragProjectPayload {
  projectNo: string
  sourcePersonnelId?: string
}

const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const includePaused = ref(false)
const includeCancelled = ref(false)
const includeAssigned = ref(false)
const dragOverMemberId = ref<string | null>(null)
const dragOverMemberReorderId = ref<string | null>(null)
const draggingProjectNo = ref<string | null>(null)
const draggingMemberId = ref<string | null>(null)

const editDialogVisible = ref(false)
const editingProject = ref<ProjectRecord | null>(null)

const allProjects = ref<ProjectRecord[]>([])
const detailTeamMembers = ref(
  DetailTeamScheduleForm.filterDetailTeamMembers([]),
)

const unfinishedProjects = computed(() =>
  DetailTeamScheduleForm.filterUnfinishedDetailProjects(allProjects.value, {
    keyword: keyword.value,
    includePaused: includePaused.value,
    includeCancelled: includeCancelled.value,
    includeAssigned: includeAssigned.value,
  }),
)

const memberWorkloads = computed(() =>
  DetailTeamScheduleForm.buildMemberWorkloads(
    detailTeamMembers.value,
    allProjects.value,
  ),
)

function getStatusMeta(status: ProjectRecord['status']) {
  return ProjectForm.STATUS_MAP[status]
}

function getProject(projectNo: string) {
  return allProjects.value.find((item) => item.projectNo === projectNo) ?? null
}

function openEditDialog(project: ProjectRecord) {
  editingProject.value = project
  editDialogVisible.value = true
}

function encodeDragPayload(payload: DragProjectPayload) {
  return JSON.stringify(payload)
}

function decodeDragPayload(event: DragEvent): DragProjectPayload | null {
  const raw =
    event.dataTransfer?.getData(DRAG_MIME) ||
    event.dataTransfer?.getData('application/json') ||
    event.dataTransfer?.getData('text/plain')
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as DragProjectPayload
    if (!parsed?.projectNo) return null
    return parsed
  } catch {
    return null
  }
}

function handleProjectDragStart(
  event: DragEvent,
  projectNo: string,
  sourcePersonnelId?: string,
) {
  const payload: DragProjectPayload = { projectNo, sourcePersonnelId }
  event.dataTransfer?.setData(DRAG_MIME, encodeDragPayload(payload))
  event.dataTransfer?.setData('text/plain', projectNo)
  event.dataTransfer!.effectAllowed = 'move'
  draggingProjectNo.value = projectNo
}

function handleProjectDragEnd() {
  draggingProjectNo.value = null
  dragOverMemberId.value = null
}

function isMemberReorderDrag(event?: DragEvent) {
  if (memberReorderSourceId || draggingMemberId.value) return true
  return event?.dataTransfer?.types.includes(MEMBER_DRAG_MIME) ?? false
}

function clearMemberReorderDragState() {
  document.body.classList.remove(MEMBER_REORDER_BODY_CLASS)
  document.querySelectorAll(`.${MEMBER_REORDER_SOURCE_CLASS}`).forEach((element) => {
    element.classList.remove(MEMBER_REORDER_SOURCE_CLASS)
  })
}

function handleMemberCardDragStart(event: DragEvent, personnelId: string) {
  event.stopPropagation()
  memberReorderSourceId = personnelId
  event.dataTransfer?.setData(MEMBER_DRAG_MIME, personnelId)
  event.dataTransfer?.setData('text/plain', personnelId)
  event.dataTransfer!.effectAllowed = 'move'
  draggingMemberId.value = personnelId
  ;(event.currentTarget as HTMLElement)
    .closest('.member-card')
    ?.classList.add(MEMBER_REORDER_SOURCE_CLASS)
  document.body.classList.add(MEMBER_REORDER_BODY_CLASS)
}

function handleMemberCardDragEnd() {
  draggingMemberId.value = null
  dragOverMemberReorderId.value = null
  clearMemberReorderDragState()

  const sourceId = memberReorderSourceId
  if (!sourceId) return

  window.setTimeout(() => {
    if (memberReorderSourceId === sourceId) {
      memberReorderSourceId = null
    }
  }, 0)
}

function handleMemberDragOver(event: DragEvent, personnelId: string) {
  if (isMemberReorderDrag(event)) {
    if (draggingMemberId.value === personnelId) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer!.dropEffect = 'move'
    dragOverMemberReorderId.value = personnelId
    dragOverMemberId.value = null
    return
  }

  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
  dragOverMemberId.value = personnelId
  dragOverMemberReorderId.value = null
}

function handleMemberDragLeave(personnelId: string) {
  if (dragOverMemberId.value === personnelId) {
    dragOverMemberId.value = null
  }
  if (dragOverMemberReorderId.value === personnelId) {
    dragOverMemberReorderId.value = null
  }
}

async function reorderMemberCards(sourceId: string, targetId: string) {
  const nextMembers = DetailTeamScheduleForm.reorderMembers(
    detailTeamMembers.value,
    sourceId,
    targetId,
  )
  if (nextMembers === detailTeamMembers.value) return

  const previousMembers = detailTeamMembers.value
  detailTeamMembers.value = nextMembers

  try {
    await saveDetailTeamMemberOrder(nextMembers.map((item) => item.id))
  } catch {
    detailTeamMembers.value = previousMembers
    ElMessage.error('保存人员顺序失败')
  }
}

async function loadData() {
  loading.value = true
  try {
    const [projectResult, personnel, memberOrderResult] = await Promise.all([
      fetchProjectList({ all: true }),
      fetchPersonnelList({ status: 'active' }),
      fetchDetailTeamMemberOrder().catch(() => ({ personnelIds: [] as string[] })),
    ])
    allProjects.value = projectResult.list
    const filteredMembers =
      DetailTeamScheduleForm.filterDetailTeamMembers(personnel)
    detailTeamMembers.value = DetailTeamScheduleForm.applyMemberOrder(
      filteredMembers,
      memberOrderResult.personnelIds,
    )
  } catch {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

function replaceProject(record: ProjectRecord) {
  const index = allProjects.value.findIndex(
    (item) => item.projectNo === record.projectNo,
  )
  if (index >= 0) {
    allProjects.value[index] = record
    allProjects.value = [...allProjects.value]
  }
}

async function assignProjectToMember(
  payload: DragProjectPayload,
  targetPersonnelId: string,
  targetPersonnelName: string,
) {
  const project = getProject(payload.projectNo)
  if (!project) return

  const nextIds = DetailTeamScheduleForm.buildAssignmentAfterDrop(
    project,
    targetPersonnelId,
    payload.sourcePersonnelId,
  )
  if (!nextIds) return

  saving.value = true
  try {
    const updated = await updateProject(project.projectNo, {
      assignedPersonnelIds: nextIds,
    })
    replaceProject(updated)

    if (payload.sourcePersonnelId) {
      const sourceName =
        detailTeamMembers.value.find((item) => item.id === payload.sourcePersonnelId)
          ?.name ?? '原负责人'
      ElMessage.success(
        `已将「${project.projectNo}」从 ${sourceName} 转分配给 ${targetPersonnelName}`,
      )
      return
    }

    ElMessage.success(`已将「${project.projectNo}」分配给 ${targetPersonnelName}`)
  } catch {
    ElMessage.error('分配失败')
  } finally {
    saving.value = false
  }
}

async function handleMemberDrop(
  event: DragEvent,
  targetPersonnelId: string,
  targetPersonnelName: string,
) {
  event.preventDefault()
  event.stopPropagation()

  const reorderSourceId =
    memberReorderSourceId ||
    (isMemberReorderDrag(event)
      ? event.dataTransfer?.getData(MEMBER_DRAG_MIME)
      : '') ||
    ''

  if (reorderSourceId) {
    dragOverMemberReorderId.value = null
    memberReorderSourceId = null
    draggingMemberId.value = null
    clearMemberReorderDragState()
    await reorderMemberCards(reorderSourceId, targetPersonnelId)
    return
  }

  dragOverMemberId.value = null

  const payload = decodeDragPayload(event)
  if (!payload) return

  await assignProjectToMember(payload, targetPersonnelId, targetPersonnelName)
}

function handleProjectSaved(record: ProjectRecord) {
  replaceProject(record)
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <el-card v-loading="loading" shadow="never" class="biz-page-card detail-schedule-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">细化组排班</span>
          <span class="card-subtitle">
            拖拽左侧或成员手上的项目到目标人员以分配；拖拽人员卡片标题栏可调整排列顺序；点击编辑按钮可修改属性
          </span>
        </div>
        <el-button :loading="loading" @click="loadData">刷新</el-button>
      </div>
    </template>

    <div class="detail-schedule-layout">
      <section class="detail-schedule-panel detail-schedule-panel--left">
        <header class="panel-header">
          <div class="panel-header__main">
            <span class="panel-title">待排班细化项目</span>
            <el-tag size="small" type="info">{{ unfinishedProjects.length }} 项</el-tag>
          </div>
          <div class="panel-filters">
            <el-checkbox v-model="includePaused">含已暂停</el-checkbox>
            <el-checkbox v-model="includeCancelled">含已取消</el-checkbox>
            <el-checkbox v-model="includeAssigned">含已分配</el-checkbox>
          </div>
          <el-input
            v-model="keyword"
            clearable
            placeholder="搜索项目号、名称或负责人"
            class="panel-search"
          />
        </header>

        <div class="panel-body">
          <div v-if="unfinishedProjects.length" class="project-list">
            <div
              v-for="project in unfinishedProjects"
              :key="project.projectNo"
              class="project-item"
              :class="{
                'is-dragging': draggingProjectNo === project.projectNo,
              }"
              draggable="true"
              @dragstart="handleProjectDragStart($event, project.projectNo)"
              @dragend="handleProjectDragEnd"
            >
              <div class="project-item__head">
                <span class="project-item__no">{{ ProjectForm.getDisplayProjectNo(project) }}</span>
                <div class="project-item__actions">
                  <el-tag size="small" :type="getStatusMeta(project.status).type">
                    {{ getStatusMeta(project.status).label }}
                  </el-tag>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    class="project-item__edit-btn"
                    title="编辑"
                    @click.stop="openEditDialog(project)"
                  >
                    <el-icon><EditPen /></el-icon>
                  </el-button>
                </div>
              </div>
              <div class="project-item__name">{{ project.name }}</div>
              <div class="project-item__meta">
                <span>负责人：{{ DetailTeamScheduleForm.formatAssignees(project) }}</span>
                <span v-if="project.plannedEndDate">计划完成：{{ project.plannedEndDate }}</span>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无符合条件的细化项目" :image-size="72" />
        </div>
      </section>

      <section class="detail-schedule-panel detail-schedule-panel--right">
        <header class="panel-header">
          <div class="panel-header__main">
            <span class="panel-title">细化组人员</span>
            <el-tag size="small" type="success">{{ memberWorkloads.length }} 人</el-tag>
          </div>
          <p class="panel-hint">将项目拖入人员卡片即可分配或转派；拖拽人员卡片标题栏可调整排列顺序</p>
        </header>

        <div class="panel-body">
          <div v-if="memberWorkloads.length" class="member-grid">
            <article
              v-for="member in memberWorkloads"
              :key="member.personnelId"
              class="member-card"
              :class="{
                'is-drop-target': dragOverMemberId === member.personnelId,
                'is-reorder-target': dragOverMemberReorderId === member.personnelId,
                'is-dragging-member': draggingMemberId === member.personnelId,
              }"
              @dragover.prevent="handleMemberDragOver($event, member.personnelId)"
              @dragleave="handleMemberDragLeave(member.personnelId)"
              @drop.prevent="handleMemberDrop($event, member.personnelId, member.name)"
            >
              <header
                class="member-card__header"
                draggable="true"
                title="拖拽调整人员顺序"
                @dragstart.stop="handleMemberCardDragStart($event, member.personnelId)"
                @dragend.stop="handleMemberCardDragEnd"
              >
                <div class="member-card__identity">
                  <span class="member-card__name">{{ member.name }}</span>
                  <span v-if="member.position" class="member-card__position">
                    {{ member.position }}
                  </span>
                </div>
                <div class="member-card__header-actions">
                  <el-tag size="small" type="primary">{{ member.projects.length }} 项进行中</el-tag>
                  <el-icon class="member-card__drag-icon"><Rank /></el-icon>
                </div>
              </header>

              <ul v-if="member.projects.length" class="member-project-list">
                <li
                  v-for="project in member.projects"
                  :key="project.projectNo"
                  class="member-project-item"
                  :class="{
                    'is-dragging': draggingProjectNo === project.projectNo,
                  }"
                  draggable="true"
                  @dragstart="
                    handleProjectDragStart($event, project.projectNo, member.personnelId)
                  "
                  @dragend="handleProjectDragEnd"
                >
                  <div class="member-project-item__main">
                    <span class="member-project-item__no">{{ ProjectForm.getDisplayProjectNo(project) }}</span>
                    <span class="member-project-item__name">{{ project.name }}</span>
                  </div>
                  <div class="member-project-item__actions">
                    <el-button
                      type="primary"
                      link
                      size="small"
                      class="member-project-item__edit-btn"
                      title="编辑"
                      @click.stop="openEditDialog(project)"
                    >
                      <el-icon><EditPen /></el-icon>
                    </el-button>
                    <el-icon class="member-project-item__drag-icon"><Rank /></el-icon>
                  </div>
                </li>
              </ul>
              <p v-else class="member-card__empty">拖入项目到此分配</p>
            </article>
          </div>
          <el-empty v-else description="暂无细化组在职人员" :image-size="72" />
        </div>
      </section>
    </div>
  </el-card>

  <ProjectEditDialog
    v-model:visible="editDialogVisible"
    :record="editingProject"
    @saved="handleProjectSaved"
  />
</template>

<style scoped>
.detail-schedule-card {
  --layout-top-height: 48px;
  --layout-tabs-height: 40px;
  --layout-main-padding: 30px;
  height: calc(100vh - var(--layout-top-height) - var(--layout-tabs-height) - var(--layout-main-padding));
  min-height: 400px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-schedule-card :deep(.el-card__header) {
  flex-shrink: 0;
}

.detail-schedule-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 6px 16px 16px;
}

.card-subtitle {
  font-size: 13px;
  font-weight: normal;
  color: var(--el-text-color-secondary);
}

.detail-schedule-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
  overflow: hidden;
}

.detail-schedule-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-bg-color);
}

.detail-schedule-panel--left {
  flex: 0 0 30%;
  min-width: 280px;
}

.detail-schedule-panel--right {
  flex: 1;
  min-width: 0;
}

.panel-header {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.panel-header__main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
}

.panel-filters :deep(.el-checkbox) {
  height: auto;
  margin-right: 0;
}

.panel-filters :deep(.el-checkbox__label) {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.panel-search {
  max-width: 100%;
}

.panel-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.panel-body:has(.el-empty) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.member-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  align-content: start;
  padding: 10px;
}

.project-item {
  display: block;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  cursor: grab;
  transition:
    border-color 0.2s,
    background-color 0.2s,
    box-shadow 0.2s,
    opacity 0.2s;
}

.project-item:hover {
  border-color: rgba(24, 144, 255, 0.35);
  background: rgba(24, 144, 255, 0.04);
}

.project-item.is-dragging,
.member-project-item.is-dragging {
  opacity: 0.45;
  border-style: dashed;
}

.project-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.project-item__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.project-item__edit-btn {
  padding: 0 4px;
  min-height: auto;
  height: auto;
}

.project-item__no {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.project-item__name {
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--el-text-color-regular);
}

.project-item__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.member-card {
  display: flex;
  flex-direction: column;
  min-height: 120px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-bg-color);
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background-color 0.2s;
}

.member-card.is-drop-target {
  border-color: var(--el-color-primary);
  background: rgba(24, 144, 255, 0.06);
  box-shadow: inset 0 0 0 1px var(--el-color-primary);
}

.member-card.is-reorder-target {
  border-color: var(--el-color-success);
  background: rgba(103, 194, 58, 0.06);
  box-shadow: inset 0 0 0 1px var(--el-color-success);
}

.member-card.is-dragging-member {
  opacity: 0.45;
}

.member-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  cursor: grab;
}

.member-card__header:active {
  cursor: grabbing;
}

.member-card__identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.member-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.member-card__position {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.member-card__header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.member-card__drag-icon {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
}

.member-project-list {
  margin: 0;
  padding: 8px 10px;
  list-style: none;
  flex: 1;
}

.member-project-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  margin-bottom: 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-bg-color);
  cursor: grab;
  transition:
    border-color 0.2s,
    background-color 0.2s,
    opacity 0.2s;
}

.member-project-item:last-child {
  margin-bottom: 0;
}

.member-project-item:hover {
  border-color: rgba(24, 144, 255, 0.35);
  background: rgba(24, 144, 255, 0.04);
}

.member-project-item__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.member-project-item__no {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.member-project-item__name {
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-project-item__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.member-project-item__edit-btn {
  padding: 0 4px;
  min-height: auto;
  height: auto;
}

.member-project-item__drag-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--el-text-color-placeholder);
}

.member-card__empty {
  margin: 0;
  padding: 16px 12px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>

<style>
body.is-detail-member-reordering .detail-schedule-card .member-card:not(.is-source-member-drag) .member-card__header {
  pointer-events: none;
}
</style>
