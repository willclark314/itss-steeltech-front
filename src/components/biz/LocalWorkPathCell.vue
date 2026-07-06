<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { Folder, FolderOpened, FolderRemove } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { updateProject } from '@/api/projects'
import {
  checkPathExists,
  fetchSystemConfig,
  searchProjectPath,
  type ProjectPathMatch,
} from '@/api/system'
import { BusinessSystemConfig, type LocalWorkPathConfig } from '@/models/biz'
import { ProjectForm } from '@/models/biz/project'
import { ProjectWorkPath } from '@/models/biz/ProjectWorkPath'
import type { ProjectRecord } from '@/models/biz/project'
import { copyTextToClipboard } from '@/utils/clipboard'

const props = withDefaults(
  defineProps<{
    project: ProjectRecord
    readonly?: boolean
  }>(),
  { readonly: false },
)

const emit = defineEmits<{
  pathUpdated: [projectNo: string, localWorkPath: string, designWorkPath: string, detailWorkPath: string]
}>()

const existsOnDisk = ref<boolean | null>(null)
const checking = ref(false)
const savingPath = ref(false)
const suggesting = ref(false)
const setPathDialogVisible = ref(false)
const setPathInput = ref('')
const workPathConfig = ref<LocalWorkPathConfig | null>(null)
const promptedMismatchKey = ref('')

const localWorkPath = computed(() => props.project.localWorkPath)
const hasPath = computed(() => ProjectForm.hasLocalWorkPath(localWorkPath.value))

const resolvedWorkPathConfig = computed(
  () => workPathConfig.value ?? BusinessSystemConfig.LOCAL_WORK_PATH,
)

const previewRelativePath = computed(() => {
  if (hasPath.value) return ''
  const nature = ProjectWorkPath.resolveNatureTemplate(props.project.natures)
  if (!nature) return ''
  return (
    ProjectWorkPath.buildRelativePath(
      props.project,
      resolvedWorkPathConfig.value.pathPatterns,
      nature,
    ) ?? ''
  )
})

const displayRelativePath = computed(() =>
  hasPath.value
    ? ProjectForm.normalizeLocalWorkPath(localWorkPath.value)
    : previewRelativePath.value,
)

const displayFullPath = computed(() => {
  if (!displayRelativePath.value) return ''
  return ProjectForm.buildLocalWorkPathFull(
    displayRelativePath.value,
    resolvedWorkPathConfig.value,
  )
})

const statusText = computed(() => {
  if (!hasPath.value) {
    if (!displayFullPath.value) {
      return ProjectWorkPath.resolveNatureTemplate(props.project.natures)
        ? '本地路径未设置'
        : '本地路径未设置（请先设置项目性质）'
    }
    return '本地路径未设置'
  }
  if (checking.value || existsOnDisk.value === null) return '正在检查本地路径...'
  if (!existsOnDisk.value) return '本地路径不存在'
  if (!ProjectWorkPath.pathMatchesProject(localWorkPath.value, props.project.projectNo)) {
    return '本地路径与项目号不匹配'
  }
  return '本地路径已存在'
})

const setPathPreview = computed(() => {
  const relativePath = ProjectForm.normalizeLocalWorkPath(setPathInput.value)
  if (!relativePath) return ''
  return ProjectForm.buildLocalWorkPathFull(relativePath, resolvedWorkPathConfig.value)
})

const pathConfigHint = computed(() => {
  const config = resolvedWorkPathConfig.value
  return `全局配置：${config.ip} · ${config.drive} 盘`
})

const iconClass = computed(() => ({
  'path-cell-btn': true,
  'is-empty': !hasPath.value,
  'is-ready':
    hasPath.value &&
    existsOnDisk.value === true &&
    ProjectWorkPath.pathMatchesProject(localWorkPath.value, props.project.projectNo),
  'is-missing':
    hasPath.value &&
    (existsOnDisk.value === false ||
      (existsOnDisk.value === true &&
        !ProjectWorkPath.pathMatchesProject(localWorkPath.value, props.project.projectNo))),
  'is-checking': checking.value || savingPath.value || suggesting.value,
}))

const iconComponent = computed(() => {
  if (!hasPath.value) return FolderRemove
  if (existsOnDisk.value === true) return FolderOpened
  return Folder
})

async function ensureWorkPathConfig() {
  if (workPathConfig.value) return
  try {
    const config = await fetchSystemConfig()
    workPathConfig.value = config.localWorkPath
  } catch {
    // 使用默认配置作为预览回退
  }
}

async function verifyPathExists() {
  if (!hasPath.value || checking.value) return

  checking.value = true
  try {
    const result = await checkPathExists(displayFullPath.value)
    existsOnDisk.value = result.exists
    await maybeSuggestPathCorrection(result.exists)
  } catch {
    existsOnDisk.value = null
  } finally {
    checking.value = false
  }
}

function buildMismatchPromptKey() {
  return `${props.project.projectNo}::${ProjectForm.normalizeLocalWorkPath(localWorkPath.value)}`
}

function buildPathUpdatePayload(relativePath: string) {
  const normalized = ProjectForm.normalizeLocalWorkPath(relativePath)
  const nature = ProjectWorkPath.resolveNatureTemplate(props.project.natures)
  if (nature === 'design') {
    return {
      localWorkPath: normalized,
      designWorkPath: normalized,
    }
  }
  return {
    localWorkPath: normalized,
    detailWorkPath: normalized,
  }
}

function isPathMismatch(pathExists: boolean) {
  if (!hasPath.value) return false
  if (!pathExists) return true
  return !ProjectWorkPath.pathMatchesProject(localWorkPath.value, props.project.projectNo)
}

function buildPathSuggestDialogMessage(
  mismatchReason: string,
  currentRelativePath: string,
  currentFullPath: string,
  match: ProjectPathMatch,
  matchCount: number,
) {
  const sections = [
    h('p', { class: 'path-suggest-dialog__reason' }, `${mismatchReason}。`),
    h('div', { class: 'path-suggest-dialog__block' }, [
      h('div', { class: 'path-suggest-dialog__label' }, '当前路径'),
      currentFullPath
        ? h('div', { class: 'path-suggest-dialog__path path-suggest-dialog__path--old' }, currentFullPath)
        : null,
      currentRelativePath
        ? h('div', { class: 'path-suggest-dialog__path-sub' }, currentRelativePath)
        : h('div', { class: 'path-suggest-dialog__path-sub path-suggest-dialog__path-sub--muted' }, '（未设置）'),
    ]),
    h('div', { class: 'path-suggest-dialog__arrow' }, '↓'),
    h('div', { class: 'path-suggest-dialog__block path-suggest-dialog__block--new' }, [
      h('div', { class: 'path-suggest-dialog__label' }, '推荐路径'),
      h('div', { class: 'path-suggest-dialog__path path-suggest-dialog__path--new' }, match.fullPath),
      h('div', { class: 'path-suggest-dialog__path-sub' }, match.relativePath),
    ]),
    matchCount > 1
      ? h(
          'p',
          { class: 'path-suggest-dialog__hint' },
          `共找到 ${matchCount} 个候选路径，已推荐最匹配的一项。`,
        )
      : null,
    h('p', { class: 'path-suggest-dialog__question' }, '是否将本地路径更新为推荐路径？'),
  ]

  return h('div', { class: 'path-suggest-dialog' }, sections)
}

async function maybeSuggestPathCorrection(pathExists: boolean) {
  if (props.readonly) return
  const config = workPathConfig.value ?? resolvedWorkPathConfig.value
  if (!config.suggestPathOnMismatch || !isPathMismatch(pathExists)) return

  const promptKey = buildMismatchPromptKey()
  if (promptedMismatchKey.value === promptKey || suggesting.value) return

  suggesting.value = true
  try {
    const result = await searchProjectPath(props.project.projectNo, {
      relativePath: ProjectForm.normalizeLocalWorkPath(localWorkPath.value),
      natures: [...props.project.natures],
      receivedDate: props.project.receivedDate || props.project.plannedStartDate,
      projectName: props.project.name,
      contactFormIds: [...(props.project.contactFormIds || [])],
      isJiagongdan: ProjectWorkPath.isJiagongdanProject(props.project),
    })
    const match = result.matches[0]
    if (!match) return

    promptedMismatchKey.value = promptKey

    const mismatchReason = pathExists ? '当前路径与项目号不匹配' : '当前路径不存在'
    const currentRelativePath = ProjectForm.normalizeLocalWorkPath(localWorkPath.value)
    const currentFullPathForDialog = displayFullPath.value

    await ElMessageBox.confirm(
      buildPathSuggestDialogMessage(
        mismatchReason,
        currentRelativePath,
        currentFullPathForDialog,
        match,
        result.matches.length,
      ),
      '发现可能的项目路径',
      {
        confirmButtonText: '更新路径',
        cancelButtonText: '暂不修改',
        type: 'warning',
        closeOnClickModal: false,
        customClass: 'path-suggest-message-box',
      },
    )

    const updated = await updateProject(props.project.projectNo, buildPathUpdatePayload(match.relativePath))
    emit('pathUpdated', updated.projectNo, updated.localWorkPath, updated.designWorkPath, updated.detailWorkPath)
    existsOnDisk.value = true
    promptedMismatchKey.value = `${updated.projectNo}::${updated.localWorkPath}`
    ElMessage.success('项目路径已更新')
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : '搜索或更新路径失败')
  } finally {
    suggesting.value = false
  }
}

function handleMouseEnter() {
  void ensureWorkPathConfig()
  if (hasPath.value) {
    void verifyPathExists()
  }
}

async function copyPath() {
  if (!displayFullPath.value) return

  const copied = await copyTextToClipboard(displayFullPath.value)
  if (copied) {
    ElMessage.success('路径已复制，可粘贴到资源管理器地址栏')
    return
  }
  ElMessage.error('复制路径失败')
}

async function openSetPathDialog() {
  const nature = ProjectWorkPath.resolveNatureTemplate(props.project.natures)
  if (!nature) {
    ElMessage.warning('请先为项目设置性质（设计或细化）')
    return
  }

  await ensureWorkPathConfig()
  setPathInput.value = hasPath.value
    ? ProjectForm.normalizeLocalWorkPath(localWorkPath.value)
    : previewRelativePath.value
  setPathDialogVisible.value = true
}

async function saveSetPath() {
  const relativePath = ProjectForm.normalizeLocalWorkPath(setPathInput.value)
  if (!relativePath) {
    ElMessage.warning('请输入相对路径')
    return
  }

  savingPath.value = true
  try {
    const updated = await updateProject(
      props.project.projectNo,
      buildPathUpdatePayload(relativePath),
    )
    emit('pathUpdated', updated.projectNo, updated.localWorkPath, updated.designWorkPath, updated.detailWorkPath)
    existsOnDisk.value = null
    setPathDialogVisible.value = false
    ElMessage.success('路径已保存')
    void verifyPathExists()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存路径失败')
  } finally {
    savingPath.value = false
  }
}

function handleClick(event: MouseEvent) {
  event.stopPropagation()
}

async function handleMenuCommand(command: string) {
  if (command === 'copy') {
    await copyPath()
    return
  }
  if (command === 'set') {
    await openSetPathDialog()
  }
}
</script>

<template>
  <el-tooltip placement="left" :show-after="200">
    <template #content>
      <div class="path-tooltip">
        <div v-if="displayFullPath">{{ displayFullPath }}</div>
        <div>{{ statusText }}</div>
        <div>右键打开快捷菜单</div>
      </div>
    </template>
    <el-dropdown trigger="contextmenu" @command="handleMenuCommand">
      <button
        type="button"
        class="path-cell-btn"
        :class="iconClass"
        @mouseenter="handleMouseEnter"
        @click="handleClick"
      >
        <el-icon :size="16">
          <component :is="iconComponent" />
        </el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="displayFullPath" command="copy">复制路径</el-dropdown-item>
          <el-dropdown-item v-if="!readonly" command="set" :disabled="savingPath">
            设置路径
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </el-tooltip>

  <el-dialog
    v-model="setPathDialogVisible"
    title="设置路径"
    width="520px"
    append-to-body
    destroy-on-close
    @click.stop
  >
    <el-form label-width="80px" @submit.prevent="saveSetPath">
      <el-form-item label="相对路径">
        <el-input
          v-model="setPathInput"
          placeholder="请输入相对路径"
          clearable
          @keyup.enter="saveSetPath"
        />
      </el-form-item>
      <el-form-item v-if="setPathPreview" label="完整路径">
        <div class="set-path-preview">{{ setPathPreview }}</div>
      </el-form-item>
      <el-form-item label="">
        <div class="set-path-hint">{{ pathConfigHint }}</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="setPathDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="savingPath" @click="saveSetPath">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.path-cell-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 24px;
  height: 100%;
  min-height: 32px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  vertical-align: middle;
}

.path-cell-btn:hover {
  background: var(--el-fill-color-light);
}

.path-cell-btn.is-empty {
  color: var(--el-text-color-placeholder);
}

.path-cell-btn.is-ready {
  color: var(--el-color-success);
}

.path-cell-btn.is-missing {
  color: var(--el-color-warning);
}

.path-cell-btn.is-checking {
  color: var(--el-color-primary);
}

.path-tooltip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 360px;
  line-height: 1.5;
  word-break: break-all;
}

.set-path-preview {
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
  word-break: break-all;
  white-space: pre-wrap;
}

.set-path-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
</style>

<style>
.path-suggest-message-box {
  width: min(92vw, 680px);
  max-width: 680px;
}

.path-suggest-message-box .el-message-box__message {
  width: 100%;
}

.path-suggest-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
}

.path-suggest-dialog__reason {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.path-suggest-dialog__block {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.path-suggest-dialog__block--new {
  border-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
}

.path-suggest-dialog__label {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.path-suggest-dialog__path {
  font-size: 13px;
  line-height: 1.55;
  word-break: break-all;
  white-space: pre-wrap;
}

.path-suggest-dialog__path--old {
  color: var(--el-color-warning-dark-2);
}

.path-suggest-dialog__path--new {
  color: var(--el-color-success-dark-2);
}

.path-suggest-dialog__path-sub {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  word-break: break-all;
  white-space: pre-wrap;
}

.path-suggest-dialog__path-sub--muted {
  color: var(--el-text-color-placeholder);
}

.path-suggest-dialog__arrow {
  text-align: center;
  font-size: 16px;
  line-height: 1;
  color: var(--el-text-color-secondary);
}

.path-suggest-dialog__hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.path-suggest-dialog__question {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}
</style>
