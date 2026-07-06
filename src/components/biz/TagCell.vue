<script setup lang="ts">
import type { TagRecord } from '@/models/biz/tag'

withDefaults(
  defineProps<{
    tags?: TagRecord[]
    emptyText?: string
  }>(),
  {
    tags: () => [],
    emptyText: '—',
  },
)
</script>

<template>
  <div v-if="tags.length" class="tag-cell">
    <el-tag v-for="tag in tags" :key="tag.id" size="small" type="info">
      {{ tag.name }}
    </el-tag>
  </div>
  <span v-else class="tag-cell__empty">{{ emptyText }}</span>
</template>

<style scoped>
.tag-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-cell__empty {
  color: var(--el-text-color-placeholder);
}
</style>
