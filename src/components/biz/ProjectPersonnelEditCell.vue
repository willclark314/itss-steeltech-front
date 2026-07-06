<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { updateProject } from '@/api/projects'
import type { PersonnelRecord } from '@/models/personnel'
import type { ProjectRecord } from '@/models/biz/project'

const props = defineProps<{
  project: ProjectRecord
  personnelOptions: PersonnelRecord[]
}>()

const emit = defineEmits<{
  updated: [record: ProjectRecord]
}>()

type PersonnelSelectOption = {
  id: string
  name: string
  team: string
}

const popoverVisible = ref(false)
const saving = ref(false)
const draftIds = ref<string[]>([])

const selectOptions = computed((): PersonnelSelectOption[] => {
  const optionMap = new Map<string, PersonnelSelectOption>()

  for (const person of props.personnelOptions) {
    optionMap.set(person.id, { id: person.id, name: person.name, team: person.team })
  }

  for (const person of props.project.assignedPersonnel) {
    if (!optionMap.has(person.id)) {
      optionMap.set(person.id, { id: person.id, name: person.name, team: person.team })
    }
  }

  return [...optionMap.values()].sort((a, b) => {
    const teamCompare = a.team.localeCompare(b.team, 'zh-CN')
    return teamCompare !== 0 ? teamCompare : a.name.localeCompare(b.name, 'zh-CN')
  })
})

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
    :width="280"
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

    <div class="personnel-picker" @click.stop>
      <el-select
        v-model="draftIds"
        multiple
        filterable
        collapse-tags
        collapse-tags-tooltip
        placeholder="选择分配人员"
        style="width: 100%"
      >
        <el-option
          v-for="person in selectOptions"
          :key="person.id"
          :label="`${person.name} · ${person.team}`"
          :value="person.id"
        />
      </el-select>
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
