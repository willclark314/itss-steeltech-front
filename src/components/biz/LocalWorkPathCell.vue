<script setup lang="ts">
import { computed, ref } from 'vue'
import { Folder, FolderOpened, FolderRemove } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { updateProject } from '@/api/projects'
import {
  checkPathExists,
  fetchSystemConfig,
  generateWorkPath,
} from '@/api/system'
import { BusinessSystemConfig, type LocalWorkPathConfig } from '@/models/biz'
import { ProjectForm } from '@/models/biz/project'
import { ProjectWorkPath } from '@/models/biz/ProjectWorkPath'
import type { ProjectRecord } from '@/models/biz/project'

const props = defineProps<{
  project: ProjectRecord
}>()

const emit = defineEmits<{
  pathUpdated: [projectNo: string, localWorkPath: string]
}>()

const existsOnDisk = ref<boolean | null>(null)
const checking = ref(false)
const creating = ref(false)
const workPathConfig = ref<LocalWorkPathConfig | null>(null)

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
        ? '本地路径未创建'
        : '本地路径未创建（请先设置项目性质）'
    }
    return '本地路径未创建'
  }
  if (checking.value || existsOnDisk.value === null) return '正在检查本地路径...'
  return existsOnDisk.value ? '本地路径已存在' : '本地路径不存在'
})

const canCreatePath = computed(() => {
  if (!hasPath.value) return true
  if (checking.value || existsOnDisk.value === null) return false
  return !existsOnDisk.value
})

const iconComponent = computed(() => {
  if (!hasPath.value) return FolderRemove
  if (existsOnDisk.value === true) return FolderOpened
  return Folder
})

const iconClass = computed(() => ({
  'path-cell-btn': true,
  'is-empty': !hasPath.value,
  'is-ready': hasPath.value && existsOnDisk.value === true,
  'is-missing': hasPath.value && existsOnDisk.value === false,
  'is-checking': checking.value || creating.value,
}))

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
  } catch {
    existsOnDisk.value = null
  } finally {
    checking.value = false
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

  try {
    await navigator.clipboard.writeText(displayFullPath.value)
    ElMessage.success('路径已复制，可粘贴到资源管理器地址栏')
  } catch {
    ElMessage.error('复制路径失败')
  }
}

async function createPath() {
  if (creating.value) return

  const nature = ProjectWorkPath.resolveNatureTemplate(props.project.natures)
  if (!nature) {
    ElMessage.warning('请先为项目设置性质（设计或细化）')
    return
  }

  creating.value = true
  try {
    const config = await fetchSystemConfig()
    const workPathConfig = config.localWorkPath

    const relativePath =
      ProjectForm.hasLocalWorkPath(localWorkPath.value)
        ? ProjectForm.normalizeLocalWorkPath(localWorkPath.value)
        : ProjectWorkPath.buildRelativePath(props.project, workPathConfig.pathPatterns, nature)

    if (!relativePath) {
      ElMessage.error('无法根据系统配置生成路径，请检查路径组合规则')
      return
    }

    const variables = ProjectWorkPath.buildVariables(props.project)
    await generateWorkPath({
      path: relativePath,
      template: nature,
      ip: workPathConfig.ip,
      variables: { ...variables },
      skipExisting: true,
    })

    const updated = await updateProject(props.project.projectNo, { localWorkPath: relativePath })
    emit('pathUpdated', updated.projectNo, updated.localWorkPath)
    existsOnDisk.value = true
    ElMessage.success('项目路径已创建')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建路径失败')
  } finally {
    creating.value = false
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
  if (command === 'create') {
    await createPath()
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
          <el-dropdown-item v-if="canCreatePath" command="create" :disabled="creating">
            创建路径
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </el-tooltip>
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
</style>
