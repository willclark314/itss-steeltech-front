<script setup lang="ts">
import type { ProjectAssignee } from '@/models/biz/project'

defineProps<{
  personnel: ProjectAssignee[]
}>()
</script>

<template>
  <el-tooltip v-if="personnel.length" placement="top" :show-after="200">
    <template #content>
      <div class="personnel-tooltip">
        <div v-for="person in personnel" :key="person.id">
          {{ person.name }} · {{ person.team }}
        </div>
      </div>
    </template>
    <div class="personnel-tag-list">
      <el-tag
        v-for="person in personnel"
        :key="person.id"
        type="info"
        size="small"
        class="personnel-tag"
      >
        {{ person.name }}
      </el-tag>
    </div>
  </el-tooltip>
  <el-tag v-else type="info" size="small" class="personnel-tag personnel-tag--empty">
    未分配
  </el-tag>
</template>

<style scoped>
.personnel-tag-list {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  cursor: default;
}

.personnel-tag {
  flex-shrink: 0;
  max-width: 72px;
  overflow: hidden;
  cursor: default;
}

.personnel-tag :deep(.el-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.personnel-tag--empty {
  cursor: default;
}
</style>
