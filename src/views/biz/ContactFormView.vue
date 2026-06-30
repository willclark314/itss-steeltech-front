<script setup lang="ts">
import '@/styles/biz-data-table.css'
import '@/styles/biz-page-card.css'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type UploadFile, type UploadUserFile } from 'element-plus'
import {
  appendContactAttachments,
  createChildContact,
  createContact,
  deleteContact,
  fetchContactList,
  updateContact,
} from '@/api/contacts'
import { checkProjectNos, createProject } from '@/api/projects'
import { ContactForm } from '@/models/biz/contact'
import type { ContactAttachment, ContactRecord, ContactStatus, ProjectLink } from '@/models/biz/contact'
import { ProjectForm } from '@/models/biz/project'
import { BIZ_ROUTES, buildProjectRouteQuery } from '@/models/biz/navigation'

const route = useRoute()
const router = useRouter()

const tableRef = ref()
const highlightedContactId = ref('')
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const isDraggingPdf = ref(false)
const attachmentDropTargetId = ref('')
const contactPageRef = ref<HTMLElement | null>(null)
const dropDialogVisible = ref(false)
const droppedPdfFiles = ref<File[]>([])
const dropAction = ref<'create' | 'append_attachment' | 'append_contact'>('create')
const appendTargetId = ref('')
const appendSearchQuery = ref('')
const childDialogVisible = ref(false)
const childParentId = ref('')
const childParentRecord = ref<ContactRecord | null>(null)
const childFormRef = ref<FormInstance>()
const childForm = reactive(ContactForm.createEmptyChildForm())
const childDroppedFiles = ref<File[]>([])

const dialogTitle = computed(() => (editingId.value ? '编辑联系单' : '新建联系单'))

const searchForm = reactive({
  keyword: '',
  status: '',
})

const statusOptions = ContactForm.STATUS_OPTIONS
const statusMap = ContactForm.STATUS_MAP
const relationTypeMap = ContactForm.RELATION_TYPE_MAP
const relationTypeOptions = ContactForm.RELATION_TYPE_OPTIONS
const projectSourceMap = ContactForm.PROJECT_SOURCE_MAP

const knownProjectNos = ref(new Set<string>())
const appendSearchResults = ref<ContactRecord[]>([])

// ── 分页列表 ──
const pageSize = 20
const filteredData = ref<ContactRecord[]>([])
const total = ref(0)
const page = ref(1)
const totalPages = ref(1)
const loading = ref(false)

type PaginatedFilters = { keyword?: string; status?: string }

const listCache = new Map<
  string,
  { list: ContactRecord[]; total: number; page: number; pageSize: number; totalPages: number }
>()
let listFilters: PaginatedFilters = {}

function buildListCacheKey(pageNo: number, nextFilters = listFilters) {
  return JSON.stringify({ ...nextFilters, page: pageNo, pageSize })
}

function applyListResult(result: {
  list: ContactRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}) {
  filteredData.value = result.list
  total.value = result.total
  page.value = result.page
  totalPages.value = result.totalPages
  listCache.set(buildListCacheKey(result.page), {
    list: [...result.list],
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  })
}

async function loadPage(pageNo = 1, nextFilters?: PaginatedFilters, force = false) {
  if (nextFilters) {
    const filtersChanged = JSON.stringify(nextFilters) !== JSON.stringify(listFilters)
    if (filtersChanged) {
      clearCache()
      listFilters = { ...nextFilters }
    }
  }

  const cacheKey = buildListCacheKey(pageNo)
  if (!force && listCache.has(cacheKey)) {
    applyListResult(listCache.get(cacheKey)!)
    return
  }

  loading.value = true
  try {
    const result = await fetchContactList({
      ...listFilters,
      page: pageNo,
      pageSize,
    })
    applyListResult(result)
  } finally {
    loading.value = false
  }
}

async function loadAroundAnchor(anchor: string, nextFilters?: PaginatedFilters) {
  if (nextFilters) {
    listFilters = { ...nextFilters }
  }

  const cacheKey = `${JSON.stringify({ ...listFilters, pageSize })}::anchor::${anchor}`
  if (listCache.has(cacheKey)) {
    applyListResult(listCache.get(cacheKey)!)
    return
  }

  loading.value = true
  try {
    const result = await fetchContactList({
      ...listFilters,
      anchor,
      pageSize,
    })
    listCache.set(cacheKey, {
      list: [...result.list],
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
    listCache.set(buildListCacheKey(result.page), {
      list: [...result.list],
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
    applyListResult(result)
  } finally {
    loading.value = false
  }
}

function clearCache() {
  listCache.clear()
}

function patchItem(key: string, updater: (item: ContactRecord) => ContactRecord) {
  const currentIndex = filteredData.value.findIndex((item) => item.id === key)
  if (currentIndex !== -1) {
    filteredData.value[currentIndex] = updater(filteredData.value[currentIndex]!)
  }

  for (const [cacheKey, cached] of listCache.entries()) {
    const index = cached.list.findIndex((item) => item.id === key)
    if (index === -1) continue

    const nextList = [...cached.list]
    nextList[index] = updater(nextList[index]!)
    listCache.set(cacheKey, {
      ...cached,
      list: nextList,
    })
  }
}

const formRef = ref<FormInstance>()
const form = reactive(ContactForm.createEmptyForm())

const formRules = computed(() => (editingId.value ? ContactForm.EDIT_FORM_RULES : ContactForm.FORM_RULES))

const appendTargetOptions = computed(() => appendSearchResults.value)

const selectedAppendTarget = computed(() =>
  appendSearchResults.value.find((item) => item.id === appendTargetId.value) ?? null,
)
const showPageDropOverlay = computed(
  () => isDraggingPdf.value && !attachmentDropTargetId.value,
)
const attachmentTooltip = reactive({
  visible: false,
  text: '',
  top: 0,
  left: 0,
})

function openCreateDialogWithAttachments(files: File[]) {
  editingId.value = null
  resetForm()
  form.primaryPdfList = ContactForm.filesToAttachmentList(files.slice(0, 1))
  form.attachmentList = ContactForm.filesToAttachmentList(files.slice(1))

  const firstName = files[0]?.name.replace(/\.pdf$/i, '') || ''
  if (firstName) {
    form.title = firstName
  }

  dialogVisible.value = true
}

function openChildDialog(parent: ContactRecord, files: File[] = []) {
  childParentId.value = parent.id
  childParentRecord.value = parent
  Object.assign(childForm, ContactForm.createEmptyChildForm(parent))
  childDroppedFiles.value = files
  childForm.primaryPdfList = ContactForm.filesToAttachmentList(files.slice(0, 1))
  const firstName = files[0]?.name.replace(/\.pdf$/i, '') || ''
  if (firstName) childForm.title = firstName
  childDialogVisible.value = true
}

function resetChildForm() {
  Object.assign(childForm, ContactForm.createEmptyChildForm(childParentRecord.value || undefined))
  childDroppedFiles.value = []
  childFormRef.value?.clearValidate()
}

function getProjectLinks(row: ContactRecord): ProjectLink[] {
  return ContactForm.getProjectLinks(row)
}

function getRelationMeta(row: ContactRecord) {
  const type = row.relationType || 'primary'
  return relationTypeMap[type]
}

function getProjectTagType(link: ProjectLink) {
  return projectSourceMap[link.sourceType]?.tagType || 'primary'
}

function hasFileDrag(event: DragEvent) {
  return event.dataTransfer?.types.includes('Files')
}

function resetDragState() {
  isDraggingPdf.value = false
  attachmentDropTargetId.value = ''
}

function handlePageDragEnter(event: DragEvent) {
  event.preventDefault()
  if (!hasFileDrag(event)) return
  isDraggingPdf.value = true
}

function handlePageDragLeave(event: DragEvent) {
  const pageEl = contactPageRef.value
  const related = event.relatedTarget as Node | null
  if (related && pageEl?.contains(related)) return
  resetDragState()
}

function handleWindowDragEnd() {
  resetDragState()
}

function handleWindowDragLeave(event: DragEvent) {
  if (!isDraggingPdf.value) return

  const { clientX, clientY } = event
  const leftViewport =
    clientX <= 0 ||
    clientY <= 0 ||
    clientX >= window.innerWidth ||
    clientY >= window.innerHeight

  if (leftViewport) {
    resetDragState()
  }
}

function handlePageDragOver(event: DragEvent) {
  event.preventDefault()
}

let appendSearchTimer: ReturnType<typeof setTimeout> | undefined

async function searchAppendTargets(query: string) {
  const keyword = query.trim()
  if (!keyword) {
    appendSearchResults.value = []
    return
  }

  try {
    const result = await fetchContactList({ keyword, pageSize: 20 })
    appendSearchResults.value = result.list
  } catch {
    appendSearchResults.value = []
  }
}

function filterAppendTargets(query: string) {
  appendSearchQuery.value = query
  if (appendSearchTimer) clearTimeout(appendSearchTimer)
  appendSearchTimer = setTimeout(() => {
    void searchAppendTargets(query)
  }, 300)
}

function resolveAppendTargetId() {
  if (appendTargetId.value) return appendTargetId.value

  const query = appendSearchQuery.value.trim()
  if (!query) return ''

  const normalizedQuery = query.toLowerCase()
  const exactId = appendSearchResults.value.find((item) => item.id.toLowerCase() === normalizedQuery)
  if (exactId) return exactId.id

  const matches = ContactForm.findByKeyword(appendSearchResults.value, query)
  if (matches.length === 1) return matches[0]!.id

  return ''
}

function openDropDialog(files: File[]) {
  droppedPdfFiles.value = files
  dropAction.value = 'create'
  appendTargetId.value = ''
  appendSearchQuery.value = ''
  dropDialogVisible.value = true
}

function handleDropDialogClosed() {
  droppedPdfFiles.value = []
  dropAction.value = 'create'
  appendTargetId.value = ''
  appendSearchQuery.value = ''
}

async function resolveAppendTarget() {
  if (!appendTargetId.value) {
    const resolvedId = resolveAppendTargetId()
    if (resolvedId) appendTargetId.value = resolvedId
  }
  if (!appendTargetId.value) return null

  let target = appendSearchResults.value.find((item) => item.id === appendTargetId.value)
  if (!target) {
    try {
      const result = await fetchContactList({ keyword: appendTargetId.value, pageSize: 20 })
      target = result.list.find((item) => item.id === appendTargetId.value)
    } catch {
      target = undefined
    }
  }
  return target ?? null
}

async function handleDropDialogConfirm() {
  const files = [...droppedPdfFiles.value]
  if (!files.length) {
    dropDialogVisible.value = false
    return
  }

  if (dropAction.value === 'create') {
    dropDialogVisible.value = false
    openCreateDialogWithAttachments(files)
    handleDropDialogClosed()
    return
  }

  const target = await resolveAppendTarget()
  if (!target) {
    ElMessage.warning('请选择或输入单号、项目号、联系主题以定位联系单')
    return
  }

  if (dropAction.value === 'append_attachment') {
    try {
      const payloads = await ContactForm.filesToUploadPayload(files)
      await appendContactAttachments(target.id, payloads)
      dropDialogVisible.value = false
      handleDropDialogClosed()
      await loadContacts()
      ElMessage.success(`附件已追加到联系单 ${target.id}`)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '追加附件失败')
    }
    return
  }

  dropDialogVisible.value = false
  handleDropDialogClosed()
  openChildDialog(target, files)
}

async function handlePageDrop(event: DragEvent) {
  event.preventDefault()
  resetDragState()

  const pdfFiles = ContactForm.extractPdfFilesFromDrop(event.dataTransfer!)
  if (!pdfFiles.length) {
    ElMessage.warning('请拖入 PDF 文件')
    return
  }

  openDropDialog(pdfFiles)
}

function handleAttachmentDragOver(event: DragEvent, row: ContactRecord) {
  event.preventDefault()
  event.stopPropagation()
  if (!hasFileDrag(event)) return
  attachmentDropTargetId.value = row.id
}

function handleAttachmentDragLeave(event: DragEvent, row: ContactRecord) {
  const current = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (related && current?.contains(related)) return
  if (attachmentDropTargetId.value === row.id) {
    attachmentDropTargetId.value = ''
  }
}

async function handleAttachmentDrop(event: DragEvent, row: ContactRecord) {
  event.preventDefault()
  event.stopPropagation()
  resetDragState()

  const pdfFiles = ContactForm.extractPdfFilesFromDrop(event.dataTransfer!)
  if (!pdfFiles.length) {
    ElMessage.warning('请拖入 PDF 文件')
    return
  }

  const fileLabel =
    pdfFiles.length === 1 ? `「${pdfFiles[0]!.name}」` : `${pdfFiles.length} 个 PDF 文件`

  try {
    await ElMessageBox.confirm(
      `是否将 ${fileLabel} 追加到联系单「${row.id} · ${row.title}」？`,
      '追加 PDF',
      {
        type: 'info',
        confirmButtonText: '追加',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  try {
    const payloads = await ContactForm.filesToUploadPayload(pdfFiles)
    const updated = await appendContactAttachments(row.id, payloads)
    patchItem(row.id, () => updated)
    ElMessage.success(`附件已追加到联系单 ${row.id}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '追加附件失败')
  }
}

function handleAttachmentChange(file: UploadFile, fileList: UploadUserFile[]) {
  if (!ContactForm.isPdfFile(file)) {
    ElMessage.warning('仅支持上传 PDF 文件')
    form.attachmentList = fileList.filter((item) => item.uid !== file.uid)
    return
  }
  form.attachmentList = fileList
}

function handleAttachmentRemove(_file: UploadFile, fileList: UploadUserFile[]) {
  form.attachmentList = fileList
}

function handlePrimaryPdfChange(file: UploadFile, fileList: UploadUserFile[]) {
  if (!ContactForm.isPdfFile(file)) {
    ElMessage.warning('仅支持上传 PDF 文件')
    form.primaryPdfList = fileList.filter((item) => item.uid !== file.uid)
    return
  }
  form.primaryPdfList = fileList.slice(-1)
}

function handlePrimaryPdfRemove(_file: UploadFile, fileList: UploadUserFile[]) {
  form.primaryPdfList = fileList
}

function handleChildPrimaryPdfChange(file: UploadFile, fileList: UploadUserFile[]) {
  if (!ContactForm.isPdfFile(file)) {
    ElMessage.warning('仅支持上传 PDF 文件')
    childForm.primaryPdfList = fileList.filter((item) => item.uid !== file.uid)
    return
  }
  childForm.primaryPdfList = fileList.slice(-1)
}

function handleChildPrimaryPdfRemove(_file: UploadFile, fileList: UploadUserFile[]) {
  childForm.primaryPdfList = fileList
}

function openAttachment(file: ContactAttachment) {
  if (file.url) {
    window.open(file.url, '_blank')
  }
}

function showAttachmentHint(event: MouseEvent, name: string) {
  const cell = (event.currentTarget as HTMLElement | null)?.closest('.attachment-cell')
  if (!cell) return

  const rect = cell.getBoundingClientRect()
  attachmentTooltip.text = name
  attachmentTooltip.top = rect.top + rect.height / 2
  attachmentTooltip.left = rect.left
  attachmentTooltip.visible = true
}

function hideAttachmentHint() {
  attachmentTooltip.visible = false
  attachmentTooltip.text = ''
}

function toContactRecord(row: unknown): ContactRecord {
  return row as ContactRecord
}

function getStatusMeta(status: ContactStatus) {
  return statusMap[status]
}

function canEditRow(row: unknown) {
  return ContactForm.wrap(toContactRecord(row)).canEdit()
}

function canCancelRow(row: unknown) {
  return ContactForm.wrap(toContactRecord(row)).canCancel()
}

function goToProject(projectNo: string, projectNos: string[] = []) {
  router.push({
    path: BIZ_ROUTES.project,
    query: buildProjectRouteQuery(projectNo, projectNos),
  })
}

function isMissingProjectNo(projectNo: string) {
  return !knownProjectNos.value.has(projectNo)
}

async function syncKnownProjectNosFromContacts() {
  const projectNos = [...new Set(filteredData.value.flatMap((item) => item.projectNos))]
  if (!projectNos.length) {
    knownProjectNos.value = new Set()
    return
  }

  try {
    const result = await checkProjectNos(projectNos)
    knownProjectNos.value = new Set(result.existing)
  } catch {
    knownProjectNos.value = new Set()
  }
}

async function handleProjectNoClick(projectNo: string, row: ContactRecord) {
  if (!isMissingProjectNo(projectNo)) {
    goToProject(projectNo, row.projectNos)
    return
  }

  try {
    await ElMessageBox.confirm(
      `项目号「${projectNo}」尚无对应项目数据，是否新建项目？`,
      '新建项目',
      {
        type: 'info',
        confirmButtonText: '新建',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  try {
    const draft = ProjectForm.createFromContact(projectNo, {
      contactFormId: row.id,
      contactTitle: row.title,
      receivedDate: row.receivedDate,
      plannedStartDate: row.receivedDate,
    })
    const created = await createProject({
      projectNo: draft.projectNo,
      name: draft.name,
      status: draft.status,
      plannedStartDate: draft.plannedStartDate,
      contactFormId: row.id,
    })
    knownProjectNos.value.add(created.projectNo)
    ElMessage.success(`项目 ${projectNo} 已创建`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '新建项目失败')
  }
}

async function loadContacts() {
  try {
    await loadPage(1, {
      keyword: searchForm.keyword,
      status: searchForm.status,
    })
    await syncKnownProjectNosFromContacts()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
  }
}

async function handlePageChange(nextPage: number) {
  try {
    await loadPage(nextPage)
    highlightedContactId.value = ''
    nextTick(() => tableRef.value?.setScrollTop(0))
    await syncKnownProjectNosFromContacts()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
  }
}

async function handleSearch() {
  if (route.query.contactId) {
    router.replace({ path: BIZ_ROUTES.contact })
  }
  await loadContacts()
}

async function handleReset() {
  searchForm.keyword = ''
  searchForm.status = ''
  highlightedContactId.value = ''
  if (route.query.contactId) {
    router.replace({ path: BIZ_ROUTES.contact })
  }
  await loadContacts()
}

function getRowClassName({ row }: { row: ContactRecord }) {
  const classes: string[] = []
  if (row.id === highlightedContactId.value) classes.push('is-highlighted')
  if ((row.sortOrder ?? 0) > 0) classes.push('is-child-row')
  if (row.relationType === 'cancel') classes.push('is-cancel-row')
  return classes.join(' ')
}

function scrollToContact(contactId: string) {
  const index = filteredData.value.findIndex((item) => item.id === contactId)
  if (index === -1) return

  const rows = tableRef.value?.$el?.querySelectorAll('.el-table__body .el-table__row')
  rows?.[index]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

async function applyContactIdFromRoute() {
  const contactId = route.query.contactId

  if (typeof contactId === 'string' && contactId) {
    searchForm.keyword = ''
    searchForm.status = ''
    highlightedContactId.value = contactId
    try {
      await loadAroundAnchor(contactId, {})
      await syncKnownProjectNosFromContacts()
      nextTick(() => scrollToContact(contactId))
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
    }
    return
  }

  highlightedContactId.value = ''
}

watch(
  () => route.query.contactId,
  () => {
    void applyContactIdFromRoute()
  },
)

onMounted(async () => {
  if (route.query.contactId) {
    await applyContactIdFromRoute()
  } else {
    await loadContacts()
  }
  window.addEventListener('dragend', handleWindowDragEnd)
  document.addEventListener('dragleave', handleWindowDragLeave)
})

onUnmounted(() => {
  if (appendSearchTimer) clearTimeout(appendSearchTimer)
  window.removeEventListener('dragend', handleWindowDragEnd)
  document.removeEventListener('dragleave', handleWindowDragLeave)
  resetDragState()
})

function openCreateDialog() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row: ContactRecord) {
  editingId.value = row.id
  Object.assign(form, ContactForm.createFormFromRecord(row))
  dialogVisible.value = true
}

function resetForm() {
  Object.assign(form, ContactForm.createEmptyForm())
  formRef.value?.clearValidate()
}

function handleDialogClose() {
  editingId.value = null
  resetForm()
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  try {
    if (editingId.value) {
      const oldId = editingId.value
      const updated = await updateContact(oldId, {
        id: form.id?.trim() ?? '',
        title: form.title,
        receivedDate: form.receivedDate,
        urgency: form.urgency,
        content: form.content,
        expectReplyDate: form.expectReplyDate,
        projectNos: [...form.projectNos],
      })
      if (oldId !== updated.id) {
        clearCache()
        if (highlightedContactId.value === oldId) {
          highlightedContactId.value = updated.id
        }
        await loadPage(page.value, listFilters, true)
      } else {
        patchItem(oldId, () => updated)
      }
      ElMessage.success('联系单已更新')
    } else {
      const primaryFiles = await ContactForm.uploadFilesFromList(form.primaryPdfList)
      const supplementFiles = await ContactForm.uploadFilesFromList(form.attachmentList)
      await createContact({
        id: form.id?.trim() || undefined,
        title: form.title,
        receivedDate: form.receivedDate,
        urgency: form.urgency,
        content: form.content,
        expectReplyDate: form.expectReplyDate,
        projectNos: [...form.projectNos],
        primaryPdf: primaryFiles[0],
        supplementFiles,
      })
      clearCache()
      await loadPage(1, { keyword: searchForm.keyword, status: searchForm.status }, true)
      await syncKnownProjectNosFromContacts()
      ElMessage.success('联系单已提交')
    }
    dialogVisible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存联系单失败')
  }
}

async function handleChildSubmit() {
  const valid = await childFormRef.value?.validate().catch(() => false)
  if (!valid || !childParentId.value) return

  try {
    const primaryFiles = await ContactForm.uploadFilesFromList(childForm.primaryPdfList)
    const created = await createChildContact(childParentId.value, {
      title: childForm.title,
      receivedDate: childForm.receivedDate,
      urgency: childForm.urgency,
      content: childForm.content,
      relationType: childForm.relationType,
      projectMode: childForm.projectMode,
      projectNos:
        childForm.relationType === 'cancel'
          ? childForm.cancelledProjectNos
          : childForm.projectMode === 'inherit'
            ? []
            : [...childForm.projectNos],
      cancelScope: childForm.relationType === 'cancel' ? childForm.cancelScope : undefined,
      cancelledProjectNos:
        childForm.relationType === 'cancel' ? [...childForm.cancelledProjectNos] : undefined,
      primaryPdf: primaryFiles[0],
    })
    childDialogVisible.value = false
    clearCache()
    await loadPage(page.value, { keyword: searchForm.keyword, status: searchForm.status }, true)
    await syncKnownProjectNosFromContacts()
    highlightedContactId.value = created.id
    ElMessage.success(`已创建${getRelationMeta(created).label} ${created.id}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建追加联系单失败')
  }
}

async function handleCancel(row: ContactRecord) {
  try {
    await ElMessageBox.confirm(
      `确定取消联系单「${row.title}」吗？取消后仍保留附件记录。`,
      '取消确认',
      {
        type: 'warning',
        confirmButtonText: '取消联系单',
        cancelButtonText: '返回',
      },
    )
  } catch {
    return
  }

  try {
    const updated = await updateContact(row.id, { status: 'cancelled' })
    patchItem(row.id, () => updated)
    ElMessage.success('联系单已取消')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '取消联系单失败')
  }
}

async function handleDelete(row: ContactRecord) {
  try {
    await ElMessageBox.confirm(`确定删除联系单「${row.title}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    await deleteContact(row.id)
    clearCache()
    await loadPage(page.value, { keyword: searchForm.keyword, status: searchForm.status }, true)
    await syncKnownProjectNosFromContacts()
    ElMessage.success('联系单已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除联系单失败')
  }
}

function openAppendChildDialog(row: ContactRecord) {
  openChildDialog(row)
}
</script>

<template>
  <div
    ref="contactPageRef"
    class="contact-page"
    @dragenter="handlePageDragEnter"
    @dragleave="handlePageDragLeave"
    @dragover="handlePageDragOver"
    @drop="handlePageDrop"
  >
  <el-card shadow="never" class="biz-page-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">联系单</span>
          <span class="drag-tip">
            <el-icon class="drag-tip__icon"><Upload /></el-icon>
            拖拽 PDF 到页面或附件列，可选择新建、追加附件或追加联系单
          </span>
        </div>
        <el-button type="primary" @click="openCreateDialog">新建联系单</el-button>
      </div>
    </template>

    <div class="search-toolbar">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="单号 / 主题 / 项目号"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" style="width: 120px">
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
      <span class="search-total">共 {{ total }} 条</span>
    </div>

    <div class="table-scroll">
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="filteredData"
      stripe
      class="biz-data-table"
      :row-class-name="getRowClassName"
      height="calc(100vh - 300px)"
    >
      <el-table-column label="联系单号" width="168" class-name="tag-column contact-id-column">
        <template #default="{ row }">
          <div class="contact-id-cell" :class="{ 'is-child': (row.sortOrder ?? 0) > 0 }">
            <el-tag :type="getRelationMeta(toContactRecord(row)).type" size="small" class="cell-tag">
              {{ row.id }}
            </el-tag>
            <el-tag
              v-if="getRelationMeta(toContactRecord(row)).label !== '主单'"
              size="small"
              class="cell-tag relation-tag"
              :type="getRelationMeta(toContactRecord(row)).type"
            >
              {{ getRelationMeta(toContactRecord(row)).label }}
            </el-tag>
            <span
              v-if="(row.childCount ?? 0) > 0 && (row.sortOrder ?? 0) === 0"
              class="child-count"
            >
              +{{ row.childCount }}
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="联系主题" min-width="160" show-overflow-tooltip />
      <el-table-column label="项目号" min-width="160" class-name="tag-column project-no-column">
        <template #default="{ row }">
          <el-tooltip v-if="row.projectNos?.length" placement="top" :show-after="200">
            <template #content>
              <div class="project-no-tooltip">
                <div
                  v-for="no in row.projectNos"
                  :key="no"
                  :class="{ 'is-missing': isMissingProjectNo(no) }"
                >
                  {{ no }}
                </div>
              </div>
            </template>
            <div class="project-no-tag-list">
              <el-tag
                v-for="link in getProjectLinks(toContactRecord(row))"
                :key="link.projectNo"
                :type="isMissingProjectNo(link.projectNo) ? 'warning' : getProjectTagType(link)"
                :effect="link.sourceType === 'inherited' ? 'plain' : 'dark'"
                size="small"
                class="cell-tag cell-tag--clickable"
                @click="handleProjectNoClick(link.projectNo, toContactRecord(row))"
              >
                {{ link.projectNo }}
              </el-tag>
            </div>
          </el-tooltip>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="receivedDate"
        label="收单日期"
        width="110"
        align="center"
        header-align="center"
        class-name="date-column"
      />
      <el-table-column prop="urgency" label="紧急程度" width="100" class-name="tag-column">
        <template #default="{ row }">
          <el-tag
            :type="row.urgency === '紧急' ? 'danger' : 'info'"
            size="small"
            class="cell-tag"
          >
            {{ row.urgency }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100" class-name="tag-column">
        <template #default="{ row }">
          <el-tag :type="getStatusMeta(row.status).type" size="small" class="cell-tag">
            {{ getStatusMeta(row.status).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="正文" width="72" align="center" class-name="attachment-column">
        <template #default="{ row }">
          <span
            v-if="row.primaryPdf?.url"
            class="pdf-icon-wrap is-clickable"
            @click="openAttachment(row.primaryPdf)"
          >
            <el-icon class="pdf-icon"><Document /></el-icon>
          </span>
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="附件" min-width="88" class-name="attachment-column">
        <template #default="{ row }">
          <div
            class="attachment-drop-zone"
            @dragenter="handleAttachmentDragOver($event, toContactRecord(row))"
            @dragover="handleAttachmentDragOver($event, toContactRecord(row))"
            @dragleave="handleAttachmentDragLeave($event, toContactRecord(row))"
            @drop="handleAttachmentDrop($event, toContactRecord(row))"
          >
            <div
              v-if="row.attachments?.length"
              class="attachment-cell"
              @mouseleave="hideAttachmentHint"
            >
              <div class="attachment-icons">
                <span
                  v-for="file in row.attachments"
                  :key="file.id"
                  class="pdf-icon-wrap"
                  :class="{ 'is-clickable': !!file.url }"
                  @mouseenter="showAttachmentHint($event, file.name)"
                  @click="openAttachment(file)"
                >
                  <el-icon class="pdf-icon"><Document /></el-icon>
                </span>
              </div>
            </div>
            <span v-else class="text-muted">-</span>
            <div
              v-if="attachmentDropTargetId === row.id"
              class="attachment-drop-overlay"
            >
              <el-icon :size="20"><Upload /></el-icon>
              <span>松手追加到此行</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        label="创建时间"
        width="110"
        align="center"
        header-align="center"
        class-name="date-column"
      >
        <template #default="{ row }">
          {{ ContactForm.toDateOnly(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="canEditRow(row)"
            type="primary"
            link
            @click="openEditDialog(toContactRecord(row))"
          >
            编辑
          </el-button>
          <el-button
            v-if="row.relationType !== 'cancel'"
            type="success"
            link
            @click="openAppendChildDialog(toContactRecord(row))"
          >
            追加
          </el-button>
          <el-button
            v-if="canCancelRow(row)"
            type="warning"
            link
            @click="handleCancel(toContactRecord(row))"
          >
            取消
          </el-button>
          <el-button type="danger" link @click="handleDelete(toContactRecord(row))">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <div class="table-pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next, jumper"
        background
        @current-change="handlePageChange"
      />
    </div>

  </el-card>

  <div v-if="showPageDropOverlay" class="drop-overlay">
    <el-icon :size="40"><Upload /></el-icon>
    <p>松开鼠标，导入 PDF</p>
  </div>

  <el-dialog
    v-model="dropDialogVisible"
    title="导入 PDF"
    width="520px"
    destroy-on-close
    @closed="handleDropDialogClosed"
  >
    <div class="drop-file-list">
      <span class="drop-file-list__label">已拖入 {{ droppedPdfFiles.length }} 个文件</span>
      <div class="drop-file-list__items">
        <el-tag v-for="file in droppedPdfFiles" :key="file.name + file.lastModified" size="small">
          {{ file.name }}
        </el-tag>
      </div>
    </div>

    <el-radio-group v-model="dropAction" class="drop-action-group">
      <el-radio value="create">新建联系单</el-radio>
      <el-radio value="append_attachment">追加附件（同一张单）</el-radio>
      <el-radio value="append_contact">追加联系单（新建从单）</el-radio>
    </el-radio-group>

    <div v-if="dropAction !== 'create'" class="append-target-field">
      <el-select
        v-model="appendTargetId"
        filterable
        clearable
        :filter-method="filterAppendTargets"
        placeholder="输入单号、项目号或联系主题搜索"
        style="width: 100%"
        no-data-text="未找到匹配的联系单"
      >
        <el-option
          v-for="item in appendTargetOptions"
          :key="item.id"
          :label="`${item.id} · ${item.title}`"
          :value="item.id"
        >
          <div class="append-option">
            <span class="append-option__main">{{ item.id }} · {{ item.title }}</span>
            <span v-if="item.projectNos?.length" class="append-option__sub">
              项目号：{{ item.projectNos.join('、') }}
            </span>
          </div>
        </el-option>
      </el-select>
      <p v-if="selectedAppendTarget" class="append-target-preview">
        <template v-if="dropAction === 'append_attachment'">
          附件将追加到：{{ selectedAppendTarget.id }} · {{ selectedAppendTarget.title }}
        </template>
        <template v-else>
          将基于：{{ selectedAppendTarget.id }} · {{ selectedAppendTarget.title }} 创建追加联系单
        </template>
      </p>
    </div>

    <template #footer>
      <el-button @click="dropDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleDropDialogConfirm">确定</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="560px"
    destroy-on-close
    @closed="handleDialogClose"
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
      <el-form-item label="联系单号" prop="id">
        <el-input v-model="form.id" placeholder="请输入联系单号" />
      </el-form-item>
      <el-form-item label="联系主题" prop="title">
        <el-input v-model="form.title" placeholder="请输入联系主题" />
      </el-form-item>
      <el-form-item label="项目号">
        <el-select
          v-model="form.projectNos"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="请输入项目号，可添加多个"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="收单日期" prop="receivedDate">
        <el-date-picker
          v-model="form.receivedDate"
          type="date"
          placeholder="选择收单日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="紧急程度">
        <el-radio-group v-model="form.urgency">
          <el-radio value="普通">普通</el-radio>
          <el-radio value="紧急">紧急</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="期望回复">
        <el-date-picker
          v-model="form.expectReplyDate"
          type="date"
          placeholder="选择日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="联系内容" prop="content">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="4"
          placeholder="请输入联系内容"
        />
      </el-form-item>
      <el-form-item label="正文 PDF">
        <el-upload
          v-model:file-list="form.primaryPdfList"
          class="attachment-upload"
          accept=".pdf,application/pdf"
          :limit="1"
          :auto-upload="false"
          :on-change="handlePrimaryPdfChange"
          :on-remove="handlePrimaryPdfRemove"
        >
          <el-button type="primary" plain>选择正文 PDF</el-button>
        </el-upload>
      </el-form-item>
      <el-form-item label="追加附件">
        <el-upload
          v-model:file-list="form.attachmentList"
          class="attachment-upload"
          accept=".pdf,application/pdf"
          multiple
          :auto-upload="false"
          :on-change="handleAttachmentChange"
          :on-remove="handleAttachmentRemove"
        >
          <el-button type="primary" plain>选择追加附件</el-button>
          <template #tip>
            <div class="upload-tip">追加附件为补充材料；追加联系单请使用列表操作或拖放导入</div>
          </template>
        </el-upload>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit">
        {{ editingId ? '保存' : '提交' }}
      </el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="childDialogVisible"
    title="追加联系单"
    width="600px"
    destroy-on-close
    @closed="resetChildForm"
  >
    <p v-if="childParentRecord" class="append-target-preview">
      主单：{{ childParentRecord.id }} · {{ childParentRecord.title }}
    </p>
    <el-form ref="childFormRef" :model="childForm" :rules="formRules" label-width="100px">
      <el-form-item label="单据类型">
        <el-select v-model="childForm.relationType" style="width: 100%">
          <el-option
            v-for="item in relationTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="联系主题" prop="title">
        <el-input v-model="childForm.title" placeholder="请输入联系主题" />
      </el-form-item>
      <el-form-item label="收单日期" prop="receivedDate">
        <el-date-picker
          v-model="childForm.receivedDate"
          type="date"
          placeholder="选择收单日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item v-if="childForm.relationType !== 'cancel'" label="项目关系">
        <el-radio-group v-model="childForm.projectMode">
          <el-radio value="inherit">继承主单项目</el-radio>
          <el-radio value="split">拆分部分项目</el-radio>
          <el-radio value="append">继承并追加项目</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item
        v-if="childForm.relationType !== 'cancel' && childForm.projectMode !== 'inherit'"
        label="项目号"
      >
        <el-select
          v-model="childForm.projectNos"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="选择或输入项目号"
          style="width: 100%"
        />
      </el-form-item>
      <template v-if="childForm.relationType === 'cancel'">
        <el-form-item label="取消范围">
          <el-radio-group v-model="childForm.cancelScope">
            <el-radio value="partial">部分项目</el-radio>
            <el-radio value="full">整单取消</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="childForm.cancelScope === 'partial'" label="取消项目">
          <el-select
            v-model="childForm.cancelledProjectNos"
            multiple
            filterable
            placeholder="选择要取消的项目号"
            style="width: 100%"
          >
            <el-option
              v-for="no in childParentRecord?.projectNos || []"
              :key="no"
              :label="no"
              :value="no"
            />
          </el-select>
        </el-form-item>
      </template>
      <el-form-item label="联系内容" prop="content">
        <el-input v-model="childForm.content" type="textarea" :rows="3" placeholder="请输入联系内容" />
      </el-form-item>
      <el-form-item label="正文 PDF">
        <el-upload
          v-model:file-list="childForm.primaryPdfList"
          class="attachment-upload"
          accept=".pdf,application/pdf"
          :limit="1"
          :auto-upload="false"
          :on-change="handleChildPrimaryPdfChange"
          :on-remove="handleChildPrimaryPdfRemove"
        >
          <el-button type="primary" plain>选择正文 PDF</el-button>
        </el-upload>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="childDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleChildSubmit">创建</el-button>
    </template>
  </el-dialog>

  <Teleport to="body">
    <transition name="el-fade-in-linear">
      <div
        v-if="attachmentTooltip.visible"
        class="attachment-tooltip-float"
        :style="{
          top: `${attachmentTooltip.top}px`,
          left: `${attachmentTooltip.left}px`,
        }"
      >
        {{ attachmentTooltip.text }}
      </div>
    </transition>
  </Teleport>
  </div>
</template>

<style scoped>
.contact-page {
  position: relative;
  min-height: 100%;
}

.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: color-mix(in srgb, var(--el-bg-color) 88%, transparent);
  border: 2px dashed var(--el-color-primary);
  border-radius: 4px;
  color: var(--el-color-primary);
  pointer-events: none;
}

.drop-overlay p {
  margin: 0;
  font-size: 14px;
}

.drop-file-list {
  margin-bottom: 16px;
}

.drop-file-list__label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.drop-file-list__items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.drop-action-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.append-target-field {
  margin-top: 16px;
}

.append-target-preview {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.relation-tag {
  transform: scale(0.92);
}

.child-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:deep(.is-child-row > td) {
  background: color-mix(in srgb, var(--el-fill-color-light) 70%, transparent) !important;
}

:deep(.is-cancel-row > td) {
  background: color-mix(in srgb, var(--el-color-danger-light-9) 55%, transparent) !important;
}

.append-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
  padding: 2px 0;
}

.append-option__main {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.append-option__sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.drag-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--el-text-color-secondary);
}

.drag-tip__icon {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}

.project-no-tooltip .is-missing {
  color: var(--el-color-warning-light-3);
}

.attachment-drop-zone {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  min-height: 32px;
  border-radius: 4px;
}

.attachment-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: color-mix(in srgb, var(--el-bg-color) 88%, transparent);
  border: 2px dashed var(--el-color-primary);
  border-radius: 4px;
  color: var(--el-color-primary);
  pointer-events: none;
}

.attachment-drop-overlay span {
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  padding: 0 4px;
}

.attachment-cell {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.attachment-icons {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  max-width: 100%;
  overflow: hidden;
}

.pdf-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: #fff1f0;
}

.pdf-icon-wrap.is-clickable {
  cursor: pointer;
}

.pdf-icon-wrap.is-clickable:hover {
  background: #ffccc7;
}

.pdf-icon {
  font-size: 16px;
  color: #cf1322;
}

.attachment-upload {
  width: 100%;
}

.upload-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
</style>

<style>
.attachment-tooltip-float {
  position: fixed;
  z-index: 3000;
  transform: translate(calc(-100% - 8px), -50%);
  padding: 6px 12px;
  background: var(--el-text-color-primary);
  color: var(--el-bg-color);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  border-radius: var(--el-border-radius-base);
  white-space: nowrap;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid var(--el-border-color-darker);
  box-shadow: var(--el-box-shadow-dark);
  pointer-events: none;
}

.attachment-tooltip-float::after {
  content: '';
  position: absolute;
  right: -5px;
  top: 50%;
  transform: translateY(-50%);
  border: 5px solid transparent;
  border-left-color: var(--el-text-color-primary);
}
</style>
