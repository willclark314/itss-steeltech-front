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
import { createProject } from '@/api/projects'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'
import { useProjectNoLookup } from '@/composables/useProjectNoLookup'
import { ContactForm } from '@/models/biz/contact'
import type { ContactAttachment, ContactRecord } from '@/models/biz/contact'
import { ProjectForm } from '@/models/biz/project'
import { BIZ_ROUTES, buildProjectRouteQuery } from '@/models/biz/navigation'
import ContactFormTable from '@/components/biz/ContactFormTable.vue'
import TagSelect from '@/components/biz/TagSelect.vue'

const route = useRoute()
const router = useRouter()

const tableRef = ref<InstanceType<typeof ContactFormTable>>()
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
  tags: [] as string[],
})

const statusOptions = ContactForm.STATUS_OPTIONS
const relationTypeMap = ContactForm.RELATION_TYPE_MAP
const relationTypeOptions = ContactForm.RELATION_TYPE_OPTIONS
const contactFormTypeOptions = ContactForm.FORM_TYPE_OPTIONS

const projectNoLookup = useProjectNoLookup()
const knownProjectNos = projectNoLookup.existing
const knownExactProjectNos = projectNoLookup.exact
const appendSearchResults = ref<ContactRecord[]>([])

// ── 分页列表（按筛选条件分桶缓存，切换筛选时保留已查数据）──
const pageSize = 20
const {
  filteredData,
  total,
  page,
  loading,
  loadPage: loadCachedPage,
  loadAroundAnchor: loadCachedAroundAnchor,
  clearFilterCache,
  patchItem,
  getFilters,
} = usePaginatedListCache<ContactRecord>({
  pageSize,
  getItemKey: (item) => item.id,
  sortList: ContactForm.sortForDisplay,
})

type PaginatedFilters = { keyword?: string; status?: string; tags?: string[] }

function buildListQuery(params: PaginatedFilters & { page?: number; pageSize?: number; anchor?: string }) {
  return {
    keyword: params.keyword,
    status: params.status,
    tags: params.tags,
    page: params.page,
    pageSize: params.pageSize,
    anchor: params.anchor,
  }
}

async function loadPage(pageNo = 1, nextFilters?: PaginatedFilters, force = false) {
  return loadCachedPage(
    (params) => fetchContactList(buildListQuery(params)),
    pageNo,
    nextFilters,
    force,
  )
}

async function loadAroundAnchor(anchor: string, nextFilters?: PaginatedFilters, force = false) {
  return loadCachedAroundAnchor(
    (params) => fetchContactList(buildListQuery(params)),
    anchor,
    nextFilters,
    force,
  )
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

function getRelationMeta(row: ContactRecord) {
  const type = row.relationType || 'primary'
  return relationTypeMap[type]
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
      const updated = await appendContactAttachments(target.id, payloads)
      dropDialogVisible.value = false
      handleDropDialogClosed()
      patchItem(target.id, () => updated)
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

function handleAttachmentDrop(row: ContactRecord, pdfFiles: File[]) {
  resetDragState()

  if (!pdfFiles.length) {
    ElMessage.warning('请拖入 PDF 文件')
    return
  }

  const fileLabel =
    pdfFiles.length === 1 ? `「${pdfFiles[0]!.name}」` : `${pdfFiles.length} 个 PDF 文件`

  void confirmAttachmentDrop(row, pdfFiles, fileLabel)
}

async function confirmAttachmentDrop(row: ContactRecord, pdfFiles: File[], fileLabel: string) {
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

function goToProject(projectNo: string, projectNos: string[] = []) {
  router.push({
    path: BIZ_ROUTES.project,
    query: buildProjectRouteQuery(projectNo, projectNos),
  })
}

function isMissingProjectNo(projectNo: string) {
  return !knownProjectNos.value.has(projectNo)
}

function hasExactProjectNo(projectNo: string) {
  return knownExactProjectNos.value.has(projectNo)
}

async function syncKnownProjectNosFromContacts() {
  const projectNos = [...new Set(filteredData.value.flatMap((item) => item.projectNos))]
  await projectNoLookup.sync(projectNos)
}

async function createLinkedProject(projectNo: string, row: ContactRecord) {
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
  projectNoLookup.markCreated(projectNo, created.projectNo)
  ElMessage.success(`项目 ${projectNo} 已创建并关联联系单`)
  goToProject(created.projectNo, [...new Set([...row.projectNos, created.projectNo])])
}

async function handleProjectNoClick(projectNo: string, row: ContactRecord) {
  const hasDirectLink = row.projectLinks?.some(
    (link) => link.projectNo === projectNo && link.sourceType === 'own',
  )

  if (hasDirectLink && !hasExactProjectNo(projectNo)) {
    try {
      await createLinkedProject(projectNo, row)
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '创建项目失败')
    }
    return
  }

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
    await createLinkedProject(projectNo, row)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '新建项目失败')
  }
}

async function loadContacts(force = false) {
  try {
    await loadPage(
      1,
      {
        keyword: searchForm.keyword,
        status: searchForm.status,
        tags: searchForm.tags.length ? [...searchForm.tags] : undefined,
      },
      force,
    )
    await syncKnownProjectNosFromContacts()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
  }
}

async function handlePageChange(nextPage: number) {
  try {
    await loadPage(nextPage, getFilters())
    highlightedContactId.value = ''
    nextTick(() => tableRef.value?.tableRef?.setScrollTop(0))
    await syncKnownProjectNosFromContacts()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
  }
}

async function handleSearch() {
  if (route.query.contactId) {
    router.replace({ path: BIZ_ROUTES.contact })
  }
  await loadContacts(true)
}

async function handleReset() {
  searchForm.keyword = ''
  searchForm.status = ''
  searchForm.tags = []
  highlightedContactId.value = ''
  if (route.query.contactId) {
    router.replace({ path: BIZ_ROUTES.contact })
  }
  await loadContacts(false)
}

function scrollToContact(contactId: string) {
  const index = filteredData.value.findIndex((item) => item.id === contactId)
  if (index === -1) return

  const rows = tableRef.value?.tableRef?.$el?.querySelectorAll('.el-table__body .el-table__row')
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
    await loadContacts(false)
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

function handleContactTypeChange(nextType: 'contact' | 'processing') {
  if (nextType === 'processing') {
    const currentId = (form.id || '').trim()
    if (!currentId || /^DTP\d+$/i.test(currentId)) {
      form.id = ContactForm.JIAGONGDAN_DEFAULT_ID
    }
    return
  }

  if ((form.id || '').trim() === ContactForm.JIAGONGDAN_DEFAULT_ID) {
    form.id = ''
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  try {
    if (editingId.value) {
      const oldId = editingId.value
      const updatePayload: Parameters<typeof updateContact>[1] = {
        id: form.id?.trim() ?? '',
        title: form.title,
        receivedDate: form.receivedDate,
        urgency: form.urgency,
        content: form.content,
        projectNos: [...form.projectNos],
        tagIds: [...form.tagIds],
      }
      if (ContactForm.hasNewPrimaryUpload(form.primaryPdfList)) {
        const primaryFiles = await ContactForm.uploadFilesFromList(form.primaryPdfList)
        updatePayload.primaryPdf = primaryFiles[0]
      }
      const updated = await updateContact(oldId, updatePayload)
      if (oldId !== updated.id) {
        if (highlightedContactId.value === oldId) {
          highlightedContactId.value = updated.id
        }
        const activeFilters = getFilters()
        clearFilterCache(activeFilters)
        await loadPage(page.value, activeFilters, true)
      } else {
        patchItem(oldId, () => updated)
      }
      await syncKnownProjectNosFromContacts()
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
        projectNos: [...form.projectNos],
        tagIds: [...form.tagIds],
        primaryPdf: primaryFiles[0],
        supplementFiles,
      })
      const activeFilters = getFilters()
      clearFilterCache(activeFilters)
      await loadPage(1, activeFilters, true)
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
    const activeFilters = getFilters()
    clearFilterCache(activeFilters)
    await loadAroundAnchor(created.id, activeFilters, true)
    await syncKnownProjectNosFromContacts()
    highlightedContactId.value = created.id
    nextTick(() => scrollToContact(created.id))
    ElMessage.success(`已创建${getRelationMeta(created).label} ${created.id}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建追加联系单失败')
  }
}

async function handleStatusUpdated(contact: ContactRecord) {
  patchItem(contact.id, () => contact)
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
    const activeFilters = getFilters()
    clearFilterCache(activeFilters)
    const nextPage = filteredData.value.length <= 1 && page.value > 1 ? page.value - 1 : page.value
    await loadPage(nextPage, activeFilters, true)
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
          <span class="card-title">联系单管理</span>
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
        <el-form-item label="标签">
          <TagSelect v-model="searchForm.tags" :allow-create="false" width="200px" placeholder="全部" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
      <span class="search-total">共 {{ total }} 条</span>
    </div>

    <div class="table-scroll">
      <ContactFormTable
        ref="tableRef"
        v-model:attachment-drop-target-id="attachmentDropTargetId"
        :data="filteredData"
        :loading="loading"
        :highlighted-contact-id="highlightedContactId"
        :known-project-nos="knownProjectNos"
        @edit="openEditDialog"
        @append="openAppendChildDialog"
        @cancel="handleCancel"
        @delete="handleDelete"
        @project-no-click="handleProjectNoClick"
        @attachment-drop="handleAttachmentDrop"
        @status-updated="handleStatusUpdated"
      />
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
      <el-form-item label="联系单类型">
        <el-radio-group v-model="form.contactType" @change="handleContactTypeChange">
          <el-radio
            v-for="item in contactFormTypeOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
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
      <el-form-item label="标签">
        <TagSelect v-model="form.tagIds" />
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
      <el-form-item label="联系内容" prop="content">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="4"
          placeholder="请输入联系内容（可留空或填写“无”）"
        />
      </el-form-item>
      <el-form-item label="正文 PDF">
        <div class="primary-pdf-editor">
          <el-upload
            v-model:file-list="form.primaryPdfList"
            class="attachment-upload"
            accept=".pdf,application/pdf"
            :limit="1"
            :auto-upload="false"
            :on-change="handlePrimaryPdfChange"
            :on-remove="handlePrimaryPdfRemove"
          >
            <el-button type="primary" plain>
              {{ editingId ? '上传新版本' : '选择正文 PDF' }}
            </el-button>
            <template v-if="editingId" #tip>
              <div class="upload-tip">上传后将作为当前版本，历史版本仍可查看</div>
            </template>
          </el-upload>
          <div
            v-if="editingId && form.primaryPdfVersions?.length"
            class="pdf-version-list"
          >
            <div class="pdf-version-list__title">历史版本</div>
            <div
              v-for="version in form.primaryPdfVersions"
              :key="version.id"
              class="pdf-version-item"
            >
              <el-tag v-if="version.isCurrent" size="small" type="success">当前</el-tag>
              <span class="pdf-version-item__label">
                v{{ version.version }} · {{ version.name }}
              </span>
              <span class="pdf-version-item__date">
                {{ ContactForm.toDateOnly(version.createdAt) }}
              </span>
              <el-button
                v-if="version.url"
                type="primary"
                link
                @click="openAttachment(version)"
              >
                查看
              </el-button>
            </div>
          </div>
        </div>
      </el-form-item>
      <el-form-item v-if="!editingId" label="追加附件">
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
        <el-input
          v-model="childForm.content"
          type="textarea"
          :rows="3"
          placeholder="请输入联系内容（可留空或填写“无”）"
        />
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

.attachment-upload {
  width: 100%;
}

.upload-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.primary-pdf-editor {
  width: 100%;
}

.pdf-version-list {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-fill-color-blank);
}

.pdf-version-list__title {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.pdf-version-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}

.pdf-version-item + .pdf-version-item {
  border-top: 1px dashed var(--el-border-color-lighter);
  margin-top: 4px;
  padding-top: 8px;
}

.pdf-version-item__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdf-version-item__date {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
