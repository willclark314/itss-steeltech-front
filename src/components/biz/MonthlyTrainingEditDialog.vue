<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { DeleteFilled } from '@element-plus/icons-vue'
import {
  createTraining,
  updateTraining,
  uploadTrainingMaterial,
  uploadTrainingPhotos,
  uploadTrainingPrimaryPdf,
  deleteTrainingMaterial,
  deleteTrainingPhoto,
  deleteTrainingPrimaryPdf,
  readFileAsBase64,
  CATEGORY_TAGS,
  MATERIAL_TYPES,
  MATERIAL_TYPE_LABELS,
  type MonthlyTrainingRecord,
  type MonthlyTrainingMaterial,
  type MonthlyTrainingPhoto,
  type MonthlyTrainingPrimaryPdf,
} from '@/api/monthlyTraining'
import type { PersonnelRecord } from '@/models/personnel'

const MAX_PHOTOS = 5

const props = defineProps<{
  modelValue: boolean
  training: MonthlyTrainingRecord | null
  personnelOptions: { label: string; value: string }[]
  personnelList: PersonnelRecord[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const isEdit = computed(() => !!props.training)

const formRef = ref<FormInstance>()
const submitting = ref(false)
const uploading = ref(false)

const form = reactive({
  trainingYear: '',
  trainingMonth: '',
  trainingDate: '',
  itemSeq: 1,
  categoryTag: '',
  title: '',
  trainer: '',
  archiveNo: '',
})

const formRules: FormRules = {
  trainingYear: [{ required: true, message: '请选择年度', trigger: 'change' }],
  trainingMonth: [{ required: true, message: '请选择月份', trigger: 'change' }],
  title: [{ required: true, message: '请输入培训主题', trigger: 'blur' }],
}

function defaultArchiveNo(year: string, month: string) {
  if (!year || !month) return ''
  return `DTP-GGJSK${year}-${month}A`
}

function syncArchiveNoFromYearMonth(prevYear: string, prevMonth: string) {
  const prevDefault = defaultArchiveNo(prevYear, prevMonth)
  const nextDefault = defaultArchiveNo(form.trainingYear, form.trainingMonth)
  if (!form.archiveNo || form.archiveNo === prevDefault) {
    form.archiveNo = nextDefault
  }
}

const existingPrimaryPdf = ref<MonthlyTrainingPrimaryPdf | null>(null)
const removePrimaryPdf = ref(false)
const pendingPrimaryPdfFile = ref<any[]>([])

const existingMaterials = ref<MonthlyTrainingMaterial[]>([])
const removedMaterialIds = ref<string[]>([])
const pendingMaterialFiles = ref<any[]>([])
const pendingMaterialTypes = ref<Record<string, string>>({})

const existingPhotos = ref<MonthlyTrainingPhoto[]>([])
const removedPhotoIds = ref<string[]>([])
const pendingPhotoFiles = ref<any[]>([])

// ── Primary PDF (正文) ──────────────────────────────────────────────────────

function resetPrimaryPdfState() {
  existingPrimaryPdf.value = null
  removePrimaryPdf.value = false
  pendingPrimaryPdfFile.value = []
}

function isPdfUploadFile(file: any): boolean {
  const name = String(file?.name || file?.raw?.name || '').toLowerCase()
  const type = String(file?.raw?.type || file?.type || '').toLowerCase()
  return name.endsWith('.pdf') || type === 'application/pdf' || type === 'application/x-pdf'
}

function handlePrimaryPdfChange(file: any, fileList: any[]) {
  if (!isPdfUploadFile(file)) {
    ElMessage.warning('正文仅支持 PDF 文件')
    pendingPrimaryPdfFile.value = fileList.filter((f: any) => f.uid !== file.uid)
    return
  }
  pendingPrimaryPdfFile.value = fileList.slice(-1)
  removePrimaryPdf.value = false
}

function handlePrimaryPdfRemove(_file: any, fileList: any[]) {
  pendingPrimaryPdfFile.value = fileList
}

function handleRemoveExistingPrimaryPdf() {
  existingPrimaryPdf.value = null
  removePrimaryPdf.value = true
  pendingPrimaryPdfFile.value = []
}

// ── Material upload ────────────────────────────────────────────────────────

const materialDragOver = ref(false)
let materialDragCounter = 0

function resetMaterialState() {
  existingMaterials.value = []
  removedMaterialIds.value = []
  pendingMaterialFiles.value = []
  pendingMaterialTypes.value = {}
  materialDragOver.value = false
  materialDragCounter = 0
}

function handleRemoveExistingMaterial(mat: MonthlyTrainingMaterial) {
  removedMaterialIds.value.push(mat.id)
  existingMaterials.value = existingMaterials.value.filter((m) => m.id !== mat.id)
}

function handleMaterialFileChange(_file: any, fileList: any[]) {
  pendingMaterialFiles.value = fileList.filter((f: any) => f.raw instanceof File)
  for (const f of fileList) {
    if (!pendingMaterialTypes.value[f.uid]) {
      pendingMaterialTypes.value[f.uid] = ''
    }
  }
}

function setMaterialType(uid: string, type: string) {
  pendingMaterialTypes.value[uid] = type
}

function handleMaterialDragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  materialDragCounter += 1
  materialDragOver.value = true
}

function handleMaterialDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.dataTransfer.dropEffect = 'copy'
  materialDragOver.value = true
}

function handleMaterialDragLeave() {
  materialDragCounter = Math.max(0, materialDragCounter - 1)
  if (materialDragCounter === 0) materialDragOver.value = false
}

function handleMaterialDrop(event: DragEvent) {
  event.stopPropagation()
  materialDragCounter = 0
  materialDragOver.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  for (const file of files) {
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    pendingMaterialFiles.value.push({
      name: file.name, size: file.size, raw: file, uid,
      status: 'ready' as const,
    })
    pendingMaterialTypes.value[uid] = ''
  }
}

// ── Photo upload ────────────────────────────────────────────────────────────

const photoDragOver = ref(false)
let photoDragCounter = 0

function resetPhotoState() {
  existingPhotos.value = []
  removedPhotoIds.value = []
  pendingPhotoFiles.value = []
  photoDragOver.value = false
  photoDragCounter = 0
}

const photoUploadLimit = computed(() =>
  Math.max(0, MAX_PHOTOS - existingPhotos.value.length),
)

function handleRemoveExistingPhoto(photo: MonthlyTrainingPhoto) {
  removedPhotoIds.value.push(photo.id)
  existingPhotos.value = existingPhotos.value.filter((p) => p.id !== photo.id)
}

function handlePhotoFileChange(_file: any, fileList: any[]) {
  pendingPhotoFiles.value = fileList.filter((f: any) => f.raw instanceof File)
}

function handlePhotoExceed() {
  ElMessage.warning(`每条培训记录最多上传 ${MAX_PHOTOS} 张照片`)
}

function handlePhotoDragEnter(event: DragEvent) {
  if (photoUploadLimit.value <= 0) return
  if (!event.dataTransfer?.types.includes('Files')) return
  photoDragCounter += 1
  photoDragOver.value = true
}

function handlePhotoDragOver(event: DragEvent) {
  if (photoUploadLimit.value <= 0) return
  if (!event.dataTransfer?.types.includes('Files')) return
  event.dataTransfer.dropEffect = 'copy'
  photoDragOver.value = true
}

function handlePhotoDragLeave() {
  photoDragCounter = Math.max(0, photoDragCounter - 1)
  if (photoDragCounter === 0) photoDragOver.value = false
}

function handlePhotoDrop(event: DragEvent) {
  event.stopPropagation()
  photoDragCounter = 0
  photoDragOver.value = false
  if (photoUploadLimit.value <= 0) return
  const files = Array.from(event.dataTransfer?.files || [])
    .filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(f.name))
  if (!files.length) return
  const remaining = photoUploadLimit.value - pendingPhotoFiles.value.length
  if (remaining <= 0) { handlePhotoExceed(); return }
  for (const file of files.slice(0, remaining)) {
    pendingPhotoFiles.value.push({
      name: file.name, size: file.size, raw: file,
      uid: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      status: 'ready' as const,
      url: URL.createObjectURL(file),
    })
  }
}

// ── Populate form on open ──────────────────────────────────────────────────

watch(
  () => props.modelValue,
  (val) => {
    if (!val) return
    if (props.training) {
      const t = props.training
      form.trainingYear = t.trainingYear
      form.trainingMonth = t.trainingMonth
      form.trainingDate = t.trainingDate || ''
      form.itemSeq = t.itemSeq
      form.categoryTag = t.categoryTag
      form.title = t.title
      form.trainer = t.trainer
      form.archiveNo = t.archiveNo || defaultArchiveNo(t.trainingYear, t.trainingMonth)
      resetPrimaryPdfState()
      existingPrimaryPdf.value = t.primaryPdf ? { ...t.primaryPdf } : null
      resetMaterialState()
      existingMaterials.value = [...(t.materials || [])]
      resetPhotoState()
      existingPhotos.value = [...(t.photos || [])]
    } else {
      const now = new Date()
      form.trainingYear = `${now.getFullYear()}`
      form.trainingMonth = `${now.getMonth() + 1}`.padStart(2, '0')
      form.trainingDate = ''
      form.itemSeq = 1
      form.categoryTag = ''
      form.title = ''
      form.trainer = ''
      form.archiveNo = defaultArchiveNo(form.trainingYear, form.trainingMonth)
      resetPrimaryPdfState()
      resetMaterialState()
      resetPhotoState()
    }
  },
)

watch(
  () => [form.trainingYear, form.trainingMonth] as const,
  (_next, prev) => {
    if (!dialogVisible.value) return
    const [prevYear, prevMonth] = prev || ['', '']
    syncArchiveNoFromYearMonth(prevYear || '', prevMonth || '')
  },
)

// ── Submit ──────────────────────────────────────────────────────────────────

async function handleSubmit() {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }

  submitting.value = true
  try {
    const payload = {
      trainingYear: form.trainingYear,
      trainingMonth: form.trainingMonth,
      trainingDate: form.trainingDate,
      itemSeq: form.itemSeq,
      categoryTag: form.categoryTag,
      title: form.title,
      trainer: form.trainer,
      archiveNo: form.archiveNo || defaultArchiveNo(form.trainingYear, form.trainingMonth),
    }

    let trainingId: string
    if (isEdit.value) {
      const result = await updateTraining(props.training!.id, payload)
      trainingId = result.id
    } else {
      const result = await createTraining(payload)
      trainingId = result.id
    }

    // Primary PDF (正文)
    const newPrimaryFile = pendingPrimaryPdfFile.value.find((f: any) => f.raw instanceof File)
    if (newPrimaryFile) {
      uploading.value = true
      const { content, mimeType } = await readFileAsBase64(newPrimaryFile.raw)
      await uploadTrainingPrimaryPdf(trainingId, {
        fileName: newPrimaryFile.name,
        content,
        mimeType,
      })
    } else if (removePrimaryPdf.value) {
      try { await deleteTrainingPrimaryPdf(trainingId) } catch { /* ok */ }
    }

    // Delete removed materials
    for (const matId of removedMaterialIds.value) {
      try { await deleteTrainingMaterial(trainingId, matId) } catch { /* ok */ }
    }

    // Upload new materials
    const newMaterialFiles = pendingMaterialFiles.value.filter((f: any) => f.raw instanceof File)
    if (newMaterialFiles.length > 0) {
      uploading.value = true
      for (const f of newMaterialFiles) {
        const { content, mimeType } = await readFileAsBase64(f.raw)
        const matType = pendingMaterialTypes.value[f.uid] || ''
        try {
          await uploadTrainingMaterial(trainingId, {
            fileName: f.name, content, mimeType,
          }, matType)
        } catch { /* individual failures not blocking */ }
      }
    }

    // Delete removed photos
    for (const photoId of removedPhotoIds.value) {
      try { await deleteTrainingPhoto(trainingId, photoId) } catch { /* ok */ }
    }

    // Upload new photos
    const newPhotoFiles = pendingPhotoFiles.value.filter((f: any) => f.raw instanceof File)
    if (newPhotoFiles.length > 0) {
      uploading.value = true
      const items = []
      for (const f of newPhotoFiles) {
        const { content, mimeType } = await readFileAsBase64(f.raw)
        items.push({ fileName: f.name, content, mimeType })
      }
      await uploadTrainingPhotos(trainingId, items)
    }

    ElMessage.success(isEdit.value ? '培训记录已更新' : '培训记录已创建')
    dialogVisible.value = false
    emit('saved')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    submitting.value = false
    uploading.value = false
  }
}

const yearOptionsForForm = computed(() => {
  const years = []
  for (let y = new Date().getFullYear(); y >= 2024; y--) {
    years.push({ label: `${y}年`, value: `${y}` })
  }
  return years
})

const monthOptionsForForm = computed(() => {
  const months = []
  for (let m = 1; m <= 12; m++) {
    months.push({ label: `${m}月`, value: `${m}`.padStart(2, '0') })
  }
  return months
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑培训记录' : '新建培训记录'"
    width="780px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px" label-position="right">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="年度" prop="trainingYear">
            <el-select v-model="form.trainingYear" placeholder="选择年度" style="width: 100%">
              <el-option v-for="opt in yearOptionsForForm" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="月份" prop="trainingMonth">
            <el-select v-model="form.trainingMonth" placeholder="选择月份" style="width: 100%">
              <el-option v-for="opt in monthOptionsForForm" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="培训日期" prop="trainingDate">
            <el-date-picker
              v-model="form.trainingDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择培训日期"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="序号" prop="itemSeq">
            <el-input-number v-model="form.itemSeq" :min="1" :max="20" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="16">
          <el-form-item label="档案编号" prop="archiveNo">
            <el-input v-model="form.archiveNo" placeholder="例：DTP-GGJSK2026-07A" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="分类标签" prop="categoryTag">
            <el-select v-model="form.categoryTag" placeholder="选择分类" style="width: 100%">
              <el-option
                v-for="tag in CATEGORY_TAGS"
                :key="tag"
                :label="tag"
                :value="tag"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="培训人" prop="trainer">
            <el-select
              v-model="form.trainer"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入培训人"
              style="width: 100%"
            >
              <el-option
                v-for="opt in personnelOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="培训主题" prop="title">
        <el-input v-model="form.title" placeholder="例：公司级制度-固定资产实物管理办法（CSPZ07003）" />
      </el-form-item>

      <!-- Primary PDF -->
      <el-form-item label="正文 PDF">
        <div class="primary-pdf-editor">
          <div v-if="existingPrimaryPdf && !removePrimaryPdf" class="file-item">
            <el-link :href="existingPrimaryPdf.url" target="_blank" type="primary" style="font-size: 13px;">
              {{ existingPrimaryPdf.fileName }}
            </el-link>
            <el-button
              type="danger" size="small" circle :icon="DeleteFilled"
              @click="handleRemoveExistingPrimaryPdf"
            />
          </div>
          <el-upload
            v-model:file-list="pendingPrimaryPdfFile"
            accept=".pdf,application/pdf"
            :limit="1"
            :auto-upload="false"
            :on-change="handlePrimaryPdfChange"
            :on-remove="handlePrimaryPdfRemove"
          >
            <el-button type="primary" plain>
              {{ existingPrimaryPdf && !removePrimaryPdf ? '上传新版本' : '选择正文 PDF' }}
            </el-button>
          </el-upload>
          <div class="upload-tip">仅支持 PDF，每条培训记录一个正文文件</div>
        </div>
      </el-form-item>

      <!-- Material files -->
      <el-form-item label="培训材料">
        <div
          class="material-upload-area"
          :class="{ 'is-dragover': materialDragOver }"
          @dragenter.prevent="handleMaterialDragEnter"
          @dragover.prevent="handleMaterialDragOver"
          @dragleave.prevent="handleMaterialDragLeave"
          @drop.capture.prevent="handleMaterialDrop"
        >
          <div v-if="existingMaterials.length > 0" class="existing-files-list">
            <div v-for="mat in existingMaterials" :key="mat.id" class="file-item">
              <el-link :href="mat.url" target="_blank" type="primary" style="font-size: 13px;">
                {{ mat.fileName }}
              </el-link>
              <el-tag size="small" type="info" style="margin-left: 8px;">
                {{ MATERIAL_TYPE_LABELS[mat.materialType] || '其他' }}
              </el-tag>
              <el-button
                type="danger" size="small" circle :icon="DeleteFilled"
                @click="handleRemoveExistingMaterial(mat)"
              />
            </div>
          </div>

          <el-upload
            v-model:file-list="pendingMaterialFiles"
            :auto-upload="false"
            multiple
            :show-file-list="true"
            :on-change="handleMaterialFileChange"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.png,.jpg,.jpeg"
            style="display: inline-block;"
          >
            <el-button type="primary">选择文件</el-button>
          </el-upload>

          <div v-if="pendingMaterialFiles.length > 0" style="margin-top: 8px;">
            <div v-for="f in pendingMaterialFiles" :key="f.uid" style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <span style="font-size: 13px;">{{ f.name }}</span>
              <el-select
                :model-value="pendingMaterialTypes[f.uid] || ''"
                size="small"
                placeholder="文件类型"
                style="width: 120px;"
                @update:model-value="(val: string) => setMaterialType(f.uid, val)"
              >
                <el-option
                  v-for="mt in MATERIAL_TYPES"
                  :key="mt.value"
                  :label="mt.label"
                  :value="mt.value"
                />
              </el-select>
            </div>
          </div>

          <div class="drag-hint">将文件拖拽到此处上传</div>
          <div class="upload-tip">支持 PDF、Word、Excel、PPT、DWG、图片格式</div>
        </div>
      </el-form-item>

      <!-- Photos -->
      <el-form-item label="培训照片">
        <div
          class="photo-upload-area"
          :class="{ 'is-dragover': photoDragOver, 'is-disabled': photoUploadLimit <= 0 }"
          @dragenter.prevent="handlePhotoDragEnter"
          @dragover.prevent="handlePhotoDragOver"
          @dragleave.prevent="handlePhotoDragLeave"
          @drop.capture.prevent="handlePhotoDrop"
        >
          <div v-if="existingPhotos.length > 0" class="photo-preview-list">
            <div v-for="p in existingPhotos" :key="p.id" class="photo-preview-item">
              <el-image
                :src="p.url"
                :preview-src-list="existingPhotos.map((i) => i.url)"
                fit="cover"
                style="width: 100px; height: 100px; border-radius: 4px;"
              />
              <el-button
                class="photo-remove-btn"
                type="danger" size="small" circle :icon="DeleteFilled"
                @click="handleRemoveExistingPhoto(p)"
              />
            </div>
          </div>

          <el-upload
            v-model:file-list="pendingPhotoFiles"
            list-type="picture-card"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            :auto-upload="false"
            multiple
            :limit="photoUploadLimit"
            :on-change="handlePhotoFileChange"
            :on-exceed="handlePhotoExceed"
          >
            <el-icon v-if="photoUploadLimit > 0"><Plus /></el-icon>
          </el-upload>

          <div v-if="photoUploadLimit > 0" class="drag-hint">将图片拖拽到此处上传</div>
          <div class="upload-tip">支持 PNG、JPG、GIF、WebP 格式，最多 {{ MAX_PHOTOS }} 张</div>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting || uploading" @click="handleSubmit">
        {{ isEdit ? '保存修改' : '创建记录' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.upload-tip { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 6px; }
.drag-hint { margin-top: 4px; font-size: 12px; color: var(--el-text-color-secondary); text-align: center; }

.material-upload-area, .photo-upload-area {
  width: 100%;
  padding: 8px;
  border: 1px dashed transparent;
  border-radius: 6px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.material-upload-area.is-dragover, .photo-upload-area.is-dragover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.photo-upload-area.is-disabled { padding-bottom: 0; }

.existing-files-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.photo-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.photo-preview-item { position: relative; width: 100px; height: 100px; }

.photo-remove-btn { position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; font-size: 10px; }

.photo-preview-item :deep(.el-image) {
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
}

.primary-pdf-editor {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
