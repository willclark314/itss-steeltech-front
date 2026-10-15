<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
import {
  fetchTrainingList,
  deleteTraining,
  uploadTrainingMaterial,
  uploadTrainingPhotos,
  uploadTrainingPrimaryPdf,
  readFileAsBase64,
  getExportUrl,
  CATEGORY_TAG_COLORS,
  type MonthlyTrainingMaterial,
  type MonthlyTrainingRecord,
} from '@/api/monthlyTraining'
import { fetchPersonnelList } from '@/api/personnel'
import type { PersonnelRecord } from '@/models/personnel'
import MonthlyTrainingEditDialog from '@/components/biz/MonthlyTrainingEditDialog.vue'
import AttachmentIconsCell from '@/components/biz/AttachmentIconsCell.vue'

const loading = ref(false)
const trainings = ref<MonthlyTrainingRecord[]>([])
const personnelList = ref<PersonnelRecord[]>([])

const dialogVisible = ref(false)
const editingTraining = ref<MonthlyTrainingRecord | null>(null)

const searchForm = reactive({ year: '', month: '' })

const MAX_MATERIALS = 10
const MAX_PHOTOS = 5

const primaryPdfDropTargetId = ref('')
const materialDropTargetId = ref('')
const photoDropTargetId = ref('')
const uploadingPrimaryPdfId = ref('')
const uploadingMaterialId = ref('')
const uploadingPhotoId = ref('')

function toAttachmentFiles(materials?: MonthlyTrainingMaterial[]) {
  return (materials || []).map((m) => ({
    id: m.id,
    name: m.fileName,
    url: m.url,
  }))
}

const yearOptions = computed(() => {
  const years = []
  for (let y = new Date().getFullYear(); y >= 2024; y--) {
    years.push({ label: `${y}年`, value: `${y}` })
  }
  return years
})

const monthOptions = computed(() => {
  const months = []
  for (let m = 1; m <= 12; m++) {
    months.push({ label: `${m}月`, value: `${m}`.padStart(2, '0') })
  }
  return months
})

const personnelOptions = computed(() =>
  personnelList.value.map((p) => ({ label: p.name, value: p.name })),
)

async function loadTrainings() {
  loading.value = true
  try {
    const result = await fetchTrainingList(searchForm.year, searchForm.month)
    trainings.value = result.list
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载培训记录失败')
  } finally {
    loading.value = false
  }
}

async function loadPersonnel() {
  try {
    personnelList.value = await fetchPersonnelList({ status: 'active' })
  } catch { /* silent */ }
}

function handleSearch() { loadTrainings() }
function handleReset() {
  searchForm.year = ''
  searchForm.month = ''
  loadTrainings()
}

function openCreateDialog() {
  editingTraining.value = null
  dialogVisible.value = true
}

function openEditDialog(row: MonthlyTrainingRecord) {
  editingTraining.value = row
  dialogVisible.value = true
}

async function handleDelete(row: MonthlyTrainingRecord) {
  try {
    await ElMessageBox.confirm(
      `确定要删除「${row.title}」的培训记录吗？相关正文、附件和照片也会被删除。`,
      '删除确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
    )
  } catch { return }
  try {
    await deleteTraining(row.id)
    ElMessage.success('培训记录已删除')
    await loadTrainings()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

function handleExport(row: MonthlyTrainingRecord) {
  window.open(getExportUrl(row.id), '_blank')
}

function onSaved() { loadTrainings() }

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.type === 'application/x-pdf' || /\.pdf$/i.test(file.name)
}

// ── Inline material upload (drag-drop on material cell) ─────────────────────

function patchTraining(trainingId: string, updater: (t: MonthlyTrainingRecord) => MonthlyTrainingRecord) {
  const idx = trainings.value.findIndex((t) => t.id === trainingId)
  if (idx !== -1) {
    trainings.value[idx] = updater(trainings.value[idx])
  }
}

async function handlePrimaryPdfDrop(event: DragEvent, row: MonthlyTrainingRecord) {
  event.preventDefault()
  event.stopPropagation()
  primaryPdfDropTargetId.value = ''
  if (uploadingPrimaryPdfId.value) return

  const files = Array.from(event.dataTransfer?.files || [])
  if (!files.length) return
  const file = files[0]
  if (!isPdfFile(file)) {
    ElMessage.warning('正文列仅支持 PDF 文件')
    return
  }

  const hadPrimary = !!row.primaryPdf?.url
  uploadingPrimaryPdfId.value = row.id
  try {
    const { content, mimeType } = await readFileAsBase64(file)
    const updated = await uploadTrainingPrimaryPdf(row.id, {
      fileName: file.name,
      content,
      mimeType,
    })
    patchTraining(row.id, () => updated)
    ElMessage.success(`正文 PDF 已${hadPrimary ? '更新' : '上传'}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传正文 PDF 失败')
  } finally {
    uploadingPrimaryPdfId.value = ''
  }
}

function handlePrimaryPdfDragOver(event: DragEvent, row: MonthlyTrainingRecord) {
  if (uploadingPrimaryPdfId.value) return
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
  materialDropTargetId.value = ''
  photoDropTargetId.value = ''
  primaryPdfDropTargetId.value = row.id
}

function handlePrimaryPdfDragLeave(_event: DragEvent, row: MonthlyTrainingRecord) {
  if (primaryPdfDropTargetId.value === row.id) {
    primaryPdfDropTargetId.value = ''
  }
}

async function handleMaterialDrop(event: DragEvent, row: MonthlyTrainingRecord) {
  event.preventDefault()
  event.stopPropagation()
  materialDropTargetId.value = ''
  if (uploadingMaterialId.value) return

  const files = Array.from(event.dataTransfer?.files || [])
  if (!files.length) return

  if ((row.materials?.length || 0) >= MAX_MATERIALS) {
    ElMessage.warning(`每条培训记录最多上传 ${MAX_MATERIALS} 个文件`)
    return
  }

  uploadingMaterialId.value = row.id
  try {
    for (const file of files) {
      const { content, mimeType } = await readFileAsBase64(file)
      const result = await uploadTrainingMaterial(row.id, {
        fileName: file.name,
        content,
        mimeType,
      }, '')
      patchTraining(row.id, (t) => ({
        ...t,
        materials: [...(t.materials || []), result.material],
      }))
    }
    ElMessage.success('文件已上传')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '文件上传失败')
  } finally {
    uploadingMaterialId.value = ''
  }
}

async function handlePhotoDrop(event: DragEvent, row: MonthlyTrainingRecord) {
  event.preventDefault()
  event.stopPropagation()
  photoDropTargetId.value = ''
  if (uploadingPhotoId.value) return

  const files = Array.from(event.dataTransfer?.files || [])
    .filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(f.name))
  if (!files.length) {
    ElMessage.warning('仅支持 PNG、JPG、GIF、WebP 格式图片')
    return
  }

  const remaining = Math.max(0, MAX_PHOTOS - (row.photos?.length || 0))
  if (remaining <= 0) {
    ElMessage.warning(`每条培训记录最多上传 ${MAX_PHOTOS} 张照片`)
    return
  }

  const toUpload = files.slice(0, remaining)
  uploadingPhotoId.value = row.id
  try {
    const items = []
    for (const file of toUpload) {
      const { content, mimeType } = await readFileAsBase64(file)
      items.push({ fileName: file.name, content, mimeType })
    }
    const result = await uploadTrainingPhotos(row.id, items)
    patchTraining(row.id, (t) => ({
      ...t,
      photos: [...(t.photos || []), ...result.photos],
    }))
    ElMessage.success(`已上传 ${result.photos.length} 张照片`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '照片上传失败')
  } finally {
    uploadingPhotoId.value = ''
  }
}

function handleMaterialDragOver(event: DragEvent, row: MonthlyTrainingRecord) {
  if (uploadingMaterialId.value) return
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
  primaryPdfDropTargetId.value = ''
  photoDropTargetId.value = ''
  materialDropTargetId.value = row.id
}

function handleMaterialDragLeave(_event: DragEvent, row: MonthlyTrainingRecord) {
  if (materialDropTargetId.value === row.id) {
    materialDropTargetId.value = ''
  }
}

function handlePhotoDragOver(event: DragEvent, row: MonthlyTrainingRecord) {
  if (uploadingPhotoId.value) return
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
  primaryPdfDropTargetId.value = ''
  materialDropTargetId.value = ''
  photoDropTargetId.value = row.id
}

function handlePhotoDragLeave(_event: DragEvent, row: MonthlyTrainingRecord) {
  if (photoDropTargetId.value === row.id) {
    photoDropTargetId.value = ''
  }
}

onMounted(() => { loadTrainings(); loadPersonnel() })
</script>

<template>
  <el-card shadow="never" class="biz-page-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">月度制度培训</span>
          <span class="page-tip">管理月度制度培训记录，上传正文 PDF、培训材料、照片并导出培训记录文件</span>
        </div>
      </div>
    </template>

    <div class="search-toolbar">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="年份">
          <el-select v-model="searchForm.year" placeholder="全部" clearable style="width: 110px">
            <el-option v-for="opt in yearOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="月份">
          <el-select v-model="searchForm.month" placeholder="全部" clearable style="width: 100px">
            <el-option v-for="opt in monthOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
      <div style="display: flex; align-items: center; gap: 12px">
        <span class="search-total">共 {{ trainings.length }} 条</span>
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>新建培训
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="table-scroll">
      <el-table :data="trainings" stripe style="width: 100%" :empty-text="loading ? '' : '暂无培训记录'">
        <el-table-column label="序号" width="70" align="center">
          <template #default="{ row }">
            <span style="font-size: 13px">{{ row.itemSeq }}</span>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              size="small"
              :color="CATEGORY_TAG_COLORS[row.categoryTag] || '#909399'"
              :style="{ color: '#fff', border: 'none' }"
            >
              {{ row.categoryTag || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="培训主题" min-width="280" show-overflow-tooltip />
        <el-table-column prop="trainer" label="培训人" width="100" align="center" />
        <el-table-column label="正文" width="72" align="center" class-name="attachment-column">
          <template #default="{ row }">
            <div
              class="attachment-drop-zone"
              :class="{ 'is-uploading': uploadingPrimaryPdfId === row.id }"
              @dragenter.prevent
              @dragover="handlePrimaryPdfDragOver($event, row as MonthlyTrainingRecord)"
              @dragleave="handlePrimaryPdfDragLeave($event, row as MonthlyTrainingRecord)"
              @drop.capture="handlePrimaryPdfDrop($event, row as MonthlyTrainingRecord)"
            >
              <el-link
                v-if="row.primaryPdf?.url"
                :href="row.primaryPdf.url"
                target="_blank"
                type="primary"
                :underline="false"
                @click.stop
              >
                <el-icon :size="18"><Document /></el-icon>
              </el-link>
              <span v-else style="font-size: 12px; color: var(--el-text-color-placeholder);">-</span>
              <div v-if="primaryPdfDropTargetId === row.id" class="attachment-drop-overlay">
                <el-icon :size="16"><Upload /></el-icon>
                <span>松手上传正文</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="附件" width="72" align="center" class-name="attachment-column">
          <template #default="{ row }">
            <div
              class="attachment-drop-zone"
              :class="{ 'is-uploading': uploadingMaterialId === row.id }"
              @dragenter.prevent
              @dragover="handleMaterialDragOver($event, row as MonthlyTrainingRecord)"
              @dragleave="handleMaterialDragLeave($event, row as MonthlyTrainingRecord)"
              @drop.capture="handleMaterialDrop($event, row as MonthlyTrainingRecord)"
            >
              <AttachmentIconsCell :files="toAttachmentFiles(row.materials)" />
              <div v-if="materialDropTargetId === row.id" class="attachment-drop-overlay">
                <el-icon :size="20"><Upload /></el-icon>
                <span>松手上传</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="照片" width="88" align="center" class-name="attachment-column">
          <template #default="{ row }">
            <div
              class="attachment-drop-zone"
              :class="{ 'is-uploading': uploadingPhotoId === row.id }"
              @dragenter.prevent
              @dragover="handlePhotoDragOver($event, row as MonthlyTrainingRecord)"
              @dragleave="handlePhotoDragLeave($event, row as MonthlyTrainingRecord)"
              @drop.capture="handlePhotoDrop($event, row as MonthlyTrainingRecord)"
            >
              <span v-if="row.photos?.length" style="font-size: 12px; color: var(--el-color-primary);">
                {{ row.photos.length }} 张
              </span>
              <span v-else style="font-size: 12px; color: var(--el-text-color-placeholder);">拖入上传</span>
              <div v-if="photoDropTargetId === row.id" class="attachment-drop-overlay">
                <el-icon :size="16"><Upload /></el-icon>
                <span>松手上传</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditDialog(row as MonthlyTrainingRecord)">编辑</el-button>
            <el-button link type="primary" size="small" @click="handleExport(row as MonthlyTrainingRecord)">导出</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row as MonthlyTrainingRecord)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <MonthlyTrainingEditDialog
      v-model="dialogVisible"
      :training="editingTraining"
      :personnel-options="personnelOptions"
      :personnel-list="personnelList"
      @saved="onSaved"
    />
  </el-card>
</template>

<style scoped>
.page-tip { font-size: 12px; font-weight: 400; line-height: 1.2; color: var(--el-text-color-secondary); }

.attachment-drop-zone {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  flex: 1;
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

.text-muted {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
