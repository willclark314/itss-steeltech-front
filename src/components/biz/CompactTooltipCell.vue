<script setup lang="ts">
defineProps<{
  text: string
  tooltip?: string
  muted?: boolean
}>()
</script>

<template>
  <el-tooltip
    v-if="text"
    :content="tooltip || text"
    placement="top"
    :show-after="200"
    :disabled="!tooltip && text.length < 24"
  >
    <span class="ellipsis-cell" :class="{ 'is-muted': muted }">{{ text }}</span>
  </el-tooltip>
  <span v-else class="ellipsis-cell is-muted">-</span>
</template>

<style scoped>
.ellipsis-cell {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.ellipsis-cell.is-muted {
  color: var(--el-text-color-placeholder);
}
</style>
