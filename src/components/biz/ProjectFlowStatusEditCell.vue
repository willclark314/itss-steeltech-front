<script setup lang="ts">
import MyProjectFlowStatusCell from '@/components/portal/MyProjectFlowStatusCell.vue'
import type { ProjectRecord } from '@/models/biz/project'

defineProps<{
  project: ProjectRecord
}>()

const emit = defineEmits<{
  updated: [record: ProjectRecord]
}>()
</script>

<template>
  <MyProjectFlowStatusCell
    :project="project"
    full-edit-access
    @updated="emit('updated', $event)"
  />
</template>
