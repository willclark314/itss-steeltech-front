<script setup lang="ts">
import { computed, ref } from 'vue'
import { Folder, FolderOpened, FolderRemove } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { checkPathExists } from '@/api/system'
import { ProjectForm } from '@/models/biz/project'

const props = defineProps<{
  localWorkPath?: string
}>()

const existsOnDisk = ref<boolean | null>(null)
const checking = ref(false)

const hasPath = computed(() => ProjectForm.hasLocalWorkPath(props.localWorkPath))
const fullPath = computed(() => ProjectForm.buildLocalWorkPathFull(props.localWorkPath))

const statusText = computed(() => {
  if (!hasPath.value) return '本地路径未创建'
  if (checking.value || existsOnDisk.value === null) return '正在检查本地路径...'
  return existsOnDisk.value ? '本地路径已存在' : '本地路径不存在'
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
  'is-checking': checking.value,
}))

async function verifyPathExists() {
  if (!hasPath.value || checking.value) return

  checking.value = true
  try {
    const result = await checkPathExists(fullPath.value)
    existsOnDisk.value = result.exists
  } catch {
    existsOnDisk.value = null
  } finally {
    checking.value = false
  }
}

function handleMouseEnter() {
  if (!hasPath.value) return
  void verifyPathExists()
}

async function copyPath() {
  if (!hasPath.value) return

  try {
    await navigator.clipboard.writeText(fullPath.value)
    ElMessage.success('路径已复制，可粘贴到资源管理器地址栏')
  } catch {
    ElMessage.error('复制路径失败')
  }
}

function handleClick(event: MouseEvent) {
  event.stopPropagation()
}

async function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  await copyPath()
}
</script>

<template>
  <el-tooltip v-if="hasPath" placement="top" :show-after="200">
    <template #content>
      <div class="path-tooltip">
        <div>{{ fullPath }}</div>
        <div>{{ statusText }}</div>
        <div>右键复制路径</div>
      </div>
    </template>
    <button
      type="button"
      class="path-cell-btn"
      :class="iconClass"
      @mouseenter="handleMouseEnter"
      @contextmenu="handleContextMenu"
      @click="handleClick"
    >
      <el-icon :size="16">
        <component :is="iconComponent" />
      </el-icon>
    </button>
  </el-tooltip>

  <el-tooltip v-else placement="top" :show-after="200" content="本地路径未创建">
    <span
      class="path-cell-btn is-empty"
      aria-label="本地路径未创建"
      @contextmenu="handleContextMenu"
    >
      <el-icon :size="16">
        <FolderRemove />
      </el-icon>
    </span>
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
  cursor: default;
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
