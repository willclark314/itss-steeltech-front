<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { updateProject } from '@/api/projects'
import type { PersonnelRecord } from '@/models/personnel'
import type { ProjectRecord } from '@/models/biz/project'

const PersonnelAssignSelect = defineAsyncComponent(
  () => import('@/components/biz/PersonnelAssignSelect.vue'),
)

const props = defineProps<{
  project: ProjectRecord
  personnelOptions: PersonnelRecord[]
}>()

const emit = defineEmits<{
  updated: [record: ProjectRecord]
}>()

const popoverVisible = ref(false)
const saving = ref(false)
const draftIds = ref<string[]>([])
/** 首次打开后再挂载人员选择器，避免首屏每行预渲染 */
const pickerReady = ref(false)

watch(
  () => props.project.projectNo,
  () => {
    pickerReady.value = false
    popoverVisible.value = false
  },
)

function syncDraft() {
  draftIds.value = [...props.project.assignedPersonnelIds]
}

function isSameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.every((id, index) => id === sortedRight[index])
}

function handlePopoverShow() {
  pickerReady.value = true
  syncDraft()
}

async function handlePopoverHide() {
  if (saving.value) return

  const nextIds = [...draftIds.value]
  if (isSameIds(nextIds, props.project.assignedPersonnelIds)) return

  saving.value = true
  try {
    const updated = await updateProject(props.project.projectNo, {
      assignedPersonnelIds: nextIds,
    })
    emit('updated', updated)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新分配人员失败')
    syncDraft()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-popover
    v-model:visible="popoverVisible"
    class="personnel-popover"
    placement="bottom-start"
    :width="300"
    trigger="click"
    :disabled="saving"
    @show="handlePopoverShow"
    @hide="handlePopoverHide"
  >
    <template #reference>
      <button
        type="button"
        class="personnel-cell"
        :class="{ 'is-loading': saving, 'is-empty': !project.assignedPersonnel.length }"
        :disabled="saving"
        @click.stop
      >
        <el-tooltip v-if="project.assignedPersonnel.length" placement="top" :show-after="200">
          <template #content>
            <div class="personnel-tooltip">
              <div v-for="person in project.assignedPersonnel" :key="person.id">
                {{ person.name }} · {{ person.team }}
              </div>
            </div>
          </template>
          <div class="personnel-tag-list">
            <el-tag
              v-for="person in project.assignedPersonnel"
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
      </button>
    </template>

    <div v-if="pickerReady" class="personnel-picker" @click.stop>
      <PersonnelAssignSelect
        v-model="draftIds"
        :personnel-options="personnelOptions"
        :extra-assignees="project.assignedPersonnel"
        placeholder="选择分配人员"
      />
    </div>
  </el-popover>
</template>

<style scoped>
.personnel-popover {
  display: flex;
  width: 100%;
  justify-content: flex-start;
}

.personnel-cell {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: var(--biz-table-row-height, 35px);
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.personnel-cell:hover:not(:disabled) {
  background: var(--el-fill-color-light);
}

.personnel-cell.is-loading {
  cursor: wait;
  opacity: 0.6;
}

.personnel-cell.is-empty {
  justify-content: flex-start;
  padding-left: 2px;
}

.personnel-tag-list {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.personnel-tag {
  flex-shrink: 0;
  max-width: 72px;
  overflow: hidden;
  cursor: pointer;
}

.personnel-tag :deep(.el-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.personnel-tag--empty {
  cursor: pointer;
}
</style>
