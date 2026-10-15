<script setup lang="ts">
import '@/styles/biz-data-table.css'
import '@/styles/biz-page-card.css'
import { computed, h, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type UploadFile, type UploadUserFile } from 'element-plus'
import {
  appendContactAttachments,
  createChildContact,
  createContact,
  deleteContact,
  fetchContact,
  fetchContactList,
  updateContact,
} from '@/api/contacts'
import { createProject, fetchProjectList } from '@/api/projects'
import { fetchSystemConfig } from '@/api/system'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'
import { PAGE_SIZE_OPTIONS } from '@/constants/pagination'
import { useProjectNoLookup } from '@/composables/useProjectNoLookup'
import { ContactForm } from '@/models/biz/contact'
import type { ContactAttachment, ContactFormType, ContactRecord } from '@/models/biz/contact'
import { ProjectForm } from '@/models/biz/project'
import { ProjectWorkPath } from '@/models/biz/ProjectWorkPath'
import { buildProjectRouteQuery, resolveContactPath, resolveProjectLinkFromContact } from '@/models/biz/navigation'
import ContactFormTable from '@/components/biz/ContactFormTable.vue'
import TagSelect from '@/components/biz/TagSelect.vue'

const props = withDefaults(
  defineProps<{
    /** 页头标题；生产计划「联系单登记」等入口可覆盖 */
    pageTitle?: string
  }>(),
  {
    pageTitle: '联系单管理',
  },
)

const route = useRoute()
const router = useRouter()

const tableRef = ref<InstanceType<typeof ContactFormTable>>()
const highlightedContactId = ref('')
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const editingIsChild = ref(false)
const originalParentId = ref('')
const originalContactType = ref<ContactFormType>('contact')
const originalAttachmentIds = ref<string[]>([])
/** 当前弹窗内记住的正式联系单号（改回联系单时带回） */
const lastFormalContactId = ref('')
const removedAttachmentIdsInSession = ref<Set<string>>(new Set())
const isDraggingPdf = ref(false)
const attachmentDropTargetId = ref('')
const primaryPdfDropTargetId = ref('')
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
const projectCreateDialogVisible = ref(false)
const projectCreateFormRef = ref<FormInstance>()
const projectCreateContact = ref<ContactRecord | null>(null)
const projectCreateSubmitting = ref(false)
const projectCreateForm = reactive({
  projectNo: '',
  name: '',
  plannedStartDate: '',
})
const projectCreateFormRules = {
  projectNo: ProjectForm.FORM_RULES.projectNo,
  name: ProjectForm.FORM_RULES.name,
}

const dialogTitle = computed(() => (editingId.value ? '编辑联系单' : '新建联系单'))

const searchForm = reactive({
  keyword: '',
  tags: [] as string[],
})

const relationTypeMap = ContactForm.RELATION_TYPE_MAP
const relationTypeOptions = ContactForm.RELATION_TYPE_OPTIONS
const contactFormTypeOptions = ContactForm.FORM_TYPE_OPTIONS

const projectNoLookup = useProjectNoLookup()
const knownProjectNos = projectNoLookup.existing
const knownExactProjectNos = projectNoLookup.exact
const appendSearchResults = ref<ContactRecord[]>([])

// ── 分页列表（按筛选条件分桶缓存，切换筛选时保留已查数据）──
const {
  pageSize,
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
  getItemKey: (item) => item.id,
  sortList: ContactForm.sortForDisplay,
})

type PaginatedFilters = { keyword?: string; tags?: string[] }

function buildListQuery(params: PaginatedFilters & { page?: number; pageSize?: number; anchor?: string }) {
  return {
    keyword: params.keyword,
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

const formRules = computed(() => {
  if (form.contactType === 'processing') {
    return editingId.value ? ContactForm.PROCESSING_EDIT_FORM_RULES : ContactForm.PROCESSING_FORM_RULES
  }
  return editingId.value ? ContactForm.EDIT_FORM_RULES : ContactForm.FORM_RULES
})
const childFormRules = computed(() =>
  childForm.contactType === 'processing'
    ? ContactForm.PROCESSING_FORM_RULES
    : ContactForm.CHILD_FORM_RULES,
)

const appendTargetOptions = computed(() => appendSearchResults.value)

const selectedAppendTarget = computed(() =>
  appendSearchResults.value.find((item) => item.id === appendTargetId.value) ?? null,
)
const selectedEditParent = computed(() =>
  appendSearchResults.value.find((item) => item.id === form.parentId) ?? null,
)
const editParentOptions = computed(() =>
  appendSearchResults.value.filter((item) => item.id !== editingId.value),
)
const isEditingAppend = computed(() => Boolean(editingId.value) && form.linkage === 'append')
const isAnyDialogOpen = computed(
  () =>
    dialogVisible.value ||
    childDialogVisible.value ||
    dropDialogVisible.value ||
    projectCreateDialogVisible.value,
)

const showPageDropOverlay = computed(
  () =>
    isDraggingPdf.value &&
    !isAnyDialogOpen.value &&
    !attachmentDropTargetId.value &&
    !primaryPdfDropTargetId.value,
)

async function openCreateDialogWithAttachments(files: File[]) {
  editingId.value = null
  resetForm()
  try {
    form.primaryPdfList = await ContactForm.filesToAttachmentList(files.slice(0, 1))
    form.attachmentList = await ContactForm.filesToAttachmentList(files.slice(1))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '无法读取所选文件')
    return
  }

  const firstName = files[0]?.name.replace(/\.pdf$/i, '') || ''
  if (firstName) {
    form.title = firstName
  }

  dialogVisible.value = true
}

async function openChildDialog(parent: ContactRecord, files: File[] = []) {
  childParentId.value = parent.id
  childParentRecord.value = parent
  Object.assign(childForm, ContactForm.createEmptyChildForm(parent))
  childDroppedFiles.value = files
  try {
    childForm.primaryPdfList = await ContactForm.filesToAttachmentList(files.slice(0, 1))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '无法读取所选文件')
    childForm.primaryPdfList = []
  }
  const firstName = files[0]?.name.replace(/\.pdf$/i, '') || ''
  if (firstName) {
    childForm.title = firstName
    if (!childForm.id) childForm.id = firstName
  }
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
  primaryPdfDropTargetId.value = ''
}

function handlePageDragEnter(event: DragEvent) {
  event.preventDefault()
  if (isAnyDialogOpen.value) return
  if (!hasFileDrag(event)) return
  isDraggingPdf.value = true
}

function handlePageDragLeave(event: DragEvent) {
  if (isAnyDialogOpen.value) {
    resetDragState()
    return
  }
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
  if (isAnyDialogOpen.value) return
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

function formatContactOptionLabel(record: ContactRecord) {
  return ContactForm.formatOptionLabel(record)
}

async function seedEditParentOption(parentId: string) {
  const existing =
    appendSearchResults.value.find((item) => item.id === parentId) ||
    filteredData.value.find((item) => item.id === parentId)
  if (existing) {
    if (!appendSearchResults.value.some((item) => item.id === existing.id)) {
      appendSearchResults.value = [existing, ...appendSearchResults.value]
    }
    return
  }
  try {
    const parent = await fetchContact(parentId)
    appendSearchResults.value = [parent, ...appendSearchResults.value.filter((item) => item.id !== parent.id)]
  } catch {
    // 主单可能已不在列表中，仍保留 parentId 供保存时由后端校验
  }
}

function resolveAppendTargetId() {
  if (appendTargetId.value) return appendTargetId.value

  const query = appendSearchQuery.value.trim()
  if (!query) return ''

  const normalizedQuery = query.toLowerCase()
  const exactId = appendSearchResults.value.find((item) => item.id.toLowerCase() === normalizedQuery)
  if (exactId) return exactId.id

  const processingByProject = appendSearchResults.value.find(
    (item) =>
      ContactForm.isProcessingFormId(item.id) &&
      item.projectNos?.some(
        (no) => ContactForm.parseBaseProjectNo(no).toLowerCase() === normalizedQuery,
      ),
  )
  if (processingByProject) return processingByProject.id

  const matches = ContactForm.findByKeyword(appendSearchResults.value, query)
  if (matches.length === 1) return matches[0]!.id

  return ''
}

type DropDialogOptions = {
  action?: 'create' | 'append_attachment' | 'append_contact'
  target?: ContactRecord
}

function openDropDialog(files: File[], options?: DropDialogOptions) {
  droppedPdfFiles.value = files
  dropAction.value = options?.action ?? 'create'
  appendTargetId.value = options?.target?.id ?? ''
  appendSearchQuery.value = ''
  if (options?.target && !appendSearchResults.value.some((item) => item.id === options.target!.id)) {
    appendSearchResults.value = [options.target, ...appendSearchResults.value]
  }
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
    ElMessage.warning('请选择或输入单号、项目号、联系主题以定位联系单（加工单可用项目号）')
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
  if (isAnyDialogOpen.value) return

  const files = ContactForm.extractFilesFromDrop(event.dataTransfer!)
  if (!files.length) {
    ElMessage.warning('请拖入文件')
    return
  }

  openDropDialog(files)
}

async function handleAttachmentDrop(row: ContactRecord, files: File[]) {
  resetDragState()

  if (!files.length) {
    ElMessage.warning('请拖入文件')
    return
  }

  const fileLabel = files.length === 1
    ? `「${files[0]!.name}」`
    : `${files.length} 个文件`

  try {
    await ElMessageBox.confirm(
      `是否将${fileLabel}追加为联系单「${row.id} · ${row.title}」的附件？`,
      '追加附件',
      {
        type: 'info',
        confirmButtonText: '追加附件',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  try {
    const payloads = await ContactForm.filesToUploadPayload(files)
    const updated = await appendContactAttachments(row.id, payloads)
    patchItem(row.id, () => updated)
    ElMessage.success(`附件已追加到联系单 ${row.id}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '追加附件失败')
  }
}

function handlePrimaryPdfInvalidDrop() {
  resetDragState()
  ElMessage.warning('正文列仅支持 PDF 文件')
}

async function handlePrimaryPdfDrop(row: ContactRecord, file: File) {
  resetDragState()

  const hadPrimary = !!row.primaryPdf?.url
  const actionLabel = hadPrimary ? '上传新版本' : '上传正文'

  try {
    await ElMessageBox.confirm(
      `是否将「${file.name}」${actionLabel}到联系单「${row.id} · ${row.title}」？`,
      actionLabel,
      {
        type: 'info',
        confirmButtonText: actionLabel,
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  try {
    const [payload] = await ContactForm.filesToUploadPayload([file])
    const updated = await updateContact(row.id, { primaryPdf: payload })
    patchItem(row.id, () => updated)
    ElMessage.success(`正文 PDF 已${hadPrimary ? '更新' : '上传'}到联系单 ${row.id}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传正文 PDF 失败')
  }
}

async function handleAttachmentChange(_file: UploadFile, fileList: UploadUserFile[]) {
  try {
    form.attachmentList = await ContactForm.snapshotUploadFiles(fileList)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '无法读取所选文件')
    form.attachmentList = fileList.filter((item) => item.uid !== _file.uid)
  }
}

function handleAttachmentRemove(file: UploadFile, fileList: UploadUserFile[]) {
  const attachmentId = ContactForm.getAttachmentIdFromUploadFile(file)
  if (attachmentId) {
    removedAttachmentIdsInSession.value.add(attachmentId)
  }
  form.attachmentList = [...fileList]
}

async function handlePrimaryPdfChange(file: UploadFile, fileList: UploadUserFile[]) {
  if (!ContactForm.isPdfFile(file)) {
    ElMessage.warning('仅支持上传 PDF 文件')
    form.primaryPdfList = fileList.filter((item) => item.uid !== file.uid)
    return
  }
  try {
    form.primaryPdfList = await ContactForm.snapshotUploadFiles(fileList.slice(-1))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '无法读取所选文件')
    form.primaryPdfList = []
  }
}

function handlePrimaryPdfRemove(_file: UploadFile, fileList: UploadUserFile[]) {
  form.primaryPdfList = fileList
}

async function handleChildPrimaryPdfChange(file: UploadFile, fileList: UploadUserFile[]) {
  if (!ContactForm.isPdfFile(file)) {
    ElMessage.warning('仅支持上传 PDF 文件')
    childForm.primaryPdfList = fileList.filter((item) => item.uid !== file.uid)
    return
  }
  try {
    childForm.primaryPdfList = await ContactForm.snapshotUploadFiles(fileList.slice(-1))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '无法读取所选文件')
    childForm.primaryPdfList = []
  }
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
    path: resolveProjectLinkFromContact(route.path),
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

function openProjectCreateDialog(projectNo: string, row: ContactRecord) {
  const draft = ProjectForm.createFormFromContact(projectNo, {
    contactFormId: row.id,
    contactTitle: row.title,
    receivedDate: row.receivedDate,
    plannedStartDate: row.receivedDate,
  })
  projectCreateContact.value = row
  projectCreateForm.projectNo = draft.projectNo
  projectCreateForm.name = draft.name
  projectCreateForm.plannedStartDate = draft.plannedStartDate
  projectCreateDialogVisible.value = true
  nextTick(() => projectCreateFormRef.value?.clearValidate())
}

/** 检查联系单里是否有未入库的项目号，有则弹出新建项目对话框（取第一个） */
function tryOpenProjectCreateForContact(contact: ContactRecord) {
  const unknown = contact.projectNos.find((no) => !knownProjectNos.value.has(no))
  if (unknown) {
    openProjectCreateDialog(unknown, contact)
  }
}

function handleProjectCreateDialogClosed() {
  projectCreateContact.value = null
  projectCreateForm.projectNo = ''
  projectCreateForm.name = ''
  projectCreateForm.plannedStartDate = ''
  projectCreateFormRef.value?.clearValidate()
}

async function submitProjectCreate() {
  const row = projectCreateContact.value
  if (!row) return

  const valid = await projectCreateFormRef.value?.validate().catch(() => false)
  if (!valid) return

  const sourceProjectNo = projectCreateForm.projectNo.trim()
  projectCreateSubmitting.value = true
  try {
    const created = await createProject({
      projectNo: sourceProjectNo,
      name: projectCreateForm.name.trim(),
      status: ProjectForm.STATUS.ACTIVE,
      plannedStartDate: projectCreateForm.plannedStartDate || undefined,
      contactFormId: row.id,
    })
    projectNoLookup.markCreated(sourceProjectNo, created.projectNo)
    projectCreateDialogVisible.value = false
    ElMessage.success(`项目 ${sourceProjectNo} 已创建并关联联系单`)
    goToProject(created.projectNo, [...new Set([...row.projectNos, created.projectNo])])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '新建项目失败')
  } finally {
    projectCreateSubmitting.value = false
  }
}

async function handleProjectNoClick(projectNo: string, row: ContactRecord) {
  const hasDirectLink = row.projectLinks?.some(
    (link) => link.projectNo === projectNo && link.sourceType === 'own',
  )

  if (hasDirectLink && !hasExactProjectNo(projectNo)) {
    openProjectCreateDialog(projectNo, row)
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

  openProjectCreateDialog(projectNo, row)
}

async function loadContacts(force = false) {
  try {
    await loadPage(
      1,
      {
        keyword: searchForm.keyword,
        tags: searchForm.tags.length ? [...searchForm.tags] : undefined,
      },
      force,
    )
    void syncKnownProjectNosFromContacts()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
  }
}

async function handlePageChange(nextPage: number) {
  try {
    await loadPage(nextPage, getFilters())
    highlightedContactId.value = ''
    nextTick(() => tableRef.value?.tableRef?.setScrollTop(0))
    void syncKnownProjectNosFromContacts()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
  }
}

async function handleSizeChange() {
  try {
    await loadPage(1, getFilters())
    highlightedContactId.value = ''
    nextTick(() => tableRef.value?.tableRef?.setScrollTop(0))
    void syncKnownProjectNosFromContacts()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
  }
}

async function handleSearch() {
  if (route.query.contactId) {
    router.replace({ path: resolveContactPath(route.path) })
  }
  await loadContacts(true)
}

async function handleReset() {
  searchForm.keyword = ''
  searchForm.tags = []
  highlightedContactId.value = ''
  if (route.query.contactId) {
    router.replace({ path: resolveContactPath(route.path) })
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
      highlightedContactId.value = contactId
    try {
      await loadAroundAnchor(contactId, {})
      void syncKnownProjectNosFromContacts()
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

watch(isAnyDialogOpen, (open) => {
  if (open) resetDragState()
})

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
  editingIsChild.value = false
  originalParentId.value = ''
  originalContactType.value = 'contact'
  originalAttachmentIds.value = []
  lastFormalContactId.value = ''
  removedAttachmentIdsInSession.value = new Set()
  resetForm()
  dialogVisible.value = true
}

async function openEditDialog(row: ContactRecord) {
  editingId.value = row.id
  editingIsChild.value =
    Boolean(row.parentId) || (row.relationType != null && row.relationType !== 'primary')
  originalParentId.value = row.parentId || ''
  originalAttachmentIds.value = (row.attachments || []).map((item) => item.id)
  removedAttachmentIdsInSession.value = new Set()
  Object.assign(form, ContactForm.createFormFromRecord(row))
  originalContactType.value = form.contactType
  const projectKey = ContactForm.resolveRememberProjectKey(row.projectNos, row.id)
  if (ContactForm.isProcessingFormId(row.id)) {
    lastFormalContactId.value = ContactForm.loadRememberedContactId(projectKey)
  } else {
    lastFormalContactId.value = row.id
    if (projectKey) ContactForm.saveRememberedContactId(projectKey, row.id)
  }
  appendSearchQuery.value = ''
  if (form.parentId) {
    await seedEditParentOption(form.parentId)
  }
  dialogVisible.value = true
}

function resetForm() {
  Object.assign(form, ContactForm.createEmptyForm())
  formRef.value?.clearValidate()
}

function handleDialogClose() {
  editingId.value = null
  editingIsChild.value = false
  originalParentId.value = ''
  originalContactType.value = 'contact'
  originalAttachmentIds.value = []
  lastFormalContactId.value = ''
  removedAttachmentIdsInSession.value = new Set()
  resetForm()
}

function handleLinkageChange(nextType: string | number | boolean | undefined) {
  if (nextType === 'independent') {
    form.parentId = ''
    form.relationType = 'primary'
    return
  }
  if (nextType === 'append') {
    if (!form.relationType || form.relationType === 'primary') {
      form.relationType = 'supplement'
    }
  }
}

function rememberFormalContactId(candidate: string) {
  const formalId = (candidate || '').trim()
  if (!formalId || ContactForm.isProcessingFormId(formalId)) return
  lastFormalContactId.value = formalId
  const projectKey = ContactForm.resolveRememberProjectKey(form.projectNos, editingId.value || undefined)
  if (projectKey) ContactForm.saveRememberedContactId(projectKey, formalId)
}

function resolveRememberedFormalContactId() {
  const fromSession = (lastFormalContactId.value || '').trim()
  if (fromSession && !ContactForm.isProcessingFormId(fromSession)) return fromSession
  const projectKey = ContactForm.resolveRememberProjectKey(form.projectNos, editingId.value || undefined)
  return ContactForm.loadRememberedContactId(projectKey)
}

function handleContactTypeChange(nextType: string | number | boolean | undefined) {
  if (nextType !== 'contact' && nextType !== 'processing') return

  if (nextType === 'processing') {
    const currentId = (form.id || '').trim()
    if (currentId && !ContactForm.isProcessingFormId(currentId)) {
      rememberFormalContactId(currentId)
    } else if (editingId.value && !ContactForm.isProcessingFormId(editingId.value)) {
      rememberFormalContactId(editingId.value)
    }
    if (!currentId || /^DTP\d+$/i.test(currentId) || ContactForm.isProcessingFormId(currentId)) {
      form.id = ContactForm.JIAGONGDAN_DEFAULT_ID
    }
    ElMessage.info(
      '改为「加工单」后，关联项目归档将按「加工单归档」规则；保存后请到项目列表查看路径提示，必要时重新创建路径。',
    )
    return
  }

  const restored = resolveRememberedFormalContactId()
  const currentId = (form.id || '').trim()
  if (!currentId || ContactForm.isProcessingFormId(currentId)) {
    form.id = restored
  }
  ElMessage.info(
    restored
      ? `已带出上次联系单号「${restored}」；关联项目归档将按「深化组归档」规则，保存后请到项目列表核对路径。`
      : '改为「联系单」后请填写正式联系单号；关联项目归档将按「深化组归档」规则，保存后请到项目列表核对路径。',
  )
}

function handleChildContactTypeChange(nextType: string | number | boolean | undefined) {
  if (nextType !== 'contact' && nextType !== 'processing') return

  if (nextType === 'processing') {
    const currentId = (childForm.id || '').trim()
    if (!currentId || /^DTP\d+$/i.test(currentId) || ContactForm.isProcessingFormId(currentId)) {
      childForm.id = ContactForm.JIAGONGDAN_DEFAULT_ID
    }
    ElMessage.info(
      '追加单改为「加工单」后，可能影响关联项目的归档路径类别，保存后请到项目列表核对。',
    )
    return
  }

  if (ContactForm.isProcessingFormId((childForm.id || '').trim())) {
    childForm.id = ''
  }
}

async function notifyArchivePathImpact(projectNos: string[], nextType: ContactFormType) {
  const uniqueNos = [...new Set(projectNos.map((no) => no.trim()).filter(Boolean))]
  if (!uniqueNos.length) return

  try {
    const config = await fetchSystemConfig()
    const patterns = config.localWorkPath.pathPatterns
    const kindLabel = nextType === 'processing' ? '加工单归档' : '深化组归档'
    const blocks: ReturnType<typeof h>[] = [
      h(
        'p',
        { class: 'path-suggest-dialog__reason' },
        `联系单类型已变为「${nextType === 'processing' ? '加工单' : '联系单'}」。关联项目的归档类别按「${kindLabel}」计算；若已设置路径与建议不一致，请到项目列表悬停查看，并右键「创建路径」。`,
      ),
    ]

    let mismatchCount = 0
    for (const projectNo of uniqueNos.slice(0, 8)) {
      const result = await fetchProjectList({ keyword: projectNo, page: 1, pageSize: 20 })
      const project =
        result.list.find((item) => item.projectNo === projectNo) ||
        result.list.find(
          (item) =>
            ProjectForm.parseBaseProjectNo(item.projectNo) ===
            ProjectForm.parseBaseProjectNo(projectNo),
        )
      if (!project) continue

      const natures = project.natures || []
      const touchesDetail =
        natures.includes(ProjectForm.NATURE.DETAIL) ||
        ProjectForm.DETAIL_GROUP_NATURES.some((n) => natures.includes(n)) ||
        Boolean(ProjectForm.hasLocalWorkPath(project.detailWorkPath)) ||
        natures.length === 0
      if (!touchesDetail) continue

      const saved = ProjectForm.normalizeLocalWorkPath(
        ProjectWorkPath.getNaturePath(project, 'detail'),
      )
      const suggested = ProjectWorkPath.buildRelativePath(project, patterns, 'detail') ?? ''
      const mismatch =
        ProjectWorkPath.isDetailArchiveKindMismatch(project, saved) ||
        (Boolean(saved) && Boolean(suggested) && saved !== suggested) ||
        (!saved && Boolean(suggested))

      if (!mismatch) continue
      mismatchCount += 1
      blocks.push(
        h('div', { class: 'path-suggest-dialog__block' }, [
          h('div', { class: 'path-suggest-dialog__label' }, `项目 ${project.projectNo}`),
          h('div', { class: 'path-suggest-dialog__path-sub' }, `已设置：${saved || '（未设置）'}`),
          h(
            'div',
            { class: 'path-suggest-dialog__path-sub' },
            `建议（${kindLabel}）：${suggested || '（无法生成）'}`,
          ),
        ]),
      )
    }

    if (!mismatchCount) {
      ElMessage.success(
        `已保存。关联项目将按「${kindLabel}」识别；当前已设置路径与建议一致，或尚未设置细化路径。`,
      )
      return
    }

    await ElMessageBox.alert(h('div', { class: 'path-suggest-dialog' }, blocks), '归档路径提示', {
      confirmButtonText: '知道了',
      customClass: 'path-suggest-message-box',
    })
  } catch {
    ElMessage.warning(
      '已保存。联系单类型变更可能影响项目归档路径，请到项目列表悬停本地路径查看提示。',
    )
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  try {
    if (editingId.value) {
      const oldId = editingId.value
      const updatePayload: Parameters<typeof updateContact>[1] = {
        title: form.title,
        receivedDate: form.receivedDate,
        urgency: form.urgency,
        content: form.content,
        projectNos: [...form.projectNos],
        tagIds: [...form.tagIds],
      }
      if (form.contactType === 'processing') {
        // 编辑时改为加工单：后端会把普通单号重命名为 加工单-{项目号}，并重算项目 isJiagongdan
        if (!ContactForm.isProcessingFormId(oldId)) {
          updatePayload.id = ContactForm.JIAGONGDAN_DEFAULT_ID
        }
      } else {
        const nextId = form.id?.trim() ?? ''
        if (!nextId) {
          ElMessage.warning('请填写联系单号')
          return
        }
        if (ContactForm.isProcessingFormId(nextId)) {
          ElMessage.warning('联系单号不能使用加工单格式，请填写正式联系单号')
          return
        }
        // 加工单 → 联系单：必须带上新单号，后端才会把 加工单-{项目号} 改写掉
        updatePayload.id = nextId
      }
      if (form.linkage === 'append') {
        const parentId = form.parentId?.trim() ?? ''
        if (!parentId) {
          ElMessage.warning('请选择要追加到的主单')
          return
        }
        if (parentId === oldId || parentId === (form.id?.trim() ?? '')) {
          ElMessage.warning('不能将联系单追加到自身')
          return
        }
        updatePayload.parentId = parentId
        updatePayload.relationType = form.relationType && form.relationType !== 'primary' ? form.relationType : 'supplement'
      } else if (originalParentId.value || editingIsChild.value) {
        updatePayload.parentId = ''
      }
      if (ContactForm.hasNewPrimaryUpload(form.primaryPdfList)) {
        const primaryFiles = await ContactForm.uploadFilesFromList(form.primaryPdfList)
        updatePayload.primaryPdf = primaryFiles[0]
      }
      const remainingAttachmentIds = ContactForm.getRemainingAttachmentIds(form.attachmentList)
      const removedAttachmentIds = ContactForm.getRemovedAttachmentIds(
        originalAttachmentIds.value,
        remainingAttachmentIds,
        removedAttachmentIdsInSession.value,
      )
      const newAttachmentFiles = ContactForm.getNewAttachmentFiles(form.attachmentList)
      const attachmentChanged =
        removedAttachmentIds.length > 0 || newAttachmentFiles.length > 0
      if (removedAttachmentIds.length) {
        updatePayload.removedAttachmentIds = removedAttachmentIds
      }
      if (newAttachmentFiles.length) {
        updatePayload.supplementFiles = await ContactForm.uploadFilesFromList(newAttachmentFiles)
      }
      const updated = await updateContact(oldId, updatePayload)
      const projectKey = ContactForm.resolveRememberProjectKey(
        updated.projectNos || form.projectNos,
        updated.id,
      )
      if (form.contactType === 'contact') {
        rememberFormalContactId(updated.id)
      } else if (!ContactForm.isProcessingFormId(oldId)) {
        rememberFormalContactId(oldId)
      } else if (lastFormalContactId.value && projectKey) {
        ContactForm.saveRememberedContactId(projectKey, lastFormalContactId.value)
      }
      const linkageChanged = 'parentId' in updatePayload
      if (oldId !== updated.id || attachmentChanged || linkageChanged) {
        if (highlightedContactId.value === oldId && oldId !== updated.id) {
          highlightedContactId.value = updated.id
        }
        const activeFilters = getFilters()
        clearFilterCache(activeFilters)
        await loadPage(page.value, activeFilters, true)
      } else {
        patchItem(oldId, () => updated)
      }
      await syncKnownProjectNosFromContacts()
      const typeChanged = originalContactType.value !== form.contactType
      if (typeChanged || form.contactType === 'processing') {
        await notifyArchivePathImpact([...form.projectNos], form.contactType)
      } else {
        ElMessage.success('联系单已更新')
      }
    } else {
      const primaryFiles = await ContactForm.uploadFilesFromList(form.primaryPdfList)
      const supplementFiles = await ContactForm.uploadFilesFromList(form.attachmentList)
      const created = await createContact({
        id:
          form.contactType === 'processing'
            ? ContactForm.JIAGONGDAN_DEFAULT_ID
            : form.id?.trim() || undefined,
        title: form.title,
        receivedDate: form.receivedDate,
        urgency: form.urgency,
        content: form.content,
        projectNos: [...form.projectNos],
        tagIds: [...form.tagIds],
        primaryPdf: primaryFiles[0],
        supplementFiles,
      })
      if (form.contactType === 'contact') {
        rememberFormalContactId(created.id)
      } else if (lastFormalContactId.value) {
        const projectKey = ContactForm.resolveRememberProjectKey(created.projectNos, created.id)
        if (projectKey) ContactForm.saveRememberedContactId(projectKey, lastFormalContactId.value)
      }
      const activeFilters = getFilters()
      clearFilterCache(activeFilters)
      await loadPage(1, activeFilters, true)
      await projectNoLookup.sync(created.projectNos)
      await syncKnownProjectNosFromContacts()
      if (form.contactType === 'processing') {
        await notifyArchivePathImpact([...created.projectNos], 'processing')
      } else {
        ElMessage.success('联系单已提交')
      }
      dialogVisible.value = false
      tryOpenProjectCreateForContact(created)
      return
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
      id:
        childForm.contactType === 'processing'
          ? ContactForm.JIAGONGDAN_DEFAULT_ID
          : childForm.id?.trim() || undefined,
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

async function handleCreatedAtUpdated(contact: ContactRecord) {
  patchItem(contact.id, () => contact)
}

async function handleReceivedDateUpdated(contact: ContactRecord) {
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
    const updated = await updateContact(row.id, {})
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
          <span class="card-title">{{ props.pageTitle }}</span>
          <span class="drag-tip">
            <el-icon class="drag-tip__icon"><Upload /></el-icon>
            拖到正文列上传 PDF，拖到附件列追加该行附件；拖到页面空白处可新建、追加附件或追加联系单
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
        v-model:primary-pdf-drop-target-id="primaryPdfDropTargetId"
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
        @primary-pdf-drop="handlePrimaryPdfDrop"
        @primary-pdf-invalid-drop="handlePrimaryPdfInvalidDrop"
        @received-date-updated="handleReceivedDateUpdated"
        @created-at-updated="handleCreatedAtUpdated"
      />
    </div>

    <div class="table-pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[...PAGE_SIZE_OPTIONS]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @size-change="handleSizeChange"
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
        placeholder="输入单号、项目号或联系主题搜索（加工单可用项目号）"
        style="width: 100%"
        no-data-text="未找到匹配的联系单"
      >
        <el-option
          v-for="item in appendTargetOptions"
          :key="item.id"
          :label="formatContactOptionLabel(item)"
          :value="item.id"
        >
          <div class="append-option">
            <span class="append-option__main">{{ formatContactOptionLabel(item) }}</span>
            <span v-if="item.projectNos?.length" class="append-option__sub">
              项目号：{{ item.projectNos.join('、') }}
            </span>
          </div>
        </el-option>
      </el-select>
      <p v-if="selectedAppendTarget" class="append-target-preview">
        <template v-if="dropAction === 'append_attachment'">
          附件将追加到：{{ formatContactOptionLabel(selectedAppendTarget) }}
        </template>
        <template v-else>
          将基于：{{ formatContactOptionLabel(selectedAppendTarget) }} 创建追加联系单
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
    :width="editingId ? '600px' : '560px'"
    destroy-on-close
    @closed="handleDialogClose"
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
      <el-form-item v-if="editingId" label="关联方式">
        <el-radio-group v-model="form.linkage" @change="handleLinkageChange">
          <el-radio value="independent">独立联系单</el-radio>
          <el-radio value="append">追加联系单</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="isEditingAppend" label="主单">
        <el-select
          v-model="form.parentId"
          filterable
          clearable
          :filter-method="filterAppendTargets"
          placeholder="输入单号、项目号或联系主题搜索主单"
          style="width: 100%"
          no-data-text="未找到匹配的联系单"
        >
          <el-option
            v-for="item in editParentOptions"
            :key="item.id"
            :label="formatContactOptionLabel(item)"
            :value="item.id"
          >
            <div class="append-option">
              <span class="append-option__main">{{ formatContactOptionLabel(item) }}</span>
              <span v-if="item.projectNos?.length" class="append-option__sub">
                项目号：{{ item.projectNos.join('、') }}
              </span>
            </div>
          </el-option>
        </el-select>
        <p v-if="selectedEditParent" class="append-target-preview">
          将作为「{{ formatContactOptionLabel(selectedEditParent) }}」的追加联系单
        </p>
      </el-form-item>
      <el-form-item v-if="isEditingAppend" label="单据类型">
        <el-radio-group v-model="form.relationType">
          <el-radio
            v-for="item in relationTypeOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
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
      <el-form-item v-if="form.contactType !== 'processing'" label="联系单号" prop="id">
        <el-input v-model="form.id" placeholder="请输入联系单号" />
      </el-form-item>
      <el-form-item label="联系主题" prop="title">
        <el-input v-model="form.title" placeholder="请输入联系主题" />
      </el-form-item>
      <el-form-item
        label="项目号"
        :prop="form.contactType === 'processing' ? 'projectNos' : undefined"
      >
        <el-select
          v-model="form.projectNos"
          multiple
          filterable
          allow-create
          default-first-option
          :placeholder="
            form.contactType === 'processing'
              ? '加工单以项目号定位，请填写项目号'
              : '请输入项目号，可添加多个'
          "
          style="width: 100%"
        />
        <div v-if="form.contactType === 'processing'" class="upload-tip">
          加工单无联系单号，列表中显示为「加工单(项目号)」
        </div>
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
      <el-form-item label="追加附件">
        <el-upload
          v-model:file-list="form.attachmentList"
          class="attachment-upload"
          drag
          multiple
          :auto-upload="false"
          :on-change="handleAttachmentChange"
          :on-remove="handleAttachmentRemove"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            将文件拖到此处，或<em>点击选择</em>
          </div>
          <template #tip>
            <div class="upload-tip">
              {{
                editingId
                  ? '可追加或移除附件；文件先在本地暂存，保存联系单时再上传'
                  : '追加附件为补充材料；文件先在本地暂存，提交联系单时再上传'
              }}
            </div>
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
    <el-form ref="childFormRef" :model="childForm" :rules="childFormRules" label-width="100px">
      <el-form-item label="联系单类型">
        <el-radio-group v-model="childForm.contactType" @change="handleChildContactTypeChange">
          <el-radio
            v-for="item in contactFormTypeOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="单据类型">
        <el-radio-group v-model="childForm.relationType">
          <el-radio
            v-for="item in relationTypeOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="childForm.contactType !== 'processing'" label="联系单编号" prop="id">
        <el-input v-model="childForm.id" placeholder="请输入联系单编号" />
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

  <el-dialog
    v-model="projectCreateDialogVisible"
    title="新建项目"
    width="520px"
    destroy-on-close
    @closed="handleProjectCreateDialogClosed"
  >
    <el-form
      ref="projectCreateFormRef"
      :model="projectCreateForm"
      :rules="projectCreateFormRules"
      label-width="100px"
    >
      <el-form-item label="项目号" prop="projectNo">
        <el-input v-model="projectCreateForm.projectNo" placeholder="请输入项目号" />
      </el-form-item>
      <el-form-item label="项目名称" prop="name">
        <el-input v-model="projectCreateForm.name" placeholder="请输入项目名称" />
      </el-form-item>
      <el-form-item label="计划开始">
        <el-date-picker
          v-model="projectCreateForm.plannedStartDate"
          type="date"
          placeholder="选择计划开始日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="projectCreateDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="projectCreateSubmitting" @click="submitProjectCreate">
        创建
      </el-button>
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
