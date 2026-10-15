<script setup lang="ts">
import { reactive, watch } from 'vue'
import {
  DrawingIssuePlanSettings,
  type DrawingIssuePlanPageSettings,
} from '@/models/biz/drawingIssuePlan/DrawingIssuePlanSettings'

const props = defineProps<{
  modelValue: boolean
  settings: DrawingIssuePlanPageSettings
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [settings: DrawingIssuePlanPageSettings]
}>()

const form = reactive(DrawingIssuePlanSettings.createDefault())

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    Object.assign(form, DrawingIssuePlanSettings.normalize(props.settings))
  },
)

function closeDialog() {
  emit('update:modelValue', false)
}

function handleSave() {
  const next = DrawingIssuePlanSettings.normalize(form)
  emit('save', next)
  closeDialog()
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="细化发图计划页面配置"
    width="420px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @closed="closeDialog"
  >
    <el-form label-width="132px" @submit.prevent>
      <el-form-item label="临近未发提示">
        <div class="setting-field">
          <el-input-number
            v-model="form.approachingDays"
            :min="DrawingIssuePlanSettings.MIN_APPROACHING_DAYS"
            :max="DrawingIssuePlanSettings.MAX_APPROACHING_DAYS"
            :step="1"
            controls-position="right"
          />
          <span class="setting-unit">天</span>
        </div>
        <p class="setting-hint">
          {{ DrawingIssuePlanSettings.formatApproachingHint(form.approachingDays) }}
        </p>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.setting-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-unit {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.setting-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
</style>
