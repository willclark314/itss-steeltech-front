<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { DeleteFilled } from '@element-plus/icons-vue'
import { getUser } from '@/utils/auth'
import {
  createInterview,
  updateInterview,
  uploadInterviewImages,
  deleteInterviewImage,
  readFileAsBase64,
  type DirectorInterviewRecord,
  type DirectorInterviewImage,
} from '@/api/directorInterview'
import type { PersonnelRecord } from '@/models/personnel'

const MAX_IMAGES = 2

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
])

const props = defineProps<{
  modelValue: boolean
  interview: DirectorInterviewRecord | null
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

const isEdit = computed(() => !!props.interview)

const formRef = ref<FormInstance>()
const submitting = ref(false)
const uploading = ref(false)

const form = reactive({
  employeeName: '',
  employeeId: '',
  division: '',
  position: '',
  interviewDate: '',
  interviewTopic: '',
  interviewContent: ['', '', ''],
  conclusion: ['', '', ''],
  interviewer: '',
  interviewee: '',
})

const formRules: FormRules = {
  interviewee: [{ required: true, message: '请选择被约谈人', trigger: 'change' }],
  interviewDate: [{ required: true, message: '请选择约谈日期', trigger: 'change' }],
  interviewTopic: [{ required: true, message: '请输入约谈主题', trigger: 'blur' }],
}

const uploadFileList = ref<any[]>([])
const existingImages = ref<DirectorInterviewImage[]>([])
const removedImageIds = ref<string[]>([])

// ── 微信拖拽/粘贴图片 ──────────────────────────────────────────────────────

const imageDragOver = ref(false)
let imageDragCounter = 0

const imageUploadLimit = computed(() =>
  Math.max(0, MAX_IMAGES - existingImages.value.length),
)

function guessImageMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().match(/\.(\w+)$/)?.[1]
  switch (ext) {
    case 'jpg': case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    default: return 'image/png'
  }
}

function isAcceptedImage(file: File) {
  const type = file.type || guessImageMimeType(file.name)
  return ACCEPTED_IMAGE_TYPES.has(type)
    || /^image\//.test(type)
    || /\.(png|jpe?g|gif|webp)$/i.test(file.name)
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
  if (file.type === type && file.name === name) return file
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
  } catch { return null }
}

async function fileFromImageSrc(src: string, index: number): Promise<File | null> {
  if (!src) return null
  if (src.startsWith('data:image/')) return fileFromDataUri(src, index)
  if (src.startsWith('blob:')) {
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      if (!blob.size) return null
      return normalizeImageFile(new File([blob], `wechat-image-${index}.png`, {
        type: blob.type || 'image/png',
      }))
    } catch { return null }
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
  } catch { /* ignore */ }
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
      if (item.kind === 'file') { addFile(item.getAsFile()); continue }
      if (item.kind === 'string' && item.type === 'text/html') {
        htmlTasks.push(new Promise((resolve) => {
          item.getAsString(async (html) => {
            for (const file of await extractFilesFromHtml(html)) addFile(file)
            resolve()
          })
        }))
      }
    }
  }
  await Promise.all(htmlTasks)
  for (const file of Array.from(dataTransfer.files || [])) addFile(file)
  return files
}

function hasDraggedImageData(dataTransfer: DataTransfer) {
  const types = Array.from(dataTransfer.types || [])
  return types.includes('Files') || types.includes('text/html') || types.includes('text/uri-list')
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

function appendImageFiles(files: File[]) {
  const remaining = getRemainingImageSlots()
  if (remaining <= 0) { handleImageExceed(); return }
  const accepted = files.filter(isAcceptedImage)
  if (accepted.length === 0) {
    ElMessage.warning('仅支持 PNG、JPG、GIF、WebP 格式图片')
    return
  }
  const toAdd = accepted.slice(0, remaining)
  if (accepted.length > remaining) handleImageExceed()
  uploadFileList.value = [...uploadFileList.value, ...toAdd.map(createUploadFileItem)]
}

function handleImageFileChange(_uploadFile: unknown, uploadFiles: any[]) {
  const normalizedList = []
  for (const item of uploadFiles) {
    if (!(item.raw instanceof File)) { normalizedList.push(item); continue }
    const normalized = normalizeImageFile(item.raw)
    if (!normalized) continue
    if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url)
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

function handleImageExceed() {
  ElMessage.warning(`每条约谈记录最多上传 ${MAX_IMAGES} 张图片`)
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
  if (imageDragCounter === 0) imageDragOver.value = false
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

// ── 人员查找 ──────────────────────────────────────────────────────────────

function findPerson(name: string): PersonnelRecord | undefined {
  if (!name) return undefined
  const upper = name.toUpperCase()
  return (
    props.personnelList.find((p) => p.name.toUpperCase() === upper) ||
    props.personnelList.find((p) => p.name.toUpperCase().includes(upper))
  )
}

function onIntervieweeChange(name: string) {
  const person = findPerson(name)
  if (person) {
    form.employeeId = person.employeeNo
    form.position = person.position || form.position
  }
}

// ── 弹窗生命周期 ──────────────────────────────────────────────────────────

function resetImageState() {
  uploadFileList.value = []
  existingImages.value = []
  removedImageIds.value = []
  imageDragOver.value = false
  imageDragCounter = 0
}

watch(
  () => props.modelValue,
  (val) => {
    if (!val) return
    if (props.interview) {
      const iv = props.interview
      form.employeeName = iv.employeeName
      form.employeeId = iv.employeeId
      form.division = iv.division
      form.position = iv.position
      form.interviewDate = iv.interviewDate
      form.interviewTopic = iv.interviewTopic
      form.interviewContent = iv.interviewContent.length
        ? [...iv.interviewContent]
        : ['', '', '']
      form.conclusion = iv.conclusion.length ? [...iv.conclusion] : ['', '', '']
      form.interviewer = iv.interviewer
      form.interviewee = iv.interviewee || iv.employeeName
      resetImageState()
      existingImages.value = [...iv.images]
    } else {
      const user = getUser()
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      const defaultEmployee = findPerson('DILA')
      form.employeeName = defaultEmployee?.name || 'FADILA'
      form.employeeId = defaultEmployee?.employeeNo || ''
      form.division = user?.profile?.workshop || ''
      form.position = defaultEmployee?.position || ''
      form.interviewDate = `${yyyy}-${mm}-${dd}`
      form.interviewTopic = '工作近况'
      form.interviewContent = ['工作近况', '', '']
      form.conclusion = ['', '', '']
      form.interviewer = '陈魏'
      form.interviewee = defaultEmployee?.name || 'FADILA'
      resetImageState()
    }
  },
)

function handleRemoveExistingImage(image: DirectorInterviewImage) {
  removedImageIds.value.push(image.id)
  existingImages.value = existingImages.value.filter((img) => img.id !== image.id)
}

async function handleSubmit() {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    const payload = {
      employeeName: form.interviewee,
      employeeId: form.employeeId,
      division: form.division,
      position: form.position,
      interviewDate: form.interviewDate,
      interviewTopic: form.interviewTopic,
      interviewContent: form.interviewContent.filter((s) => s.trim()),
      conclusion: form.conclusion.filter((s) => s.trim()),
      interviewer: form.interviewer,
      interviewee: form.interviewee,
    }

    let interviewId: string
    if (isEdit.value) {
      const result = await updateInterview(props.interview!.id, payload)
      interviewId = result.id
    } else {
      const result = await createInterview(payload)
      interviewId = result.id
    }

    for (const imgId of removedImageIds.value) {
      try { await deleteInterviewImage(interviewId, imgId) } catch { /* ok */ }
    }

    const newFiles = uploadFileList.value.filter((f) => f.raw instanceof File)
    if (existingImages.value.length + newFiles.length > MAX_IMAGES) {
      ElMessage.error(`每条约谈记录最多上传 ${MAX_IMAGES} 张图片`)
      return
    }
    if (newFiles.length > 0) {
      uploading.value = true
      const items = []
      for (const f of newFiles) {
        const { content, mimeType } = await readFileAsBase64(f.raw)
        items.push({ fileName: f.name, content, mimeType })
      }
      await uploadInterviewImages(interviewId, items)
    }

    ElMessage.success(isEdit.value ? '约谈记录已更新' : '约谈记录已创建')
    dialogVisible.value = false
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
    v-model="dialogVisible"
    :title="isEdit ? '编辑主任座谈会' : '新建主任座谈会'"
    width="720px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
      <!-- 被约谈人 + 工号 -->
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="被约谈人" prop="interviewee">
            <el-select
              v-model="form.interviewee"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入姓名"
              style="width: 100%"
              @change="onIntervieweeChange"
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
          <el-form-item label="工号">
            <el-input v-model="form.employeeId" placeholder="NO ID / 工号" />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 所属部门 & 岗位 -->
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="所属部门">
            <el-input v-model="form.division" placeholder="DIVISI / 车间" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="岗位">
            <el-input v-model="form.position" placeholder="JABATAN / 岗位" />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 约谈时间 & 约谈主题 -->
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="约谈时间" prop="interviewDate">
            <el-date-picker
              v-model="form.interviewDate"
              type="date"
              placeholder="选择日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="约谈主题" prop="interviewTopic">
            <el-input v-model="form.interviewTopic" placeholder="TOPIK WAWANCARA" />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 约谈人 -->
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="约谈人">
            <el-select
              v-model="form.interviewer"
              filterable
              allow-create
              default-first-option
              placeholder="TTD PEWAWANCARA"
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

      <!-- 约谈内容（3条） -->
      <el-form-item
        v-for="(_, index) in form.interviewContent"
        :key="'content-' + index"
        :label="`约谈内容 ${index + 1}`"
      >
        <el-input
          v-model="form.interviewContent[index]"
          type="textarea"
          :rows="2"
          :placeholder="`KONTEN WAWANCARA ${index + 1}`"
        />
      </el-form-item>

      <!-- 约谈总结（3条） -->
      <el-form-item
        v-for="(_, index) in form.conclusion"
        :key="'conclusion-' + index"
        :label="`约谈总结 ${index + 1}`"
      >
        <el-input
          v-model="form.conclusion[index]"
          type="textarea"
          :rows="2"
          :placeholder="`Kesimpulan wawancara ${index + 1}`"
        />
      </el-form-item>

      <!-- 图片附件（支持微信拖拽/粘贴） -->
      <el-form-item label="图片附件">
        <div
          class="interview-image-upload"
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
            <div v-for="img in existingImages" :key="img.id" class="image-preview-item">
              <el-image
                :src="img.url"
                :preview-src-list="existingImages.map((i) => i.url)"
                fit="cover"
                style="width: 100px; height: 100px; border-radius: 4px"
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
            class="interview-image-upload__picker"
          >
            <el-icon v-if="imageUploadLimit > 0"><Plus /></el-icon>
          </el-upload>

          <div v-if="imageUploadLimit > 0" class="image-drag-hint">
            将图片拖拽到此处上传，或点击上方卡片选择文件
          </div>
          <div class="upload-tip">
            支持 PNG、JPG、GIF、WebP 格式，最多 {{ MAX_IMAGES }} 张
          </div>
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
.upload-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 6px;
}

.interview-image-upload {
  width: 100%;
  padding: 8px;
  border: 1px dashed transparent;
  border-radius: 6px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.interview-image-upload.is-dragover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.interview-image-upload.is-disabled {
  padding-bottom: 0;
}

.image-drag-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.interview-image-upload__picker :deep(.el-upload--picture-card) {
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
</style>
