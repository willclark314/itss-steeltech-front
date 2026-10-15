<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { DeleteFilled } from '@element-plus/icons-vue'
import {
  createMeeting,
  updateMeeting,
  uploadMeetingImages,
  deleteMeetingImage,
  uploadMeetingScan,
  deleteMeetingScan,
  readFileAsBase64,
  type WeeklyMeetingRecord,
  type WeeklyMeetingImage,
  type WeeklyMeetingScan,
} from '@/api/weeklyMeeting'

const props = defineProps<{
  modelValue: boolean
  meeting: WeeklyMeetingRecord | null
  personnelOptions: { label: string; value: string }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const DEFAULT_ATTENDEES = ['陈姜宏', '杨茂林', '李琰鑫', '王少鑫']
const DEFAULT_CONTENT_ITEMS = [
  '当月原设计+细化任务完成情况跟踪及特殊项目进度',
  '各项目待解决问题的提出与处理方案的商定',
  '当下所有项目数量与人员分配是否饱和及调整',
  '当月科室原年度培训计划及时开展，提前搜集培训资料',
  '工伤避险，安全制度宣讲',
]
const MAX_MEETING_IMAGES = 2

const formRef = ref<FormInstance>()
const submitting = ref(false)
const uploading = ref(false)

const DEFAULT_MEETING_THEME = '钢结构技术科周例会'

const form = reactive({
  meetingDate: '',
  meetingTheme: DEFAULT_MEETING_THEME,
  location: 'CSP卓越维保办公楼培训室',
  host: '陈魏',
  recorder: '陈魏',
  attendees: DEFAULT_ATTENDEES.join(', '),
  contentItems: [...DEFAULT_CONTENT_ITEMS],
})

const attendeeArray = ref<string[]>([...DEFAULT_ATTENDEES])
const uploadFileList = ref<any[]>([])
const existingImages = ref<WeeklyMeetingImage[]>([])
const removedImageIds = ref<string[]>([])
const existingScan = ref<WeeklyMeetingScan | null>(null)
const scanFileList = ref<any[]>([])
const scanRemoved = ref(false)

const dialogTitle = computed(() => (props.meeting ? '编辑周例会' : '新建周例会'))

const imageUploadLimit = computed(() =>
  Math.max(0, MAX_MEETING_IMAGES - existingImages.value.length),
)

const imageDragOver = ref(false)
let imageDragCounter = 0

const scanDragOver = ref(false)
let scanDragCounter = 0

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
])

const formRules: FormRules = {
  meetingDate: [{ required: true, message: '请选择会议日期', trigger: 'change' }],
  meetingTheme: [{ required: true, message: '请输入会议主题', trigger: 'blur' }],
  location: [{ required: true, message: '请输入会议地点', trigger: 'blur' }],
  host: [{ required: true, message: '请选择主持人', trigger: 'change' }],
  recorder: [{ required: true, message: '请选择记录人', trigger: 'change' }],
  attendees: [{
    required: true,
    validator: (_rule, _value, callback) => {
      if (attendeeArray.value.length === 0) {
        callback(new Error('请选择出席人员'))
      } else {
        callback()
      }
    },
    trigger: 'change',
  }],
}

function resetImageState() {
  uploadFileList.value = []
  existingImages.value = []
  removedImageIds.value = []
  imageDragOver.value = false
  imageDragCounter = 0
}

function resetScanState() {
  existingScan.value = null
  scanFileList.value = []
  scanRemoved.value = false
  scanDragOver.value = false
  scanDragCounter = 0
}

function resetFormForCreate() {
  form.meetingDate = ''
  form.meetingTheme = DEFAULT_MEETING_THEME
  form.location = 'CSP卓越维保办公楼培训室'
  form.host = '陈魏'
  form.recorder = '陈魏'
  form.attendees = DEFAULT_ATTENDEES.join(', ')
  form.contentItems = [...DEFAULT_CONTENT_ITEMS]
  attendeeArray.value = [...DEFAULT_ATTENDEES]
  resetImageState()
  resetScanState()
}

function resetFormForEdit(meeting: WeeklyMeetingRecord) {
  form.meetingDate = meeting.meetingDate
  form.meetingTheme = meeting.meetingTheme
  form.location = meeting.location
  form.host = meeting.host
  form.recorder = meeting.recorder
  form.attendees = meeting.attendees
  attendeeArray.value = meeting.attendees
    ? meeting.attendees.split(',').map((item) => item.trim()).filter(Boolean)
    : []
  form.contentItems = meeting.contentItems.length === 5
    ? [...meeting.contentItems]
    : [...meeting.contentItems, ...Array(5 - meeting.contentItems.length).fill('')].slice(0, 5)
  resetImageState()
  existingImages.value = [...meeting.images]
  uploadFileList.value = []
  resetScanState()
  existingScan.value = meeting.recordScan ? { ...meeting.recordScan } : null
}

watch(
  () => [props.modelValue, props.meeting] as const,
  ([visible, meeting]) => {
    if (!visible) return
    if (meeting) {
      resetFormForEdit(meeting)
    } else {
      resetFormForCreate()
    }
  },
)

function closeDialog() {
  emit('update:modelValue', false)
}

function handleRemoveExistingImage(image: WeeklyMeetingImage) {
  removedImageIds.value.push(image.id)
  existingImages.value = existingImages.value.filter((img) => img.id !== image.id)
}

function handleImageExceed() {
  ElMessage.warning(`每条会议记录最多上传 ${MAX_MEETING_IMAGES} 张图片`)
}

function isAcceptedImage(file: File) {
  const type = file.type || guessImageMimeType(file.name)
  return ACCEPTED_IMAGE_TYPES.has(type)
    || /^image\//.test(type)
    || /\.(png|jpe?g|gif|webp)$/i.test(file.name)
}

function guessImageMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().match(/\.(\w+)$/)?.[1]
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    default:
      return 'image/png'
  }
}

function normalizeImageFile(file: File): File | null {
  if (!file.size) return null

  let type = file.type
  if (!type || type === 'application/octet-stream') {
    type = guessImageMimeType(file.name)
  }
  if (!/^image\//.test(type) && !/\.(png|jpe?g|gif|webp)$/i.test(file.name)) {
    return null
  }
  if (!/^image\//.test(type)) {
    type = guessImageMimeType(file.name)
  }

  const name = file.name && file.name.includes('.')
    ? file.name
    : `image.${type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'}`

  if (file.type === type && file.name === name) {
    return file
  }
  return new File([file], name, { type, lastModified: file.lastModified })
}

async function fileFromDataUri(uri: string, index: number): Promise<File | null> {
  try {
    const response = await fetch(uri)
    const blob = await response.blob()
    if (!blob.size) return null
    const type = blob.type && blob.type.startsWith('image/')
      ? blob.type
      : guessImageMimeType(`image.${index}.png`)
    const ext = type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
    return normalizeImageFile(new File([blob], `wechat-image-${index}.${ext}`, { type }))
  } catch {
    return null
  }
}

async function fileFromImageSrc(src: string, index: number): Promise<File | null> {
  if (!src) return null
  if (src.startsWith('data:image/')) {
    return fileFromDataUri(src, index)
  }
  if (src.startsWith('blob:')) {
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      if (!blob.size) return null
      return normalizeImageFile(new File([blob], `wechat-image-${index}.png`, {
        type: blob.type || 'image/png',
      }))
    } catch {
      return null
    }
  }
  return null
}

async function extractFilesFromHtml(html: string): Promise<File[]> {
  const files: File[] = []
  const seen = new Set<string>()

  const addFile = (file: File | null) => {
    if (!file) return
    const key = `${file.size}:${file.type}`
    if (seen.has(key)) return
    seen.add(key)
    files.push(file)
  }

  const dataUriMatches = html.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[a-zA-Z0-9+/=]+/g) || []
  for (const [index, uri] of dataUriMatches.entries()) {
    addFile(await fileFromDataUri(uri, index))
  }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const images = doc.querySelectorAll('img')
    for (const [index, img] of Array.from(images).entries()) {
      addFile(await fileFromImageSrc(img.getAttribute('src') || '', index))
    }
  } catch {
    // ignore malformed html
  }

  return files
}

async function extractImageFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = []
  const seen = new Set<string>()

  const addFile = (file: File | null | undefined) => {
    const normalized = file ? normalizeImageFile(file) : null
    if (!normalized || !isAcceptedImage(normalized)) return
    const key = `${normalized.name}:${normalized.size}:${normalized.lastModified}`
    if (seen.has(key)) return
    seen.add(key)
    files.push(normalized)
  }

  const htmlTasks: Promise<void>[] = []

  if (dataTransfer.items?.length) {
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind === 'file') {
        addFile(item.getAsFile())
        continue
      }
      if (item.kind === 'string' && item.type === 'text/html') {
        htmlTasks.push(new Promise((resolve) => {
          item.getAsString(async (html) => {
            for (const file of await extractFilesFromHtml(html)) {
              addFile(file)
            }
            resolve()
          })
        }))
      }
    }
  }

  await Promise.all(htmlTasks)

  for (const file of Array.from(dataTransfer.files || [])) {
    addFile(file)
  }

  return files
}

function hasDraggedImageData(dataTransfer: DataTransfer) {
  const types = Array.from(dataTransfer.types || [])
  return types.includes('Files')
    || types.includes('text/html')
    || types.includes('text/uri-list')
}

function getRemainingImageSlots() {
  return Math.max(0, imageUploadLimit.value - uploadFileList.value.length)
}

function createUploadFileItem(file: File) {
  return {
    name: file.name,
    size: file.size,
    raw: file,
    uid: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    status: 'ready' as const,
    url: URL.createObjectURL(file),
  }
}

async function handleImageFileChange(_uploadFile: unknown, uploadFiles: any[]) {
  const normalizedList = []
  for (const item of uploadFiles) {
    if (!(item.raw instanceof File)) {
      normalizedList.push(item)
      continue
    }
    const normalized = normalizeImageFile(item.raw)
    if (!normalized) continue
    if (item.url?.startsWith('blob:')) {
      URL.revokeObjectURL(item.url)
    }
    normalizedList.push({
      ...item,
      name: normalized.name,
      size: normalized.size,
      raw: normalized,
      url: URL.createObjectURL(normalized),
    })
  }
  uploadFileList.value = normalizedList
}

function appendImageFiles(files: File[]) {
  const remaining = getRemainingImageSlots()
  if (remaining <= 0) {
    handleImageExceed()
    return
  }

  const accepted = files.filter(isAcceptedImage)
  if (accepted.length === 0) {
    ElMessage.warning('仅支持 PNG、JPG、GIF、WebP 格式图片')
    return
  }

  const toAdd = accepted.slice(0, remaining)
  if (accepted.length > remaining) {
    handleImageExceed()
  }

  uploadFileList.value = [
    ...uploadFileList.value,
    ...toAdd.map(createUploadFileItem),
  ]
}

function handleImageDragEnter(event: DragEvent) {
  if (imageUploadLimit.value <= 0) return
  if (!event.dataTransfer || !hasDraggedImageData(event.dataTransfer)) return
  imageDragCounter += 1
  imageDragOver.value = true
}

function handleImageDragOver(event: DragEvent) {
  if (imageUploadLimit.value <= 0) return
  if (!event.dataTransfer || !hasDraggedImageData(event.dataTransfer)) return
  event.dataTransfer.dropEffect = 'copy'
  imageDragOver.value = true
}

function handleImageDragLeave() {
  imageDragCounter = Math.max(0, imageDragCounter - 1)
  if (imageDragCounter === 0) {
    imageDragOver.value = false
  }
}

async function handleImageDrop(event: DragEvent) {
  event.stopPropagation()
  imageDragCounter = 0
  imageDragOver.value = false
  if (imageUploadLimit.value <= 0) return

  const dataTransfer = event.dataTransfer
  if (!dataTransfer) return

  const files = await extractImageFilesFromDataTransfer(dataTransfer)
  if (files.length === 0) {
    ElMessage.warning('未能识别拖拽的图片，请尝试将微信图片另存到本地后再上传')
    return
  }
  appendImageFiles(files)
}

function handleScanChange(_file: any, fileList: any[]) {
  scanFileList.value = fileList.slice(-1)
}

function handleScanExceed() {
  ElMessage.warning('每条会议记录仅可上传一份 PDF 扫描件')
}

function handleRemoveScan() {
  scanRemoved.value = true
  scanFileList.value = []
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

function hasDraggedFileData(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types || []).includes('Files')
}

function createScanUploadFileItem(file: File) {
  return {
    name: file.name,
    size: file.size,
    raw: file,
    uid: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    status: 'ready' as const,
  }
}

function appendScanFile(file: File) {
  if (!isPdfFile(file)) {
    ElMessage.warning('会议记录扫描件仅支持 PDF 格式')
    return
  }
  scanFileList.value = [createScanUploadFileItem(file)]
}

function handleScanDragEnter(event: DragEvent) {
  if (!event.dataTransfer || !hasDraggedFileData(event.dataTransfer)) return
  scanDragCounter += 1
  scanDragOver.value = true
}

function handleScanDragOver(event: DragEvent) {
  if (!event.dataTransfer || !hasDraggedFileData(event.dataTransfer)) return
  event.dataTransfer.dropEffect = 'copy'
  scanDragOver.value = true
}

function handleScanDragLeave() {
  scanDragCounter = Math.max(0, scanDragCounter - 1)
  if (scanDragCounter === 0) {
    scanDragOver.value = false
  }
}

function handleScanDrop(event: DragEvent) {
  event.stopPropagation()
  scanDragCounter = 0
  scanDragOver.value = false

  const files = Array.from(event.dataTransfer?.files || [])
  const pdfFile = files.find(isPdfFile)
  if (!pdfFile) {
    ElMessage.warning('会议记录扫描件仅支持 PDF 格式')
    return
  }
  appendScanFile(pdfFile)
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    const payload = {
      meetingDate: form.meetingDate,
      meetingTheme: form.meetingTheme,
      location: form.location,
      host: form.host,
      recorder: form.recorder,
      attendees: attendeeArray.value.join(', '),
      contentItems: form.contentItems.filter((item) => item.trim()),
    }

    let meetingId: string

    if (props.meeting) {
      const result = await updateMeeting(props.meeting.id, payload)
      meetingId = result.id
    } else {
      const result = await createMeeting(payload)
      meetingId = result.id
    }

    for (const imgId of removedImageIds.value) {
      try {
        await deleteMeetingImage(meetingId, imgId)
      } catch { /* ignore individual failures */ }
    }

    const newFiles = uploadFileList.value.filter((f) => f.raw instanceof File)
    if (existingImages.value.length + newFiles.length > MAX_MEETING_IMAGES) {
      ElMessage.error(`每条会议记录最多上传 ${MAX_MEETING_IMAGES} 张图片`)
      return
    }
    if (newFiles.length > 0) {
      uploading.value = true
      const uploadItems = []
      for (const f of newFiles) {
        const { content, mimeType } = await readFileAsBase64(f.raw)
        uploadItems.push({
          fileName: f.name,
          content,
          mimeType,
        })
      }
      await uploadMeetingImages(meetingId, uploadItems)
      uploading.value = false
    }

    if (scanRemoved.value && existingScan.value) {
      try {
        await deleteMeetingScan(meetingId)
      } catch { /* ignore individual failures */ }
    }

    const pendingScan = scanFileList.value.find((f) => f.raw instanceof File)
    if (pendingScan) {
      uploading.value = true
      const { content, mimeType } = await readFileAsBase64(pendingScan.raw)
      await uploadMeetingScan(meetingId, {
        fileName: pendingScan.name,
        content,
        mimeType,
      })
      uploading.value = false
    }

    ElMessage.success(props.meeting ? '会议已更新' : '会议已创建')
    closeDialog()
    emit('saved')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    submitting.value = false
    uploading.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="720px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="formRules"
      label-width="90px"
      label-position="right"
    >
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="会议日期" prop="meetingDate">
            <el-date-picker
              v-model="form.meetingDate"
              type="date"
              placeholder="选择日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="会议主题" prop="meetingTheme">
            <el-input v-model="form.meetingTheme" placeholder="例：钢结构技术科周例会" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="会议地点" prop="location">
            <el-input v-model="form.location" placeholder="会议地点" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="主持人" prop="host">
            <el-select
              v-model="form.host"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入主持人"
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

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="记录人" prop="recorder">
            <el-select
              v-model="form.recorder"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入记录人"
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
        <el-col :span="12">
          <el-form-item label="出席人员" prop="attendees">
            <el-select
              v-model="attendeeArray"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入出席人员"
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

      <el-form-item
        v-for="(_item, index) in form.contentItems"
        :key="index"
        :label="`议题 ${index + 1}`"
      >
        <el-input
          v-model="form.contentItems[index]"
          type="textarea"
          :rows="2"
          :placeholder="`请输入第 ${index + 1} 条会议议题`"
        />
      </el-form-item>

      <el-form-item label="图片附件">
        <div
          class="meeting-image-upload"
          :class="{
            'is-dragover': imageDragOver,
            'is-disabled': imageUploadLimit <= 0,
          }"
          @dragenter.prevent="handleImageDragEnter"
          @dragover.prevent="handleImageDragOver"
          @dragleave.prevent="handleImageDragLeave"
          @drop.capture.prevent="handleImageDrop"
        >
          <div v-if="existingImages.length > 0" class="image-preview-list">
            <div
              v-for="img in existingImages"
              :key="img.id"
              class="image-preview-item"
            >
              <el-image
                :src="img.url"
                :preview-src-list="existingImages.map((item) => item.url)"
                fit="cover"
                style="width: 100px; height: 100px; border-radius: 4px;"
              />
              <el-button
                class="image-remove-btn"
                type="danger"
                size="small"
                circle
                :icon="DeleteFilled"
                @click="handleRemoveExistingImage(img)"
              />
            </div>
          </div>

          <el-upload
            v-model:file-list="uploadFileList"
            list-type="picture-card"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            :auto-upload="false"
            multiple
            :limit="imageUploadLimit"
            :on-change="handleImageFileChange"
            :on-exceed="handleImageExceed"
            class="meeting-image-upload__picker"
          >
            <el-icon v-if="imageUploadLimit > 0"><Plus /></el-icon>
          </el-upload>

          <div v-if="imageUploadLimit > 0" class="image-drag-hint">
            将图片拖拽到此处上传，或点击上方卡片选择文件
          </div>

          <div class="upload-tip">
            每条会议记录最多上传 {{ MAX_MEETING_IMAGES }} 张图片，支持 PNG、JPG、GIF、WebP 格式，单文件不超过 10MB
          </div>
        </div>
      </el-form-item>

      <el-form-item label="会议记录扫描件">
        <div
          class="meeting-scan-upload"
          :class="{ 'is-dragover': scanDragOver }"
          @dragenter.prevent="handleScanDragEnter"
          @dragover.prevent="handleScanDragOver"
          @dragleave.prevent="handleScanDragLeave"
          @drop.capture.prevent="handleScanDrop"
        >
          <div
            v-if="existingScan && !scanRemoved && !scanFileList.length"
            class="scan-file-row"
          >
            <el-link :href="existingScan.url" target="_blank" type="primary">
              {{ existingScan.fileName }}
            </el-link>
            <el-button link type="danger" @click="handleRemoveScan">删除</el-button>
          </div>

          <el-upload
            v-model:file-list="scanFileList"
            accept=".pdf,application/pdf"
            :auto-upload="false"
            :limit="1"
            :show-file-list="true"
            :on-change="handleScanChange"
            :on-exceed="handleScanExceed"
          >
            <el-button type="primary">
              {{ existingScan && !scanRemoved ? '重新上传 PDF' : '选择 PDF 文件' }}
            </el-button>
          </el-upload>

          <div class="scan-drag-hint">
            将 PDF 拖拽到此处上传，或点击上方按钮选择文件
          </div>

          <div class="upload-tip">
            上传会议记录的 PDF 扫描件，每条会议记录仅保留一份
          </div>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="submitting || uploading" @click="handleSubmit">
        {{ meeting ? '保存修改' : '创建会议' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.upload-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 6px;
}

.meeting-image-upload {
  width: 100%;
  padding: 8px;
  border: 1px dashed transparent;
  border-radius: 6px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.meeting-image-upload.is-dragover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.meeting-image-upload.is-disabled {
  padding-bottom: 0;
}

.image-drag-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.meeting-image-upload__picker :deep(.el-upload--picture-card) {
  --el-upload-picture-card-size: 100px;
}

.image-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.image-preview-item {
  position: relative;
  width: 100px;
  height: 100px;
}

.image-remove-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  font-size: 10px;
}

.image-preview-item :deep(.el-image) {
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
}

.scan-file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.meeting-scan-upload {
  width: 100%;
  padding: 8px;
  border: 1px dashed transparent;
  border-radius: 6px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.meeting-scan-upload.is-dragover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.scan-drag-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
