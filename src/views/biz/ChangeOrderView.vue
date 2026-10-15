<script setup lang="ts">
import '@/styles/biz-data-table.css'
import '@/styles/biz-page-card.css'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type UploadFile, type UploadUserFile } from 'element-plus'
import {
  appendChangeOrderPrimaryFiles,
  createChangeOrder,
  deleteChangeOrder,
  fetchChangeOrderList,
  updateChangeOrder,
} from '@/api/changeOrders'
import { createProject, fetchProjectList } from '@/api/projects'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'
import { PAGE_SIZE_OPTIONS } from '@/constants/pagination'
import { useProjectNoLookup } from '@/composables/useProjectNoLookup'
import { ChangeOrder } from '@/models/biz/changeOrder'
import type { ChangeOrderAttachment, ChangeOrderRecord } from '@/models/biz/changeOrder'
import { ProjectForm } from '@/models/biz/project'
import type { ProjectRecord } from '@/models/biz/project'
import ChangeOrderTable from '@/components/biz/ChangeOrderTable.vue'

const highlightedId = ref('')
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const originalOrderNo = ref('')
const originalPrimaryIds = ref<string[]>([])
const removedPrimaryIdsInSession = ref<Set<string>>(new Set())
const isDraggingPdf = ref(false)
const primaryPdfDropTargetId = ref('')
const changeOrderPageRef = ref<HTMLElement | null>(null)
const dropDialogVisible = ref(false)
const droppedPdfFiles = ref<File[]>([])
const dropAction = ref<'create' | 'append_primary'>('create')
const appendTargetId = ref('')
const appendSearchQuery = ref('')

const dialogTitle = computed(() => (editingId.value ? '编辑变更单' : '新建变更单'))

const searchForm = reactive({ keyword: '' })

const projectNoLookup = useProjectNoLookup()
const knownProjectNos = projectNoLookup.existing

const {
  pageSize,
  filteredData, total, page, loading,
  loadPage: loadCachedPage, clearFilterCache, patchItem, getFilters,
} = usePaginatedListCache<ChangeOrderRecord>({
  getItemKey: (item) => String(item.id),
  sortList: (list) => [...list].sort((a, b) => {
    const aDate = a.receivedDate || ''; const bDate = b.receivedDate || ''
    if (aDate !== bDate) return bDate.localeCompare(aDate)
    return b.id - a.id
  }),
})

type PaginatedFilters = { keyword?: string }

function buildListQuery(params: PaginatedFilters & { page?: number; pageSize?: number }) {
  return { keyword: params.keyword, page: params.page, pageSize: params.pageSize }
}

async function loadPage(pageNo = 1, nextFilters?: PaginatedFilters, force = false) {
  return loadCachedPage((params) => fetchChangeOrderList(buildListQuery(params)), pageNo, nextFilters, force)
}

const formRef = ref<FormInstance>()
const form = reactive(ChangeOrder.createEmptyForm())
const formRules = computed(() => editingId.value ? ChangeOrder.EDIT_FORM_RULES : ChangeOrder.FORM_RULES)

const projectNoSearchLoading = ref(false)
const projectNoOptions = ref<{ value: string; label: string }[]>([])
let projectNoSearchTimer: ReturnType<typeof setTimeout> | undefined
const PROJECT_NO_DIGIT_SEARCH_RE = /\d{4,5}/

function getLocalProjectNoMatches(keyword: string): { value: string; label: string }[] {
  const kw = keyword.toLowerCase()
  const options: { value: string; label: string }[] = []
  for (const no of knownProjectNos.value) {
    if (no.toLowerCase().includes(kw)) options.push({ value: no, label: no })
  }
  return options.slice(0, 20)
}

function mergeProjectNoOptions(
  ...groups: { value: string; label: string }[][]
): { value: string; label: string }[] {
  const seen = new Set<string>()
  const options: { value: string; label: string }[] = []
  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.value)) continue
      seen.add(item.value)
      options.push(item)
    }
  }
  return options.slice(0, 20)
}

async function searchProjectNos(query: string) {
  const keyword = query.trim()
  if (projectNoSearchTimer) clearTimeout(projectNoSearchTimer)
  if (!keyword) {
    projectNoOptions.value = []
    return
  }
  projectNoOptions.value = getLocalProjectNoMatches(keyword)
  projectNoSearchTimer = setTimeout(() => {
    void (async () => {
      projectNoSearchLoading.value = true
      try {
        await projectNoLookup.sync([keyword])
        let remoteOptions: { value: string; label: string }[] = []
        if (PROJECT_NO_DIGIT_SEARCH_RE.test(keyword)) {
          const result = await fetchProjectList({ keyword, page: 1, pageSize: 20 })
          remoteOptions = result.list.map((item) => ({
            value: item.projectNo,
            label: item.name ? `${item.projectNo} · ${item.name}` : item.projectNo,
          }))
          await projectNoLookup.sync(result.list.map((item) => item.projectNo))
        }
        projectNoOptions.value = mergeProjectNoOptions(getLocalProjectNoMatches(keyword), remoteOptions)
      } catch { /* ignore */ }
      finally { projectNoSearchLoading.value = false }
    })()
  }, 300)
}

const appendSearchResults = ref<ChangeOrderRecord[]>([])
const appendTargetOptions = computed(() => appendSearchResults.value)
const selectedAppendTarget = computed(() => appendSearchResults.value.find((item) => String(item.id) === appendTargetId.value) ?? null)
let appendSearchTimer: ReturnType<typeof setTimeout> | undefined

function formatChangeOrderOptionLabel(record: ChangeOrderRecord) {
  return ChangeOrder.formatDisplayId(record) + (record.title ? ' · ' + record.title : '')
}

async function searchAppendTargets(query: string) {
  const keyword = query.trim()
  if (!keyword) { appendSearchResults.value = []; return }
  try { appendSearchResults.value = (await fetchChangeOrderList({ keyword, pageSize: 20 })).list } catch { appendSearchResults.value = [] }
}

function filterAppendTargets(query: string) {
  appendSearchQuery.value = query
  if (appendSearchTimer) clearTimeout(appendSearchTimer)
  appendSearchTimer = setTimeout(() => { void searchAppendTargets(query) }, 300)
}

function resolveAppendTargetId() {
  if (appendTargetId.value) return appendTargetId.value
  const query = appendSearchQuery.value.trim()
  if (!query) return ''
  const nq = query.toLowerCase()
  const exact = appendSearchResults.value.find((item) => ChangeOrder.formatDisplayId(item).toLowerCase() === nq || String(item.id) === nq)
  if (exact) return String(exact.id)
  const matches = appendSearchResults.value.filter((item) =>
    ChangeOrder.formatDisplayId(item).toLowerCase().includes(nq) || item.title.toLowerCase().includes(nq))
  if (matches.length === 1) return String(matches[0]!.id)
  return ''
}

function openDropDialog(files: File[]) {
  droppedPdfFiles.value = files; dropAction.value = 'create'; appendTargetId.value = ''; appendSearchQuery.value = ''; dropDialogVisible.value = true
}

function handleDropDialogClosed() { droppedPdfFiles.value = []; dropAction.value = 'create'; appendTargetId.value = ''; appendSearchQuery.value = '' }

async function resolveAppendTarget() {
  if (!appendTargetId.value) { const resolvedId = resolveAppendTargetId(); if (resolvedId) appendTargetId.value = resolvedId }
  if (!appendTargetId.value) return null
  let target = appendSearchResults.value.find((item) => String(item.id) === appendTargetId.value)
  if (!target) {
    try { const result = await fetchChangeOrderList({ keyword: appendTargetId.value, pageSize: 20 }); target = result.list.find((item) => String(item.id) === appendTargetId.value) } catch { /* ignore */ }
  }
  return target ?? null
}

async function handleDropDialogConfirm() {
  const files = [...droppedPdfFiles.value]
  if (!files.length) { dropDialogVisible.value = false; return }
  if (dropAction.value === 'create') {
    dropDialogVisible.value = false; openCreateDialogWithFiles(files); handleDropDialogClosed(); return
  }
  const target = await resolveAppendTarget()
  if (!target) { ElMessage.warning('请选择或输入变更单号、项目号或变更主题以定位变更单'); return }
  try {
    const payloads = await ChangeOrder.filesToUploadPayload(await ChangeOrder.filesToAttachmentList(files))
    const updated = await appendChangeOrderPrimaryFiles(target.id, payloads)
    dropDialogVisible.value = false; handleDropDialogClosed()
    patchItem(String(target.id), () => updated)
    ElMessage.success(`正文已追加到变更单 ${ChangeOrder.formatDisplayId(target)}`)
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '追加正文失败') }
}

const isAnyDialogOpen = computed(() => dialogVisible.value || dropDialogVisible.value)
const showPageDropOverlay = computed(() => isDraggingPdf.value && !isAnyDialogOpen.value && !primaryPdfDropTargetId.value)
function hasFileDrag(event: DragEvent) { return event.dataTransfer?.types.includes('Files') }
function resetDragState() { isDraggingPdf.value = false; primaryPdfDropTargetId.value = '' }
function handlePageDragEnter(event: DragEvent) { event.preventDefault(); if (isAnyDialogOpen.value || !hasFileDrag(event)) return; isDraggingPdf.value = true }
function handlePageDragLeave(event: DragEvent) {
  if (isAnyDialogOpen.value) { resetDragState(); return }
  const pageEl = changeOrderPageRef.value; const related = event.relatedTarget as Node | null
  if (related && pageEl?.contains(related)) return; resetDragState()
}
function handleWindowDragEnd() { resetDragState() }
function handleWindowDragLeave(event: DragEvent) {
  if (!isDraggingPdf.value) return
  const { clientX, clientY } = event
  if (clientX <= 0 || clientY <= 0 || clientX >= window.innerWidth || clientY >= window.innerHeight) resetDragState()
}
function handlePageDragOver(event: DragEvent) { event.preventDefault(); if (isAnyDialogOpen.value) return }
async function handlePageDrop(event: DragEvent) {
  event.preventDefault(); resetDragState(); if (isAnyDialogOpen.value) return
  const files = ChangeOrder.extractFilesFromDrop(event.dataTransfer!)
  if (!files.length) { ElMessage.warning('请拖入文件'); return }
  openDropDialog(files)
}

async function handlePrimaryPdfDrop(row: ChangeOrderRecord, files: File[]) {
  resetDragState()
  if (!files.length) { ElMessage.warning('请拖入文件'); return }
  const fileLabel = files.length === 1 ? `「${files[0]!.name}」` : `${files.length} 个文件`
  try {
    await ElMessageBox.confirm(
      `是否将${fileLabel}追加为变更单「${ChangeOrder.formatDisplayId(row)} · ${row.title}」的正文？`,
      '追加正文',
      { type: 'info', confirmButtonText: '追加正文', cancelButtonText: '取消' },
    )
  } catch { return }
  try {
    const payloads = await ChangeOrder.filesToUploadPayload(await ChangeOrder.filesToAttachmentList(files))
    const updated = await appendChangeOrderPrimaryFiles(row.id, payloads)
    patchItem(String(row.id), () => updated)
    ElMessage.success(`正文已追加到变更单 ${ChangeOrder.formatDisplayId(row)}`)
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '追加正文失败') }
}

watch(isAnyDialogOpen, (open) => { if (open) resetDragState() })

function openAttachment(file: ChangeOrderAttachment) { if (file.url) window.open(file.url, '_blank') }
function isMissingProjectNo(projectNo: string) { return !knownProjectNos.value.has(projectNo) }
async function syncKnownProjectNosFromOrders() {
  const projectNos = [...new Set(filteredData.value.flatMap((item) => item.projectNos))]
  await projectNoLookup.sync(projectNos)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatProjectInfoMessage(project: ProjectRecord): string {
  const statusLabel = ProjectForm.STATUS_MAP[project.status]?.label || project.status || '-'
  const natures = (project.natures || [])
    .map((code) => ProjectForm.getNatureLabel(code) || code)
    .filter(Boolean)
    .join('、') || '-'
  const assignees = (project.assignedPersonnel || [])
    .map((item) => item.name || item.id)
    .filter(Boolean)
    .join('、') || '-'
  const tags = (project.tags || []).map((item) => item.name).filter(Boolean).join('、') || '-'
  const weight = project.estimatedWeightTons == null ? '-' : `${project.estimatedWeightTons} 吨`
  const lines = [
    `项目号：${project.projectNo || '-'}`,
    `项目名称：${project.name || '-'}`,
    `客户：${project.customer || '-'}`,
    `状态：${statusLabel}`,
    `性质：${natures}`,
    `是否甲供：${project.isJiagongdan ? '是' : '否'}`,
    `结构类型：${project.structureType || '-'}`,
    `预估吨位：${weight}`,
    `收单日期：${project.receivedDate || '-'}`,
    `计划开始：${project.plannedStartDate || '-'}`,
    `计划结束：${project.plannedEndDate || '-'}`,
    `实际开始：${project.actualStartDate || '-'}`,
    `实际结束：${project.actualEndDate || '-'}`,
    `负责人：${assignees}`,
    `标签：${tags}`,
    `关联联系单：${(project.contactFormIds || []).join('、') || '-'}`,
    `设计工作路径：${project.designWorkPath || '-'}`,
    `细化工作路径：${project.detailWorkPath || '-'}`,
    `本地工作路径：${project.localWorkPath || '-'}`,
  ]
  return lines.map(escapeHtml).join('<br>')
}

async function fetchProjectByNo(projectNo: string): Promise<ProjectRecord | null> {
  const result = await fetchProjectList({ keyword: projectNo, page: 1, pageSize: 20 })
  const exact = result.list.find((item) => item.projectNo === projectNo)
  if (exact) return exact
  return result.list.find((item) => item.baseProjectNo === projectNo) || null
}

async function showProjectInfoDialog(projectNo: string) {
  let project: ProjectRecord | null = null
  try {
    project = await fetchProjectByNo(projectNo)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目信息失败')
    return
  }

  try {
    if (!project) {
      await ElMessageBox.alert(`未找到项目号「${projectNo}」的项目信息`, '项目信息', {
        confirmButtonText: '知道了',
        type: 'warning',
        closeOnPressEscape: true,
        closeOnClickModal: true,
      })
      return
    }
    await ElMessageBox.alert(formatProjectInfoMessage(project), '项目信息', {
      confirmButtonText: '关闭',
      dangerouslyUseHTMLString: true,
      customClass: 'change-order-project-info-box',
      closeOnPressEscape: true,
      closeOnClickModal: true,
    })
  } catch {
    // 用户关闭弹窗（ESC / 遮罩 / 右上角关闭）会 reject，忽略即可
  }
}

async function createLinkedProject(projectNo: string, row: ChangeOrderRecord) {
  const draft = ProjectForm.createFromContact(projectNo, {
    contactFormId: undefined,
    contactTitle: row.title,
    receivedDate: row.receivedDate,
    plannedStartDate: row.receivedDate,
  })
  const created = await createProject({
    projectNo: draft.projectNo,
    name: draft.name,
    status: draft.status,
    plannedStartDate: draft.plannedStartDate,
  })
  projectNoLookup.markCreated(projectNo, created.projectNo)
  ElMessage.success(`项目 ${projectNo} 已创建`)
  try {
    await ElMessageBox.alert(formatProjectInfoMessage(created), '项目信息', {
      confirmButtonText: '关闭',
      dangerouslyUseHTMLString: true,
      customClass: 'change-order-project-info-box',
      closeOnPressEscape: true,
      closeOnClickModal: true,
    })
  } catch {
    // 用户关闭弹窗时忽略
  }
}

async function handleProjectNoClick(projectNo: string, row: ChangeOrderRecord) {
  if (!isMissingProjectNo(projectNo)) {
    await showProjectInfoDialog(projectNo)
    return
  }
  try {
    await ElMessageBox.confirm(
      `项目号「${projectNo}」尚无对应项目数据，是否新建项目？`,
      '新建项目',
      { type: 'info', confirmButtonText: '新建', cancelButtonText: '取消' },
    )
  } catch { return }
  try {
    await createLinkedProject(projectNo, row)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '新建项目失败')
  }
}

async function loadOrders(force = false) { try { await loadPage(1, { keyword: searchForm.keyword }, force); await syncKnownProjectNosFromOrders() } catch (error) { ElMessage.error(error instanceof Error ? error.message : '加载变更单数据失败') } }
async function handlePageChange(nextPage: number) { try { await loadPage(nextPage, getFilters()); highlightedId.value = ''; await syncKnownProjectNosFromOrders() } catch (error) { ElMessage.error(error instanceof Error ? error.message : '加载变更单数据失败') } }
async function handleSizeChange() { try { await loadPage(1, getFilters()); highlightedId.value = ''; await syncKnownProjectNosFromOrders() } catch (error) { ElMessage.error(error instanceof Error ? error.message : '加载变更单数据失败') } }
async function handleSearch() { await loadOrders(true) }
async function handleReset() { searchForm.keyword = ''; highlightedId.value = ''; await loadOrders(false) }

async function openCreateDialogWithFiles(files: File[]) {
  editingId.value = null; originalOrderNo.value = ''; originalPrimaryIds.value = []; removedPrimaryIdsInSession.value = new Set(); resetForm()
  try {
    form.primaryPdfList = await ChangeOrder.filesToAttachmentList(files)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '无法读取所选文件')
    return
  }
  const firstName = files[0]?.name.replace(/\.[^.]+$/i, '') || ''; if (firstName) form.title = firstName
  dialogVisible.value = true
}
function openCreateDialog() {
  editingId.value = null; originalOrderNo.value = ''; originalPrimaryIds.value = []; removedPrimaryIdsInSession.value = new Set(); resetForm(); dialogVisible.value = true
}
function openEditDialog(row: ChangeOrderRecord) {
  editingId.value = row.id; originalOrderNo.value = row.orderNo || ''
  originalPrimaryIds.value = ChangeOrder.getCurrentPrimaryPdfs(row).map((item) => item.id)
  removedPrimaryIdsInSession.value = new Set()
  Object.assign(form, ChangeOrder.createFormFromRecord(row)); dialogVisible.value = true
}
function resetForm() { Object.assign(form, ChangeOrder.createEmptyForm()); formRef.value?.clearValidate() }
function handleDialogClose() {
  editingId.value = null; originalOrderNo.value = ''; originalPrimaryIds.value = []; removedPrimaryIdsInSession.value = new Set(); resetForm()
}
async function handlePrimaryPdfChange(_file: UploadFile, fileList: UploadUserFile[]) {
  try {
    form.primaryPdfList = await ChangeOrder.snapshotUploadFiles(fileList)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '无法读取所选文件')
    form.primaryPdfList = fileList.filter((item) => item.uid !== _file.uid)
  }
}
function handlePrimaryPdfRemove(file: UploadFile, fileList: UploadUserFile[]) {
  const fileId = ChangeOrder.getAttachmentIdFromUploadFile(file)
  if (fileId) removedPrimaryIdsInSession.value.add(fileId)
  form.primaryPdfList = [...fileList]
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false); if (!valid) return
  try {
    if (editingId.value) {
      const oldId = editingId.value
      const updatePayload: Parameters<typeof updateChangeOrder>[1] = {
        orderNo: form.orderNo?.trim() ?? '',
        title: form.title,
        receivedDate: form.receivedDate,
        content: form.content,
        projectNos: [...form.projectNos],
      }
      const remainingIds = ChangeOrder.getRemainingPrimaryIds(form.primaryPdfList)
      const removedPrimaryIds = (() => {
        const remain = new Set(remainingIds); const removed: string[] = []
        for (const id of originalPrimaryIds.value) {
          if (!remain.has(id) || removedPrimaryIdsInSession.value.has(id)) removed.push(id)
        }
        return removed
      })()
      const newFiles = ChangeOrder.getNewPrimaryFiles(form.primaryPdfList)
      const filesChanged = removedPrimaryIds.length > 0 || newFiles.length > 0
      if (removedPrimaryIds.length) updatePayload.removedPrimaryIds = removedPrimaryIds
      if (newFiles.length) updatePayload.primaryFiles = await ChangeOrder.uploadFilesFromList(newFiles)
      const orderNoChanged = (form.orderNo?.trim() ?? '') !== originalOrderNo.value
      const updated = await updateChangeOrder(oldId, updatePayload)
      if (orderNoChanged || filesChanged) { const activeFilters = getFilters(); clearFilterCache(activeFilters); await loadPage(page.value, activeFilters, true) }
      else { patchItem(String(oldId), () => updated) }
      await syncKnownProjectNosFromOrders(); ElMessage.success('变更单已更新')
    } else {
      const primaryFiles = await ChangeOrder.uploadFilesFromList(form.primaryPdfList)
      await createChangeOrder({
        orderNo: form.orderNo?.trim() || undefined,
        title: form.title,
        receivedDate: form.receivedDate,
        content: form.content,
        projectNos: [...form.projectNos],
        primaryFiles,
      })
      const activeFilters = getFilters(); clearFilterCache(activeFilters); await loadPage(1, activeFilters, true)
      await syncKnownProjectNosFromOrders(); ElMessage.success('变更单已提交')
    }
    dialogVisible.value = false
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '保存变更单失败') }
}

async function handleReceivedDateUpdated(order: ChangeOrderRecord) { patchItem(String(order.id), () => order) }
async function handleDelete(row: ChangeOrderRecord) {
  try { await ElMessageBox.confirm(`确定删除变更单「${row.title}」吗？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try {
    await deleteChangeOrder(row.id); const activeFilters = getFilters(); clearFilterCache(activeFilters)
    const nextPage = filteredData.value.length <= 1 && page.value > 1 ? page.value - 1 : page.value
    await loadPage(nextPage, activeFilters, true); await syncKnownProjectNosFromOrders(); ElMessage.success('变更单已删除')
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '删除变更单失败') }
}

onMounted(async () => { await loadOrders(false); window.addEventListener('dragend', handleWindowDragEnd); document.addEventListener('dragleave', handleWindowDragLeave) })
onUnmounted(() => {
  if (appendSearchTimer) clearTimeout(appendSearchTimer)
  if (projectNoSearchTimer) clearTimeout(projectNoSearchTimer)
  window.removeEventListener('dragend', handleWindowDragEnd)
  document.removeEventListener('dragleave', handleWindowDragLeave)
  resetDragState()
})
</script>

<template>
  <div ref="changeOrderPageRef" class="change-order-page" @dragenter="handlePageDragEnter" @dragleave="handlePageDragLeave" @dragover="handlePageDragOver" @drop="handlePageDrop">
    <el-card shadow="never" class="biz-page-card">
      <template #header>
        <div class="card-header">
          <div class="card-header__title"><span class="card-title">变更单管理</span>
            <span class="drag-tip"><el-icon class="drag-tip__icon"><Upload /></el-icon>拖到正文列追加文件；拖到页面空白处可新建或追加正文</span>
          </div>
          <el-button type="primary" @click="openCreateDialog">新建变更单</el-button>
        </div>
      </template>
      <div class="search-toolbar">
        <el-form :inline="true" :model="searchForm" class="search-form">
          <el-form-item label="关键词"><el-input v-model="searchForm.keyword" placeholder="单号 / 主题 / 项目号" clearable @keyup.enter="handleSearch" /></el-form-item>
          <el-form-item><el-button type="primary" @click="handleSearch">查询</el-button><el-button @click="handleReset">重置</el-button></el-form-item>
        </el-form>
        <span class="search-total">共 {{ total }} 条</span>
      </div>
      <div class="table-scroll">
        <ChangeOrderTable v-model:primary-pdf-drop-target-id="primaryPdfDropTargetId"
          :data="filteredData" :loading="loading" :highlighted-id="highlightedId" :known-project-nos="knownProjectNos"
          @edit="openEditDialog" @delete="handleDelete" @project-no-click="handleProjectNoClick" @received-date-updated="handleReceivedDateUpdated"
          @primary-pdf-drop="handlePrimaryPdfDrop" />
      </div>
      <div class="table-pagination"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[...PAGE_SIZE_OPTIONS]" :total="total" layout="total, sizes, prev, pager, next, jumper" background @size-change="handleSizeChange" @current-change="handlePageChange" /></div>
    </el-card>
    <div v-if="showPageDropOverlay" class="drop-overlay"><el-icon :size="40"><Upload /></el-icon><p>松开鼠标，导入文件</p></div>

    <el-dialog v-model="dropDialogVisible" title="导入文件" width="520px" destroy-on-close @closed="handleDropDialogClosed">
      <div class="drop-file-list"><span class="drop-file-list__label">已拖入 {{ droppedPdfFiles.length }} 个文件</span><div class="drop-file-list__items"><el-tag v-for="file in droppedPdfFiles" :key="file.name + file.lastModified" size="small">{{ file.name }}</el-tag></div></div>
      <el-radio-group v-model="dropAction" class="drop-action-group"><el-radio value="create">新建变更单</el-radio><el-radio value="append_primary">追加正文（同一张单）</el-radio></el-radio-group>
      <div v-if="dropAction === 'append_primary'" class="append-target-field">
        <el-select v-model="appendTargetId" filterable clearable :filter-method="filterAppendTargets" placeholder="输入变更单号、项目号或变更主题搜索" style="width: 100%" no-data-text="未找到匹配的变更单">
          <el-option v-for="item in appendTargetOptions" :key="item.id" :label="formatChangeOrderOptionLabel(item)" :value="String(item.id)">
            <div class="append-option"><span class="append-option__main">{{ formatChangeOrderOptionLabel(item) }}</span><span v-if="item.projectNos?.length" class="append-option__sub">项目号：{{ item.projectNos.join('、') }}</span></div>
          </el-option>
        </el-select>
        <p v-if="selectedAppendTarget" class="append-target-preview">正文将追加到：{{ formatChangeOrderOptionLabel(selectedAppendTarget) }}</p>
      </div>
      <template #footer><el-button @click="dropDialogVisible = false">取消</el-button><el-button type="primary" @click="handleDropDialogConfirm">确定</el-button></template>
    </el-dialog>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" destroy-on-close @closed="handleDialogClose">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="变更单号" prop="orderNo">
          <el-input v-model="form.orderNo" :placeholder="editingId ? '请输入变更单号' : '留空自动生成（格式: BG年月日序号）'" />
        </el-form-item>
        <el-form-item label="变更主题" prop="title"><el-input v-model="form.title" placeholder="请输入变更主题" /></el-form-item>
        <el-form-item label="项目号">
          <el-select v-model="form.projectNos" multiple filterable remote :remote-method="searchProjectNos" :loading="projectNoSearchLoading" :reserve-keyword="false" allow-create default-first-option placeholder="输入项目号搜索已有项目，或直接回车创建新项目号" style="width: 100%">
            <el-option v-for="item in projectNoOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="收单日期" prop="receivedDate"><el-date-picker v-model="form.receivedDate" type="date" placeholder="选择收单日期" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
        <el-form-item label="变更内容" prop="content"><el-input v-model="form.content" type="textarea" :rows="4" placeholder="请输入变更内容（可留空）" /></el-form-item>
        <el-form-item label="正文">
          <div class="primary-pdf-editor">
            <el-upload v-model:file-list="form.primaryPdfList" class="attachment-upload" drag multiple :auto-upload="false" :on-change="handlePrimaryPdfChange" :on-remove="handlePrimaryPdfRemove">
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon><div class="el-upload__text">将文件拖到此处，或<em>点击选择</em></div>
              <template #tip><div class="upload-tip">{{ editingId ? '可追加或移除正文文件；文件先在本地暂存，保存变更单时再上传' : '正文文件先在本地暂存，提交变更单时再上传' }}</div></template>
            </el-upload>
            <div v-if="editingId && form.primaryPdfVersions?.length" class="pdf-version-list">
              <div class="pdf-version-list__title">历史版本</div>
              <div v-for="version in form.primaryPdfVersions" :key="version.id" class="pdf-version-item">
                <span class="pdf-version-item__label">v{{ version.version }} · {{ version.name }}</span>
                <span class="pdf-version-item__date">{{ ChangeOrder.toDateOnly(version.createdAt) }}</span>
                <el-button v-if="version.url" type="primary" link @click="openAttachment(version)">查看</el-button>
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">{{ editingId ? '保存' : '提交' }}</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.change-order-page { position: relative; min-height: 100%; }
.drop-overlay { position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: color-mix(in srgb, var(--el-bg-color) 88%, transparent); border: 2px dashed var(--el-color-primary); border-radius: 4px; color: var(--el-color-primary); pointer-events: none; }
.drop-overlay p { margin: 0; font-size: 14px; }
.drop-file-list { margin-bottom: 16px; }
.drop-file-list__label { display: block; margin-bottom: 8px; font-size: 13px; color: var(--el-text-color-secondary); }
.drop-file-list__items { display: flex; flex-wrap: wrap; gap: 6px; }
.drop-action-group { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.append-target-field { margin-top: 16px; }
.append-target-preview { margin: 8px 0 0; font-size: 12px; color: var(--el-text-color-secondary); }
.append-option { display: flex; flex-direction: column; gap: 2px; line-height: 1.4; padding: 2px 0; }
.append-option__main { font-size: 13px; color: var(--el-text-color-primary); }
.append-option__sub { font-size: 12px; color: var(--el-text-color-secondary); }
.drag-tip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 400; line-height: 1.2; color: var(--el-text-color-secondary); }
.drag-tip__icon { flex-shrink: 0; font-size: 13px; color: var(--el-text-color-placeholder); }
.attachment-upload { width: 100%; }
.upload-tip { margin-top: 6px; font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.5; }
.primary-pdf-editor { width: 100%; }
.pdf-version-list { margin-top: 12px; padding: 10px 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 4px; background: var(--el-fill-color-blank); }
.pdf-version-list__title { margin-bottom: 8px; font-size: 12px; font-weight: 500; color: var(--el-text-color-secondary); }
.pdf-version-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; }
.pdf-version-item + .pdf-version-item { border-top: 1px dashed var(--el-border-color-lighter); margin-top: 4px; padding-top: 8px; }
.pdf-version-item__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdf-version-item__date { flex-shrink: 0; font-size: 12px; color: var(--el-text-color-secondary); }
</style>

<style>
.change-order-project-info-box .el-message-box__message {
  max-height: min(60vh, 480px);
  overflow: auto;
  line-height: 1.7;
  white-space: normal;
  word-break: break-all;
}
</style>
