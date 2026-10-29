<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Folder } from '@element-plus/icons-vue'
import LocalWorkPathCellItem from '@/components/biz/LocalWorkPathCellItem.vue'
import { ProjectForm } from '@/models/biz/project'
import type { ProjectRecord } from '@/models/biz/project'

const props = withDefaults(
  defineProps<{
    project: ProjectRecord
    readonly?: boolean
    /** 悬停/点击后再挂载完整路径控件（含 tooltip / 下拉 / 对话框） */
    activateOnInteract?: boolean
  }>(),
  { readonly: false, activateOnInteract: false },
)

const emit = defineEmits<{
  pathUpdated: [projectNo: string, localWorkPath: string, designWorkPath: string, detailWorkPath: string]
}>()

const activated = ref(!props.activateOnInteract)

watch(
  () => props.project.projectNo,
  () => {
    if (props.activateOnInteract) activated.value = false
  },
)

const showDualPaths = computed(() => ProjectForm.hasDualNatureTasks(props.project))

function activate() {
  activated.value = true
}

function forwardPathUpdated(
  projectNo: string,
  localWorkPath: string,
  designWorkPath: string,
  detailWorkPath: string,
) {
  emit('pathUpdated', projectNo, localWorkPath, designWorkPath, detailWorkPath)
}
</script>

<template>
  <button
    v-if="!activated"
    type="button"
    class="path-lazy-placeholder"
    title="悬停或点击加载路径操作"
    @mouseenter="activate"
    @focus="activate"
    @click.stop="activate"
  >
    <el-icon :size="16"><Folder /></el-icon>
  </button>
  <div v-else-if="showDualPaths" class="local-path-dual">
    <LocalWorkPathCellItem
      :project="project"
      :readonly="readonly"
      path-nature="design"
      compact
      @path-updated="forwardPathUpdated"
    />
    <LocalWorkPathCellItem
      :project="project"
      :readonly="readonly"
      path-nature="detail"
      compact
      @path-updated="forwardPathUpdated"
    />
  </div>
  <LocalWorkPathCellItem
    v-else
    :project="project"
    :readonly="readonly"
    @path-updated="forwardPathUpdated"
  />
</template>

<style scoped>
.local-path-dual {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  height: 100%;
}

.path-lazy-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--biz-table-row-height, 35px);
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.path-lazy-placeholder:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}
</style>
