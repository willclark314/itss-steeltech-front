<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Filter } from '@element-plus/icons-vue'
import { ProjectForm } from '@/models/biz/project'

const modelValue = defineModel<string[]>({ default: () => [] })

const emit = defineEmits<{
  change: []
}>()

const popoverVisible = ref(false)
const draftFilters = ref<string[]>([])

const natureOptions = ProjectForm.NATURE_OPTIONS

const activeSummary = computed(() => {
  if (!modelValue.value.length) return ''
  if (modelValue.value.length === 1) {
    return natureOptions.find((item) => item.value === modelValue.value[0])?.label ?? ''
  }
  return `已选 ${modelValue.value.length} 项`
})

watch(popoverVisible, (visible) => {
  if (visible) {
    draftFilters.value = [...modelValue.value]
  }
})

function handleConfirm() {
  const next = [...draftFilters.value]
  modelValue.value = next
  emit('change')
  popoverVisible.value = false
}

function handleClear() {
  draftFilters.value = []
}
</script>

<template>
  <div class="nature-header-wrap">
    <el-popover
      v-model:visible="popoverVisible"
      placement="bottom-start"
      :width="200"
      trigger="click"
      popper-class="biz-nature-filter-popover"
    >
      <template #reference>
        <button
          type="button"
          class="nature-column-header"
          :class="{ 'is-active': modelValue.length > 0 }"
          :title="modelValue.length ? `已筛选：${activeSummary}` : undefined"
          @click.stop
        >
          <span>项目性质</span>
          <el-icon class="nature-column-header__icon">
            <Filter />
          </el-icon>
        </button>
      </template>

      <div class="nature-filter-panel" @click.stop>
        <el-checkbox-group v-model="draftFilters" class="nature-filter-list">
          <el-checkbox
            v-for="item in natureOptions"
            :key="item.value"
            :value="item.value"
            class="nature-filter-checkbox"
          >
            {{ item.label }}
          </el-checkbox>
        </el-checkbox-group>

        <div class="nature-filter-footer">
          <el-button size="small" link @click="handleClear">清空</el-button>
          <el-button type="primary" size="small" @click="handleConfirm">确定</el-button>
        </div>
      </div>
    </el-popover>

    <span v-if="activeSummary" class="nature-column-header__active">{{ activeSummary }}</span>
  </div>
</template>

<style scoped>
.nature-header-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.nature-column-header {
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

.nature-column-header.is-active {
  color: var(--el-color-primary);
}

.nature-column-header__icon {
  font-size: 13px;
}

.nature-column-header__active {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-color-primary);
  white-space: nowrap;
}

.nature-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nature-filter-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nature-filter-checkbox {
  display: flex;
  align-items: center;
  margin-right: 0;
  height: auto;
  min-height: 24px;
  padding: 2px 0;
}

.nature-filter-checkbox :deep(.el-checkbox__label) {
  font-size: 13px;
  line-height: 1.5;
  padding-left: 6px;
}

.nature-filter-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
