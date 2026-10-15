<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PersonnelForm } from '@/models/personnel'
import { ProjectForm } from '@/models/biz/project'
import type { PersonnelRecord } from '@/models/personnel'

const props = defineProps<{
  personnelOptions: PersonnelRecord[]
}>()

const assignedPersonnelId = defineModel<string>('assignedPersonnelId', { default: '' })

const popoverVisible = ref(false)
const keyword = ref('')

const selectOptions = computed(() =>
  PersonnelForm.buildAssignSelectOptions(props.personnelOptions),
)

const showUnassignedOption = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase()
  if (!normalizedKeyword) return true
  return '未分配'.includes(normalizedKeyword)
})

const filteredOptions = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase()
  if (!normalizedKeyword) return selectOptions.value
  return selectOptions.value.filter((person) =>
    `${person.name} ${person.team}`.toLowerCase().includes(normalizedKeyword),
  )
})

const activePersonLabel = computed(() => {
  if (!assignedPersonnelId.value) return ''
  if (assignedPersonnelId.value === ProjectForm.UNASSIGNED_PERSONNEL_FILTER) return '未分配'
  const person = selectOptions.value.find((item) => item.id === assignedPersonnelId.value)
  return person ? person.name : ''
})

watch(popoverVisible, (visible) => {
  if (visible) {
    keyword.value = ''
  }
})

function handleSelect(personnelId: string) {
  assignedPersonnelId.value = personnelId
  popoverVisible.value = false
}

function handleClear() {
  assignedPersonnelId.value = ''
  popoverVisible.value = false
}
</script>

<template>
  <el-popover
    v-model:visible="popoverVisible"
    placement="bottom-start"
    :width="260"
    trigger="click"
    popper-class="project-personnel-filter-popover"
  >
    <template #reference>
      <button
        type="button"
        class="personnel-column-header"
        :class="{ 'is-active': Boolean(assignedPersonnelId) }"
        :title="activePersonLabel ? `已筛选：${activePersonLabel}` : undefined"
        @click.stop
      >
        分配人员
      </button>
    </template>

    <div class="personnel-filter-panel" @click.stop>
      <el-input
        v-model="keyword"
        placeholder="搜索姓名 / 班组"
        clearable
        size="small"
      />

      <div class="personnel-filter-list">
        <button
          type="button"
          class="personnel-filter-item"
          :class="{ 'is-selected': !assignedPersonnelId }"
          @click="handleSelect('')"
        >
          全部
        </button>
        <button
          v-if="showUnassignedOption"
          type="button"
          class="personnel-filter-item"
          :class="{ 'is-selected': assignedPersonnelId === ProjectForm.UNASSIGNED_PERSONNEL_FILTER }"
          @click="handleSelect(ProjectForm.UNASSIGNED_PERSONNEL_FILTER)"
        >
          未分配
        </button>
        <button
          v-for="person in filteredOptions"
          :key="person.id"
          type="button"
          class="personnel-filter-item"
          :class="{ 'is-selected': assignedPersonnelId === person.id }"
          @click="handleSelect(person.id)"
        >
          {{ PersonnelForm.formatSelectLabel(person) }}
        </button>
        <div
          v-if="!filteredOptions.length && !showUnassignedOption"
          class="personnel-filter-empty"
        >
          无匹配人员
        </div>
      </div>

      <div v-if="assignedPersonnelId" class="personnel-filter-footer">
        <el-button size="small" link @click="handleClear">清除筛选</el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.personnel-column-header {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
  line-height: 1.2;
  cursor: pointer;
}

.personnel-column-header.is-active {
  color: var(--el-color-primary);
}

.personnel-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.personnel-filter-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
}

.personnel-filter-item {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.personnel-filter-item:hover {
  background: var(--el-fill-color-light);
}

.personnel-filter-item.is-selected {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.personnel-filter-empty {
  padding: 12px 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.personnel-filter-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
