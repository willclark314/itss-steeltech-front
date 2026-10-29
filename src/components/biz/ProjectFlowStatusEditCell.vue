<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { ProjectForm } from '@/models/biz/project'
import { MyProjectForm } from '@/models/portal/MyProjectForm'
import type { ProjectRecord } from '@/models/biz/project'

const MyProjectFlowStatusCell = defineAsyncComponent(
  () => import('@/components/portal/MyProjectFlowStatusCell.vue'),
)

const props = withDefaults(
  defineProps<{
    project: ProjectRecord
    personnelTeam?: string
    fullEditAccess?: boolean
    loadingKey?: string
  }>(),
  {
    personnelTeam: '',
    fullEditAccess: true,
  },
)

const emit = defineEmits<{
  updated: [record: ProjectRecord]
  saving: [key: string]
  saved: [key: string]
}>()

/** 首屏只渲染只读标签；首次点击后再挂载可编辑流程单元格 */
const editing = ref(false)

watch(
  () => props.project.projectNo,
  () => {
    editing.value = false
  },
)

const flowStatusItems = computed(() => {
  const segments = props.fullEditAccess
    ? MyProjectForm.getAdminFlowSegments(props.project)
    : MyProjectForm.getFlowSegments(props.project, props.personnelTeam)
  if (segments.length) {
    return segments.map((segment) => ({
      label: segment.label,
      type: segment.type,
    }))
  }
  return ProjectForm.getFlowStatusItems(props.project)
})

function startEdit() {
  editing.value = true
}
</script>

<template>
  <MyProjectFlowStatusCell
    v-if="editing"
    :project="project"
    :personnel-team="personnelTeam"
    :full-edit-access="fullEditAccess"
    :loading-key="loadingKey"
    @updated="emit('updated', $event)"
    @saving="emit('saving', $event)"
    @saved="emit('saved', $event)"
  />
  <button
    v-else
    type="button"
    class="flow-status-preview"
    title="点击编辑流程状态"
    @click.stop="startEdit"
  >
    <div class="flow-status-tag-list">
      <el-tag
        v-for="item in flowStatusItems"
        :key="item.label"
        :type="item.type"
        size="small"
        class="cell-tag cell-tag--clickable"
      >
        {{ item.label }}
      </el-tag>
    </div>
  </button>
</template>

<style scoped>
.flow-status-preview {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--biz-table-row-height, 35px);
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.flow-status-preview:hover {
  background: var(--el-fill-color-light);
}
</style>
