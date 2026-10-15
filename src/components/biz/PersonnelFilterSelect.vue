<script setup lang="ts">
import { computed } from 'vue'
import { PersonnelForm } from '@/models/personnel'
import { ProjectForm } from '@/models/biz/project'
import type { PersonnelRecord } from '@/models/personnel'

const props = withDefaults(
  defineProps<{
    personnelOptions: PersonnelRecord[]
    placeholder?: string
    width?: string
    size?: 'default' | 'small'
  }>(),
  {
    placeholder: '全部',
    width: '160px',
    size: 'default',
  },
)

const model = defineModel<string>({ default: '' })

const selectOptions = computed(() => PersonnelForm.buildAssignSelectOptions(props.personnelOptions))
</script>

<template>
  <el-select
    v-model="model"
    filterable
    clearable
    :placeholder="placeholder"
    :size="size"
    :style="{ width }"
  >
    <el-option label="未分配" :value="ProjectForm.UNASSIGNED_PERSONNEL_FILTER" />
    <el-option
      v-for="person in selectOptions"
      :key="person.id"
      :label="PersonnelForm.formatSelectLabel(person)"
      :value="person.id"
    />
  </el-select>
</template>
