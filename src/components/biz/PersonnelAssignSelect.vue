<script setup lang="ts">
import { computed, ref } from 'vue'
import { PersonnelForm } from '@/models/personnel'
import { ProjectForm } from '@/models/biz/project'
import type { PersonnelRecord, PersonnelSelectOption } from '@/models/personnel'

const props = withDefaults(
  defineProps<{
    personnelOptions: PersonnelRecord[]
    extraAssignees?: PersonnelSelectOption[]
    placeholder?: string
    collapseTags?: boolean
    collapseTagsTooltip?: boolean
    showTeamFilter?: boolean
    teamFilter?: string
    allowUnassigned?: boolean
  }>(),
  {
    extraAssignees: () => [],
    placeholder: '选择分配人员',
    collapseTags: true,
    collapseTagsTooltip: true,
    showTeamFilter: true,
    teamFilter: undefined,
    allowUnassigned: true,
  },
)

const model = defineModel<string[]>({ default: () => [] })

const UNASSIGNED_VALUE = ProjectForm.UNASSIGNED_PERSONNEL_FILTER

const internalTeamFilter = ref('')

const activeTeamFilter = computed({
  get: () => props.teamFilter ?? internalTeamFilter.value,
  set: (value: string) => {
    if (props.teamFilter !== undefined) return
    internalTeamFilter.value = value
  },
})

const showInternalTeamFilter = computed(
  () => props.showTeamFilter && props.teamFilter === undefined,
)

const allOptions = computed(() =>
  PersonnelForm.buildAssignSelectOptions(props.personnelOptions, props.extraAssignees),
)

const teamFilterOptions = computed(() => PersonnelForm.collectTeamFilterOptions(allOptions.value))

const filteredOptions = computed(() =>
  PersonnelForm.filterAssignSelectOptions(allOptions.value, activeTeamFilter.value),
)

const selectValue = computed(() => {
  if (!props.allowUnassigned) return model.value
  return model.value.length ? model.value : [UNASSIGNED_VALUE]
})

function handleSelectChange(next: string[]) {
  if (!props.allowUnassigned) {
    model.value = next
    return
  }

  if (!next.length) {
    model.value = []
    return
  }

  const people = next.filter((id) => id !== UNASSIGNED_VALUE)
  const prevWasUnassigned = model.value.length === 0
  const lastSelected = next[next.length - 1]

  if (lastSelected === UNASSIGNED_VALUE) {
    model.value = []
    return
  }

  if (prevWasUnassigned) {
    model.value = people
    return
  }

  model.value = people
}
</script>

<template>
  <div class="personnel-assign-select">
    <el-select
      v-if="showInternalTeamFilter"
      v-model="internalTeamFilter"
      placeholder="班组"
      clearable
      class="personnel-assign-select__team"
    >
      <el-option
        v-for="item in teamFilterOptions"
        :key="item.value || 'all'"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    <el-select
      :model-value="selectValue"
      multiple
      filterable
      :collapse-tags="collapseTags"
      :collapse-tags-tooltip="collapseTagsTooltip"
      :placeholder="placeholder"
      class="personnel-assign-select__main"
      @update:model-value="handleSelectChange"
    >
      <el-option
        v-if="allowUnassigned"
        label="未分配"
        :value="UNASSIGNED_VALUE"
      />
      <el-option
        v-for="person in filteredOptions"
        :key="person.id"
        :label="PersonnelForm.formatSelectLabel(person)"
        :value="person.id"
      />
    </el-select>
  </div>
</template>

<style scoped>
.personnel-assign-select {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.personnel-assign-select__team,
.personnel-assign-select__main {
  width: 100%;
}
</style>
