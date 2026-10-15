<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { Folder, FolderOpened, FolderRemove, Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { updateProject } from '@/api/projects'
import {
  checkPathExists,
  fetchSystemConfig,
  generateWorkPath,
  searchProjectPath,
  type ProjectPathMatch,
} from '@/api/system'
import { BusinessSystemConfig, type LocalWorkPathConfig } from '@/models/biz'
import { ProjectForm } from '@/models/biz/project'
import { ProjectWorkPath } from '@/models/biz/ProjectWorkPath'
import type { ProjectNatureCode, ProjectRecord } from '@/models/biz/project'
import { copyTextToClipboard } from '@/utils/clipboard'

const props = withDefaults(
  defineProps<{
    project: ProjectRecord
    readonly?: boolean
    /** 指定管理设计或细化归档路径；省略时按项目性质自动解析 */
    pathNature?: 'design' | 'detail'
    compact?: boolean
  }>(),
  { readonly: false, compact: false },
)

const emit = defineEmits<{
  pathUpdated: [projectNo: string, localWorkPath: string, designWorkPath: string, detailWorkPath: string]
}>()

const existsOnDisk = ref<boolean | null>(null)
const checking = ref(false)
const creating = ref(false)
const savingPath = ref(false)
const suggesting = ref(false)
const setPathDialogVisible = ref(false)
const setPathInput = ref('')
const workPathConfig = ref<LocalWorkPathConfig | null>(null)
const promptedMismatchKey = ref('')

const pathLabel = computed(() => {
  if (props.pathNature === 'design') return '设计归档路径'
  if (props.pathNature === 'detail') return '细化归档路径'
  return '本地路径'
})

/** 侧向展开，避免遮挡正上方行或同行的文件夹图标 */
const tooltipPlacement = computed(() => {
  if (props.compact && props.pathNature === 'detail') return 'right-start'
  return 'left-start'
})

const tooltipOffset = computed(() => (props.compact ? 10 : 8))

const resolvedNature = computed((): ProjectNatureCode | null => {
  if (props.pathNature) return props.pathNature
  return ProjectWorkPath.resolveNatureTemplate(props.project.natures)
})

const relativePath = computed(() => {
  if (props.pathNature) {
    return ProjectWorkPath.getNaturePath(props.project, props.pathNature)
  }
  return ProjectWorkPath.resolveDisplayLocalWorkPath(props.project)
})

const hasPath = computed(() => ProjectForm.hasLocalWorkPath(relativePath.value))

const resolvedWorkPathConfig = computed(
  () => workPathConfig.value ?? BusinessSystemConfig.LOCAL_WORK_PATH,
)

const previewRelativePath = computed(() => {
  const nature = resolvedNature.value
  if (!nature) return ''
  return (
    ProjectWorkPath.buildRelativePath(
      props.project,
      resolvedWorkPathConfig.value.pathPatterns,
      nature,
    ) ?? ''
  )
})

const savedRelativePath = computed(() =>
  hasPath.value ? ProjectForm.normalizeLocalWorkPath(relativePath.value) : '',
)

const savedFullPath = computed(() => {
  if (!savedRelativePath.value) return ''
  return ProjectForm.buildLocalWorkPathFull(
    savedRelativePath.value,
    resolvedWorkPathConfig.value,
  )
})

const suggestedRelativePath = computed(() =>
  ProjectForm.normalizeLocalWorkPath(previewRelativePath.value),
)

const suggestedFullPath = computed(() => {
  if (!suggestedRelativePath.value) return ''
  return ProjectForm.buildLocalWorkPathFull(
    suggestedRelativePath.value,
    resolvedWorkPathConfig.value,
  )
})

const archiveKindMismatch = computed(() => {
  if (resolvedNature.value !== 'detail' && props.pathNature !== 'detail') return false
  return ProjectWorkPath.isDetailArchiveKindMismatch(props.project, savedRelativePath.value)
})

const expectedArchiveKindLabel = computed(() =>
  ProjectWorkPath.getArchivePathKindLabel(
    ProjectWorkPath.expectsJiagongdanArchive(props.project) ? 'jiagongdan' : 'detail',
  ),
)

const savedArchiveKindLabel = computed(() =>
  ProjectWorkPath.getArchivePathKindLabel(
    ProjectWorkPath.getArchivePathKind(savedRelativePath.value),
  ),
)

/** 悬停主路径：有已设置则显示已设置，否则显示建议创建路径 */
const displayFullPath = computed(() => savedFullPath.value || suggestedFullPath.value)

const statusText = computed(() => {
  if (creating.value) return `正在创建${pathLabel.value}...`
  if (!hasPath.value) {
    if (!suggestedFullPath.value) {
      return resolvedNature.value
        ? `${pathLabel.value}未设置`
        : `${pathLabel.value}未设置（请先设置项目性质）`
    }
    return `${pathLabel.value}未设置（悬停为建议创建路径）`
  }
  if (needsPathSwitch.value) {
    return `联系单性质已变为「${expectedArchiveKindLabel.value}」，与已设置的「${savedArchiveKindLabel.value}」不一致；左键或右键可切换并创建新路径`
  }
  if (checking.value || existsOnDisk.value === null) return `正在检查${pathLabel.value}...`
  if (!existsOnDisk.value) return `${pathLabel.value}不存在`
  if (!ProjectWorkPath.pathMatchesProject(relativePath.value, props.project.projectNo)) {
    return `${pathLabel.value}与项目号不匹配`
  }
  return `${pathLabel.value}已存在`
})

const showSuggestedPathHint = computed(() => {
  if (!suggestedRelativePath.value) return false
  if (!savedRelativePath.value) return true
  return (
    archiveKindMismatch.value ||
    savedRelativePath.value !== suggestedRelativePath.value
  )
})

/** 已设路径与当前联系单/加工单性质不一致，需要创建新路径并切换过去 */
const needsPathSwitch = computed(() => {
  if (props.readonly) return false
  if (resolvedNature.value !== 'detail' && props.pathNature !== 'detail') return false
  if (!savedRelativePath.value || !suggestedRelativePath.value) return false
  if (archiveKindMismatch.value) return true
  const savedKind = ProjectWorkPath.getArchivePathKind(savedRelativePath.value)
  const suggestedKind = ProjectWorkPath.getArchivePathKind(suggestedRelativePath.value)
  if (savedKind !== 'unknown' && suggestedKind !== 'unknown' && savedKind !== suggestedKind) {
    return true
  }
  return false
})

const setPathPreview = computed(() => {
  const normalized = ProjectForm.normalizeLocalWorkPath(setPathInput.value)
  if (!normalized) return ''
  return ProjectForm.buildLocalWorkPathFull(normalized, resolvedWorkPathConfig.value)
})

const pathConfigHint = computed(() => {
  const config = resolvedWorkPathConfig.value
  return `全局配置：${config.ip}`
})

const canCreatePath = computed(() => {
  if (props.readonly) return false
  if (!resolvedNature.value) return false
  if (!hasPath.value) return true
  if (needsPathSwitch.value) return true
  if (checking.value || existsOnDisk.value === null) return false
  return !existsOnDisk.value
})

const createPathMenuLabel = computed(() => {
  if (needsPathSwitch.value) {
    return `切换到「${expectedArchiveKindLabel.value}」并创建`
  }
  return '创建路径'
})

const iconClass = computed(() => ({
  'path-cell-btn': true,
  'path-cell-btn--compact': props.compact,
  'is-empty': !hasPath.value,
  'is-ready':
    hasPath.value &&
    !needsPathSwitch.value &&
    existsOnDisk.value === true &&
    ProjectWorkPath.pathMatchesProject(relativePath.value, props.project.projectNo),
  'is-missing':
    hasPath.value &&
    (needsPathSwitch.value ||
      existsOnDisk.value === false ||
      (existsOnDisk.value === true &&
        !ProjectWorkPath.pathMatchesProject(relativePath.value, props.project.projectNo))),
  'is-checking': checking.value || creating.value || savingPath.value || suggesting.value,
}))

const iconComponent = computed(() => {
  if (creating.value) return Loading
  if (!hasPath.value) return FolderRemove
  if (existsOnDisk.value === true) return FolderOpened
  return Folder
})

function buildSearchOptions() {
  return ProjectWorkPath.buildPathSearchOptions(
    props.project,
    props.pathNature,
    relativePath.value,
  )
}

async function verifyPathExists() {
  if (!resolvedNature.value || checking.value) return

  checking.value = true
  try {
    if (hasPath.value && displayFullPath.value) {
      const result = await checkPathExists(displayFullPath.value)
      existsOnDisk.value = result.exists
      await maybeSuggestPathCorrection(result.exists)
      return
    }

    existsOnDisk.value = false
    await maybeSuggestPathCorrection(false)
  } catch {
    existsOnDisk.value = null
  } finally {
    checking.value = false
  }
}

function buildMismatchPromptKey() {
  const scope = props.pathNature ?? 'auto'
  return `${props.project.projectNo}::${scope}::${ProjectForm.normalizeLocalWorkPath(relativePath.value)}`
}

function buildPathUpdatePayload(normalizedPath: string) {
  const normalized = ProjectForm.normalizeLocalWorkPath(normalizedPath)
  if (props.pathNature === 'design') {
    return { designWorkPath: normalized }
  }
  if (props.pathNature === 'detail') {
    return { detailWorkPath: normalized }
  }

  const nature = resolvedNature.value
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
  if (!resolvedNature.value) return false
  if (!hasPath.value) return true
  if (!pathExists) return true
  return !ProjectWorkPath.pathMatchesProject(relativePath.value, props.project.projectNo)
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
      h('div', { class: 'path-suggest-dialog__label' }, `当前${pathLabel.value}`),
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
    h('p', { class: 'path-suggest-dialog__question' }, `是否将${pathLabel.value}更新为推荐路径？`),
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
    const result = await searchProjectPath(
      props.project.projectNo,
      buildSearchOptions(),
    )
    const match =
      result.matches.find((item) =>
        ProjectWorkPath.pathMatchesProject(item.relativePath, props.project.projectNo),
      ) ?? null
    if (!match) return

    promptedMismatchKey.value = promptKey

    const mismatchReason = pathExists ? `当前${pathLabel.value}与项目号不匹配` : `当前${pathLabel.value}不存在`
    const currentRelativePath = ProjectForm.normalizeLocalWorkPath(relativePath.value)
    const currentFullPathForDialog = displayFullPath.value

    await ElMessageBox.confirm(
      buildPathSuggestDialogMessage(
        mismatchReason,
        currentRelativePath,
        currentFullPathForDialog,
        match,
        result.matches.length,
      ),
      `发现可能的${pathLabel.value}`,
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
    promptedMismatchKey.value = buildMismatchPromptKey()
    ElMessage.success(`${pathLabel.value}已更新`)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : '搜索或更新路径失败')
  } finally {
    suggesting.value = false
  }
}

function handleMouseEnter() {
  void ensureWorkPathConfig()
  if (resolvedNature.value) {
    void verifyPathExists()
  }
}

async function ensureWorkPathConfig() {
  if (workPathConfig.value) return
  try {
    const config = await fetchSystemConfig()
    workPathConfig.value = config.localWorkPath
  } catch {
    // 使用默认配置作为预览回退
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

async function createPath(options?: { forceSwitch?: boolean }) {
  if (creating.value) return

  const nature = resolvedNature.value
  if (!nature) {
    ElMessage.warning('请先为项目设置性质（设计或细化）')
    return
  }

  const forceSwitch = Boolean(options?.forceSwitch || needsPathSwitch.value)

  creating.value = true
  try {
    const config = await fetchSystemConfig()
    const pathConfig = config.localWorkPath

    const patternKey = ProjectWorkPath.resolvePatternKey(props.project, nature)
    const suggestedPath =
      ProjectWorkPath.buildRelativePath(props.project, pathConfig.pathPatterns, nature) ?? ''
    const existingPath = hasPath.value
      ? ProjectForm.normalizeLocalWorkPath(relativePath.value)
      : ''

    const nextRelativePath = forceSwitch || !existingPath ? suggestedPath : existingPath

    if (!nextRelativePath) {
      ElMessage.error('无法根据系统配置生成路径，请检查路径组合规则')
      return
    }

    if (forceSwitch && existingPath && existingPath !== nextRelativePath) {
      await ElMessageBox.confirm(
        h('div', { class: 'path-suggest-dialog' }, [
          h(
            'p',
            { class: 'path-suggest-dialog__reason' },
            `将按「${expectedArchiveKindLabel.value}」创建新目录，并把项目本地路径切换过去（旧路径不会自动删除）。`,
          ),
          h('div', { class: 'path-suggest-dialog__block' }, [
            h('div', { class: 'path-suggest-dialog__label' }, '当前已设置'),
            h(
              'div',
              { class: 'path-suggest-dialog__path path-suggest-dialog__path--old' },
              savedFullPath.value || existingPath,
            ),
            h('div', { class: 'path-suggest-dialog__path-sub' }, `类别：${savedArchiveKindLabel.value}`),
          ]),
          h('div', { class: 'path-suggest-dialog__arrow' }, '↓'),
          h('div', { class: 'path-suggest-dialog__block path-suggest-dialog__block--new' }, [
            h('div', { class: 'path-suggest-dialog__label' }, '将切换到'),
            h(
              'div',
              { class: 'path-suggest-dialog__path path-suggest-dialog__path--new' },
              ProjectForm.buildLocalWorkPathFull(nextRelativePath, pathConfig),
            ),
            h(
              'div',
              { class: 'path-suggest-dialog__path-sub' },
              `类别：${expectedArchiveKindLabel.value}`,
            ),
          ]),
        ]),
        '切换并创建归档路径',
        {
          confirmButtonText: '创建并切换',
          cancelButtonText: '取消',
          customClass: 'path-suggest-message-box',
        },
      )
    }

    const variables = ProjectWorkPath.buildVariables(props.project, patternKey)
    const isJiagongdan = patternKey === 'detailJiagongdan'
    await generateWorkPath({
      path: nextRelativePath,
      template: nature,
      ip: pathConfig.ip,
      variables: {
        ...variables,
        isJiagongdan: isJiagongdan ? 'true' : 'false',
      },
      skipExisting: true,
    })

    const updated = await updateProject(
      props.project.projectNo,
      buildPathUpdatePayload(nextRelativePath),
    )
    emit('pathUpdated', updated.projectNo, updated.localWorkPath, updated.designWorkPath, updated.detailWorkPath)
    existsOnDisk.value = true
    ElMessage.success(
      forceSwitch && existingPath && existingPath !== nextRelativePath
        ? `已创建并切换到「${expectedArchiveKindLabel.value}」路径`
        : `${pathLabel.value}已创建`,
    )
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : '创建路径失败')
  } finally {
    creating.value = false
  }
}

async function openSetPathDialog() {
  const nature = resolvedNature.value
  if (!nature) {
    ElMessage.warning('请先为项目设置性质（设计或细化）')
    return
  }

  await ensureWorkPathConfig()
  setPathInput.value = needsPathSwitch.value
    ? suggestedRelativePath.value
    : hasPath.value
      ? ProjectForm.normalizeLocalWorkPath(relativePath.value)
      : previewRelativePath.value
  setPathDialogVisible.value = true
}

async function saveSetPath() {
  const normalized = ProjectForm.normalizeLocalWorkPath(setPathInput.value)
  if (!normalized) {
    ElMessage.warning('请输入相对路径')
    return
  }

  savingPath.value = true
  try {
    const updated = await updateProject(
      props.project.projectNo,
      buildPathUpdatePayload(normalized),
    )
    emit('pathUpdated', updated.projectNo, updated.localWorkPath, updated.designWorkPath, updated.detailWorkPath)
    existsOnDisk.value = null
    setPathDialogVisible.value = false
    ElMessage.success(`${pathLabel.value}已保存`)
    void verifyPathExists()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存路径失败')
  } finally {
    savingPath.value = false
  }
}

function handleClick(event: MouseEvent) {
  event.stopPropagation()
  if (props.readonly || creating.value) return
  if (needsPathSwitch.value) {
    void createPath({ forceSwitch: true })
  }
}

async function handleMenuCommand(command: string) {
  if (command === 'copy') {
    await copyPath()
    return
  }
  if (command === 'create') {
    await createPath({ forceSwitch: needsPathSwitch.value })
    return
  }
  if (command === 'set') {
    await openSetPathDialog()
  }
}
</script>

<template>
  <el-tooltip :placement="tooltipPlacement" :show-after="200" :offset="tooltipOffset">
    <template #content>
      <div class="path-tooltip">
        <div v-if="pathNature" class="path-tooltip__label">{{ pathLabel }}</div>

        <div class="path-tooltip__section">
          <div class="path-tooltip__section-label">已设置路径</div>
          <template v-if="savedFullPath">
            <div>{{ savedFullPath }}</div>
            <div class="path-tooltip__sub">{{ savedRelativePath }}</div>
            <div v-if="savedArchiveKindLabel !== '未知'" class="path-tooltip__sub">
              类别：{{ savedArchiveKindLabel }}
            </div>
          </template>
          <div v-else class="path-tooltip__muted">（尚未保存到项目）</div>
        </div>

        <div v-if="showSuggestedPathHint" class="path-tooltip__section path-tooltip__section--hint">
          <div class="path-tooltip__section-label">
            {{
              archiveKindMismatch || needsPathSwitch
                ? `性质已变为「${expectedArchiveKindLabel}」，重新创建将切换到`
                : hasPath
                  ? '按当前规则建议路径'
                  : '按当前规则建议创建'
            }}
          </div>
          <div v-if="suggestedFullPath">{{ suggestedFullPath }}</div>
          <div v-if="suggestedRelativePath" class="path-tooltip__sub">{{ suggestedRelativePath }}</div>
          <div class="path-tooltip__sub">类别：{{ expectedArchiveKindLabel }}</div>
        </div>

        <div>{{ statusText }}</div>
        <div v-if="needsPathSwitch" class="path-tooltip__sub">
          左键：确认后按「{{ expectedArchiveKindLabel }}」创建并切换；右键也可选同一操作
        </div>
        <div v-else>右键打开快捷菜单</div>
      </div>
    </template>
    <el-dropdown trigger="contextmenu" @command="handleMenuCommand">
      <button
        type="button"
        class="path-cell-btn"
        :class="iconClass"
        :disabled="creating"
        @mouseenter="handleMouseEnter"
        @click="handleClick"
      >
        <el-icon :size="16" :class="{ 'is-loading': creating }">
          <component :is="iconComponent" />
        </el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="displayFullPath" command="copy" :disabled="creating">
            复制路径
          </el-dropdown-item>
          <el-dropdown-item v-if="canCreatePath" command="create" :disabled="creating">
            <span v-if="creating" class="path-create-menu-item">
              <el-icon class="is-loading" :size="14"><Loading /></el-icon>
              正在创建...
            </span>
            <span v-else>{{ createPathMenuLabel }}</span>
          </el-dropdown-item>
          <el-dropdown-item v-if="!readonly" command="set" :disabled="creating || savingPath">
            设置路径
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </el-tooltip>

  <el-dialog
    v-model="setPathDialogVisible"
    :title="`设置${pathLabel}`"
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

.path-cell-btn--compact {
  width: auto;
  min-width: 28px;
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

.path-cell-btn:disabled {
  cursor: wait;
}

.path-create-menu-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.path-tooltip {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 420px;
  line-height: 1.5;
  word-break: break-all;
}

.path-tooltip__label {
  font-weight: 600;
}

.path-tooltip__section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.path-tooltip__section--hint {
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.35);
}

.path-tooltip__section-label {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.9;
}

.path-tooltip__sub {
  font-size: 12px;
  opacity: 0.85;
}

.path-tooltip__muted {
  font-size: 12px;
  opacity: 0.7;
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
