<script setup lang="ts">
import { computed } from 'vue'
import LocalWorkPathCellItem from '@/components/biz/LocalWorkPathCellItem.vue'
import { ProjectForm } from '@/models/biz/project'
import type { ProjectRecord } from '@/models/biz/project'

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

const showDualPaths = computed(() => ProjectForm.hasDualNatureTasks(props.project))

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
  <div v-if="showDualPaths" class="local-path-dual">
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
</style>
