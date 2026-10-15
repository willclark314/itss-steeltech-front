<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchMeetingList,
  updateMeeting,
  deleteMeeting,
  getExportUrl,
  uploadMeetingImages,
  uploadMeetingScan,
  readFileAsBase64,
  type WeeklyMeetingRecord,
} from '@/api/weeklyMeeting'
import { fetchPersonnelList } from '@/api/personnel'
import type { PersonnelRecord } from '@/models/personnel'
import ProjectDateEditCell from '@/components/biz/ProjectDateEditCell.vue'
import WeeklyMeetingEditDialog from '@/components/biz/WeeklyMeetingEditDialog.vue'

const loading = ref(false)
const meetings = ref<WeeklyMeetingRecord[]>([])
const personnelList = ref<PersonnelRecord[]>([])
const savingDateId = ref('')
const savingPersonKey = ref('')
const editingPersonKey = ref('')
const draftPersonValue = ref('')
const draftAttendeesValue = ref<string[]>([])

const dialogVisible = ref(false)
const editingMeeting = ref<WeeklyMeetingRecord | null>(null)

const MAX_MEETING_IMAGES = 2
const imageDropTargetId = ref('')
const scanDropTargetId = ref('')
const uploadingImageId = ref('')
const uploadingScanId = ref('')

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
])

const searchForm = reactive({
  year: '',
  month: '',
})

const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let y = currentYear; y >= 2025; y--) {
    years.push({ label: `${y}年`, value: `${y}` })
  }
  return years
})

const monthOptions = computed(() => {
  const months = []
  for (let m = 1; m <= 12; m++) {
    const val = `${m}`.padStart(2, '0')
    months.push({ label: `${m}月`, value: val })
  }
  return months
})

const personnelOptions = computed(() =>
  personnelList.value.map((person) => ({
    label: person.name,
    value: person.name,
  })),
)

function parseAttendees(value: string): string[] {
  return value
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : []
}

function sortMeetingsByDateDesc(list: WeeklyMeetingRecord[]) {
  return [...list].sort((a, b) => {
    const dateCompare = b.meetingDate.localeCompare(a.meetingDate)
    if (dateCompare !== 0) return dateCompare
    return b.id.localeCompare(a.id)
  })
}

function patchMeeting(updated: WeeklyMeetingRecord) {
  const index = meetings.value.findIndex((item) => item.id === updated.id)
  if (index !== -1) {
    meetings.value[index] = updated
    meetings.value = sortMeetingsByDateDesc(meetings.value)
  }
}

async function loadMeetings() {
  loading.value = true
  try {
    const result = await fetchMeetingList(searchForm.year, searchForm.month)
    meetings.value = sortMeetingsByDateDesc(result.list)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载会议列表失败')
  } finally {
    loading.value = false
  }
}

async function loadPersonnel() {
  try {
    personnelList.value = await fetchPersonnelList({ status: 'active' })
  } catch {
    // Silent fail — personnel list is non-critical
  }
}

function handleSearch() {
  loadMeetings()
}

function handleReset() {
  searchForm.year = ''
  searchForm.month = ''
  loadMeetings()
}

function openCreateDialog() {
  editingMeeting.value = null
  dialogVisible.value = true
}

function openEditDialog(row: WeeklyMeetingRecord) {
  editingMeeting.value = row
  dialogVisible.value = true
}

async function handleDelete(row: WeeklyMeetingRecord) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${row.meetingDate} 的会议记录吗？相关的图片附件和扫描件也会被删除。`,
      '删除确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  try {
    await deleteMeeting(row.id)
    ElMessage.success('会议记录已删除')
    await loadMeetings()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

function handleExport(row: WeeklyMeetingRecord) {
  window.open(getExportUrl(row.id), '_blank')
}

function isMeetingDateSaving(meetingId: string) {
  return savingDateId.value === meetingId
}

function isPersonFieldSaving(meetingId: string, field: 'host' | 'recorder' | 'attendees') {
  return savingPersonKey.value === `${meetingId}:${field}`
}

function personEditKey(meetingId: string, field: 'host' | 'recorder' | 'attendees') {
  return `${meetingId}:${field}`
}

function isPersonEditing(meetingId: string, field: 'host' | 'recorder' | 'attendees') {
  return editingPersonKey.value === personEditKey(meetingId, field)
}

function stopPersonEdit() {
  editingPersonKey.value = ''
}

async function startPersonEdit(row: WeeklyMeetingRecord, field: 'host' | 'recorder' | 'attendees') {
  if (isPersonFieldSaving(row.id, field)) return
  editingPersonKey.value = personEditKey(row.id, field)
  if (field === 'attendees') {
    draftAttendeesValue.value = parseAttendees(row.attendees)
  } else {
    draftPersonValue.value = row[field]
  }
  await nextTick()
}

async function onPersonSelectChange(
  row: WeeklyMeetingRecord,
  field: 'host' | 'recorder',
  value: string,
) {
  stopPersonEdit()
  await handlePersonFieldChange(row, field, value)
}

function onPersonSelectVisibleChange(
  row: WeeklyMeetingRecord,
  field: 'host' | 'recorder',
  visible: boolean,
) {
  if (!visible && isPersonEditing(row.id, field)) {
    stopPersonEdit()
  }
}

async function onAttendeesVisibleChange(row: WeeklyMeetingRecord, visible: boolean) {
  if (visible || !isPersonEditing(row.id, 'attendees')) return

  if (draftAttendeesValue.value.length === 0) {
    draftAttendeesValue.value = parseAttendees(row.attendees)
    stopPersonEdit()
    return
  }

  const nextValue = draftAttendeesValue.value.join(', ')
  stopPersonEdit()
  if (nextValue !== row.attendees) {
    await handleAttendeesChange(row, [...draftAttendeesValue.value])
  }
}

async function handleMeetingDateChange(row: WeeklyMeetingRecord, value: string) {
  if (!value) {
    ElMessage.warning('会议日期不能为空')
    return
  }
  if (value === row.meetingDate) return

  savingDateId.value = row.id
  try {
    const updated = await updateMeeting(row.id, { meetingDate: value })
    patchMeeting(updated)
    ElMessage.success('会议日期已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存会议日期失败')
  } finally {
    if (savingDateId.value === row.id) {
      savingDateId.value = ''
    }
  }
}

async function handlePersonFieldChange(
  row: WeeklyMeetingRecord,
  field: 'host' | 'recorder',
  value: string,
) {
  if (!value) {
    ElMessage.warning(field === 'host' ? '主持人不能为空' : '记录人不能为空')
    return
  }
  if (value === row[field]) return

  const savingKey = `${row.id}:${field}`
  savingPersonKey.value = savingKey
  try {
    const updated = await updateMeeting(row.id, { [field]: value })
    patchMeeting(updated)
    ElMessage.success(field === 'host' ? '主持人已保存' : '记录人已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    if (savingPersonKey.value === savingKey) {
      savingPersonKey.value = ''
    }
  }
}

async function handleAttendeesChange(row: WeeklyMeetingRecord, values: string[]) {
  if (values.length === 0) {
    ElMessage.warning('出席人员不能为空')
    return
  }

  const nextValue = values.join(', ')
  if (nextValue === row.attendees) return

  const savingKey = `${row.id}:attendees`
  savingPersonKey.value = savingKey
  try {
    const updated = await updateMeeting(row.id, { attendees: nextValue })
    patchMeeting(updated)
    ElMessage.success('出席人员已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存出席人员失败')
  } finally {
    if (savingPersonKey.value === savingKey) {
      savingPersonKey.value = ''
    }
  }
}

function hasFileDrag(event: DragEvent) {
  return event.dataTransfer?.types.includes('Files') ?? false
}

function isAcceptedImageFile(file: File) {
  const type = file.type || ''
  return ACCEPTED_IMAGE_TYPES.has(type)
    || /^image\//.test(type)
    || /\.(png|jpe?g|gif|webp)$/i.test(file.name)
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

function extractDroppedFiles(dataTransfer: DataTransfer | null) {
  return Array.from(dataTransfer?.files || [])
}

function handleImageDragOver(event: DragEvent, row: WeeklyMeetingRecord) {
  if (!hasFileDrag(event) || uploadingImageId.value) return
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer!.dropEffect = 'copy'
  scanDropTargetId.value = ''
  imageDropTargetId.value = row.id
}

function handleImageDragLeave(event: DragEvent, row: WeeklyMeetingRecord) {
  const current = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (related && current?.contains(related)) return
  if (imageDropTargetId.value === row.id) {
    imageDropTargetId.value = ''
  }
}

async function handleImageDrop(event: DragEvent, row: WeeklyMeetingRecord) {
  event.preventDefault()
  event.stopPropagation()
  imageDropTargetId.value = ''
  if (uploadingImageId.value) return

  const files = extractDroppedFiles(event.dataTransfer).filter(isAcceptedImageFile)
  if (!files.length) {
    ElMessage.warning('仅支持 PNG、JPG、GIF、WebP 格式图片')
    return
  }

  const remaining = Math.max(0, MAX_MEETING_IMAGES - (row.images?.length || 0))
  if (remaining <= 0) {
    ElMessage.warning(`每条会议记录最多上传 ${MAX_MEETING_IMAGES} 张图片`)
    return
  }

  const toUpload = files.slice(0, remaining)
  if (files.length > remaining) {
    ElMessage.warning(`每条会议记录最多上传 ${MAX_MEETING_IMAGES} 张图片，已取前 ${remaining} 张`)
  }

  uploadingImageId.value = row.id
  try {
    const uploadItems = []
    for (const file of toUpload) {
      const { content, mimeType } = await readFileAsBase64(file)
      uploadItems.push({ fileName: file.name, content, mimeType })
    }
    const result = await uploadMeetingImages(row.id, uploadItems)
    patchMeeting({
      ...row,
      images: [...(row.images || []), ...result.images],
    })
    ElMessage.success(`已上传 ${result.images.length} 张图片`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '图片上传失败')
  } finally {
    if (uploadingImageId.value === row.id) {
      uploadingImageId.value = ''
    }
  }
}

function handleScanDragOver(event: DragEvent, row: WeeklyMeetingRecord) {
  if (!hasFileDrag(event) || uploadingScanId.value) return
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer!.dropEffect = 'copy'
  imageDropTargetId.value = ''
  scanDropTargetId.value = row.id
}

function handleScanDragLeave(event: DragEvent, row: WeeklyMeetingRecord) {
  const current = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (related && current?.contains(related)) return
  if (scanDropTargetId.value === row.id) {
    scanDropTargetId.value = ''
  }
}

async function handleScanDrop(event: DragEvent, row: WeeklyMeetingRecord) {
  event.preventDefault()
  event.stopPropagation()
  scanDropTargetId.value = ''
  if (uploadingScanId.value) return

  const pdfFile = extractDroppedFiles(event.dataTransfer).find(isPdfFile)
  if (!pdfFile) {
    ElMessage.warning('会议记录扫描件仅支持 PDF 格式')
    return
  }

  uploadingScanId.value = row.id
  try {
    const { content, mimeType } = await readFileAsBase64(pdfFile)
    const result = await uploadMeetingScan(row.id, {
      fileName: pdfFile.name,
      content,
      mimeType,
    })
    patchMeeting({
      ...row,
      recordScan: result.recordScan,
    })
    ElMessage.success(row.recordScan ? '扫描件已替换' : '扫描件已上传')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '扫描件上传失败')
  } finally {
    if (uploadingScanId.value === row.id) {
      uploadingScanId.value = ''
    }
  }
}

onMounted(() => {
  loadMeetings()
  loadPersonnel()
})
</script>

<template>
  <el-card shadow="never" class="biz-page-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">周例会</span>
          <span class="page-tip">填写周例会内容、上传图片附件与会议记录扫描件、导出会议纪要文件</span>
        </div>
      </div>
    </template>

    <div class="search-toolbar">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="年份">
          <el-select v-model="searchForm.year" placeholder="全部" clearable style="width: 110px">
            <el-option
              v-for="opt in yearOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="月份">
          <el-select v-model="searchForm.month" placeholder="全部" clearable style="width: 100px">
            <el-option
              v-for="opt in monthOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="search-total">共 {{ meetings.length }} 条</span>
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          新建周例会
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="table-scroll">
      <el-table
        :data="meetings"
        stripe
        style="width: 100%"
        :empty-text="loading ? '' : '暂无会议记录'"
        :default-sort="{ prop: 'meetingDate', order: 'descending' }"
      >
        <el-table-column
          prop="meetingDate"
          label="会议日期"
          width="128"
          align="center"
          sortable
          :sort-orders="['descending', 'ascending']"
          class-name="date-column"
        >
          <template #default="{ row }">
            <ProjectDateEditCell
              :model-value="row.meetingDate"
              :loading="isMeetingDateSaving(row.id)"
              @change="(value) => handleMeetingDateChange(row as WeeklyMeetingRecord, value)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="meetingTheme" label="会议主题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="location" label="地点" width="250" show-overflow-tooltip />
        <el-table-column label="主持" width="108" align="center">
          <template #default="{ row }">
            <button
              v-if="!isPersonEditing(row.id, 'host')"
              type="button"
              class="table-cell-display"
              :class="{ 'is-loading': isPersonFieldSaving(row.id, 'host'), 'is-empty': !row.host }"
              :disabled="isPersonFieldSaving(row.id, 'host')"
              @click.stop="startPersonEdit(row as WeeklyMeetingRecord, 'host')"
            >
              {{ row.host || '-' }}
            </button>
            <el-select
              v-else
              v-model="draftPersonValue"
              size="small"
              filterable
              allow-create
              default-first-option
              automatic-dropdown
              class="table-person-select"
              @change="(value: string) => onPersonSelectChange(row as WeeklyMeetingRecord, 'host', value)"
              @visible-change="(visible: boolean) => onPersonSelectVisibleChange(row as WeeklyMeetingRecord, 'host', visible)"
              @click.stop
            >
              <el-option
                v-for="opt in personnelOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="记录人" width="108" align="center">
          <template #default="{ row }">
            <button
              v-if="!isPersonEditing(row.id, 'recorder')"
              type="button"
              class="table-cell-display"
              :class="{ 'is-loading': isPersonFieldSaving(row.id, 'recorder'), 'is-empty': !row.recorder }"
              :disabled="isPersonFieldSaving(row.id, 'recorder')"
              @click.stop="startPersonEdit(row as WeeklyMeetingRecord, 'recorder')"
            >
              {{ row.recorder || '-' }}
            </button>
            <el-select
              v-else
              v-model="draftPersonValue"
              size="small"
              filterable
              allow-create
              default-first-option
              automatic-dropdown
              class="table-person-select"
              @change="(value: string) => onPersonSelectChange(row as WeeklyMeetingRecord, 'recorder', value)"
              @visible-change="(visible: boolean) => onPersonSelectVisibleChange(row as WeeklyMeetingRecord, 'recorder', visible)"
              @click.stop
            >
              <el-option
                v-for="opt in personnelOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="出席人员" min-width="220">
          <template #default="{ row }">
            <el-tooltip
              v-if="!isPersonEditing(row.id, 'attendees')"
              :content="row.attendees"
              placement="top"
              :show-after="300"
              :disabled="!row.attendees"
            >
              <button
                type="button"
                class="table-cell-display table-cell-display--left"
                :class="{ 'is-loading': isPersonFieldSaving(row.id, 'attendees'), 'is-empty': !row.attendees }"
                :disabled="isPersonFieldSaving(row.id, 'attendees')"
                @click.stop="startPersonEdit(row as WeeklyMeetingRecord, 'attendees')"
              >
                {{ row.attendees || '-' }}
              </button>
            </el-tooltip>
            <el-select
              v-else
              v-model="draftAttendeesValue"
              multiple
              collapse-tags
              collapse-tags-tooltip
              size="small"
              filterable
              allow-create
              default-first-option
              automatic-dropdown
              class="table-person-select table-person-select--multiple"
              @visible-change="(visible: boolean) => onAttendeesVisibleChange(row as WeeklyMeetingRecord, visible)"
              @click.stop
            >
              <el-option
                v-for="opt in personnelOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="图片" width="88" align="center" class-name="attachment-column">
          <template #default="{ row }">
            <div
              class="attachment-drop-zone"
              :class="{ 'is-uploading': uploadingImageId === row.id }"
              @dragenter="handleImageDragOver($event, row as WeeklyMeetingRecord)"
              @dragover="handleImageDragOver($event, row as WeeklyMeetingRecord)"
              @dragleave="handleImageDragLeave($event, row as WeeklyMeetingRecord)"
              @drop="handleImageDrop($event, row as WeeklyMeetingRecord)"
            >
              <span
                v-if="row.images?.length"
                style="font-size: 12px; color: var(--el-color-primary);"
              >
                {{ row.images.length }} 张
              </span>
              <span v-else style="font-size: 12px; color: var(--el-text-color-placeholder);">无</span>
              <div v-if="imageDropTargetId === row.id" class="attachment-drop-overlay">
                <el-icon :size="18"><Upload /></el-icon>
                <span>松手上传</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="扫描件" width="88" align="center" class-name="attachment-column">
          <template #default="{ row }">
            <div
              class="attachment-drop-zone"
              :class="{ 'is-uploading': uploadingScanId === row.id }"
              @dragenter="handleScanDragOver($event, row as WeeklyMeetingRecord)"
              @dragover="handleScanDragOver($event, row as WeeklyMeetingRecord)"
              @dragleave="handleScanDragLeave($event, row as WeeklyMeetingRecord)"
              @drop="handleScanDrop($event, row as WeeklyMeetingRecord)"
            >
              <el-link
                v-if="row.recordScan?.url"
                :href="row.recordScan.url"
                target="_blank"
                type="primary"
                style="font-size: 12px;"
                @click.stop
              >
                查看
              </el-link>
              <span v-else style="font-size: 12px; color: var(--el-text-color-placeholder);">无</span>
              <div v-if="scanDropTargetId === row.id" class="attachment-drop-overlay">
                <el-icon :size="18"><Upload /></el-icon>
                <span>松手上传</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditDialog(row as WeeklyMeetingRecord)">
              编辑
            </el-button>
            <el-button link type="primary" size="small" @click="handleExport(row as WeeklyMeetingRecord)">
              导出
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row as WeeklyMeetingRecord)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <WeeklyMeetingEditDialog
      v-model="dialogVisible"
      :meeting="editingMeeting"
      :personnel-options="personnelOptions"
      @saved="loadMeetings"
    />
  </el-card>
</template>

<style scoped>
.page-tip {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--el-text-color-secondary);
}

.table-cell-display {
  display: block;
  width: 100%;
  min-height: var(--biz-table-row-height, 35px);
  padding: 0 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: var(--biz-table-row-height, 35px);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.table-cell-display--left {
  text-align: left;
}

.table-cell-display:hover:not(:disabled) {
  background: var(--el-fill-color-light);
}

.table-cell-display.is-empty {
  color: var(--el-text-color-placeholder);
}

.table-cell-display.is-loading {
  cursor: wait;
  opacity: 0.6;
}

.table-person-select {
  width: 100%;
}

.table-person-select :deep(.el-input__wrapper) {
  min-height: 24px;
  padding: 0 4px;
  box-shadow: 0 0 0 1px var(--el-input-hover-border-color) inset;
  background: var(--el-fill-color-blank);
}

.table-person-select :deep(.el-input__inner) {
  font-size: 13px;
}

.table-person-select--multiple :deep(.el-select__tags) {
  max-width: calc(100% - 20px);
}

.attachment-drop-zone {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--biz-table-row-height, 35px);
  border-radius: 4px;
}

.attachment-drop-zone.is-uploading {
  opacity: 0.55;
  pointer-events: none;
}

.attachment-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
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
  padding: 0 2px;
}
</style>
