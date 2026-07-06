<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Filter } from '@element-plus/icons-vue'
import { MyProjectForm } from '@/models/portal/MyProjectForm'

const props = defineProps<{
  modelValue: string[]
  personnelTeam: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  change: []
}>()

const popoverVisible = ref(false)
const draftFilters = ref<string[]>([])

const filterGroups = computed(() => MyProjectForm.getFlowFilterGroups(props.personnelTeam))

const activeSummary = computed(() => {
  if (!props.modelValue.length) return ''
  if (props.modelValue.length === 1) {
    return MyProjectForm.getFlowFilterLabel(filterGroups.value, props.modelValue[0]!)
  }
  return `已选 ${props.modelValue.length} 项`
})

watch(popoverVisible, (visible) => {
  if (visible) {
    draftFilters.value = [...props.modelValue]
  }
})

function handleConfirm() {
  const next = [...draftFilters.value]
  emit('update:modelValue', next)
  emit('change')
  popoverVisible.value = false
}

function handleClear() {
  draftFilters.value = []
}
</script>

<template>
  <div class="flow-status-header-wrap">
    <el-popover
      v-model:visible="popoverVisible"
      placement="bottom-start"
      :width="440"
      trigger="click"
      popper-class="my-flow-status-filter-popover"
    >
      <template #reference>
        <button
          type="button"
          class="flow-status-header"
          :class="{ 'is-active': modelValue.length > 0 }"
          @click.stop
        >
          <span>流程状态</span>
          <el-icon class="flow-status-header__icon">
            <Filter />
          </el-icon>
        </button>
      </template>

      <div class="flow-filter-panel" @click.stop>
        <el-checkbox-group v-model="draftFilters" class="flow-filter-groups">
          <div
            v-for="group in filterGroups"
            :key="group.key"
            class="flow-filter-section"
            :class="{ 'flow-filter-section--detail': group.key === 'detail' }"
          >
            <div class="flow-filter-section__title">{{ group.label }}</div>
            <div class="flow-filter-section__options">
              <el-checkbox
                v-for="option in group.options"
                :key="option.value"
                :value="option.value"
                class="flow-filter-checkbox"
              >
                {{ option.label }}
              </el-checkbox>
            </div>
          </div>
        </el-checkbox-group>

        <div class="flow-filter-footer">
          <el-button size="small" link @click="handleClear">清空</el-button>
          <el-button type="primary" size="small" @click="handleConfirm">确定</el-button>
        </div>
      </div>
    </el-popover>

    <span v-if="activeSummary" class="flow-status-header__active">{{ activeSummary }}</span>
  </div>
</template>

<style scoped>
.flow-status-header-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.flow-status-header {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: transparent;
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
  cursor: pointer;
  line-height: 1.2;
}

.flow-status-header.is-active {
  color: var(--el-color-primary);
}

.flow-status-header__icon {
  font-size: 13px;
}

.flow-status-header__active {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-color-primary);
  white-space: nowrap;
}

.flow-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.flow-filter-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.flow-filter-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.flow-filter-section:first-child {
  padding-top: 0;
  border-top: none;
}

.flow-filter-section__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  line-height: 1.5;
}

.flow-filter-section__options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.flow-filter-section--detail .flow-filter-section__options {
  row-gap: 14px;
  max-width: 100%;
}

.flow-filter-checkbox {
  display: inline-flex;
  align-items: center;
  margin-right: 0;
  height: auto;
  min-height: 24px;
  padding: 2px 0;
  white-space: nowrap;
}

.flow-filter-checkbox :deep(.el-checkbox__label) {
  font-size: 13px;
  line-height: 1.5;
  padding-left: 6px;
}

.flow-filter-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
