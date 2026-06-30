<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { LeaveEntryDTO } from '@/api/leave'
import { saveLeaveEntry, deleteLeaveEntry, cancelLeaveEntry } from '@/api/leave'
import type { PersonnelRecord } from '@/models/personnel/PersonnelForm'

const props = defineProps<{
  visible: boolean
  /** 要编辑的休假条目；为空且 person 有值时为新建 */
  entry: LeaveEntryDTO | null
  /** 关联的人员信息 */
  person: PersonnelRecord | null
  /** 员工新建请假：简化界面，固定为计划轮休 */
  memberMode?: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [entry: LeaveEntryDTO]
  deleted: [id: string]
}>()

const TYPE_OPTIONS = [
  { label: '年休', value: 'regular' },
  { label: '请假', value: 'request' },
  { label: '延长休假', value: 'extended' },
  { label: '提前休假', value: 'early' },
] as const

const form = reactive({
  type: 'regular' as LeaveEntryDTO['type'],
  startDate: '',
  endDate: '',
  reason: '',
  remark: '',
})

const saving = ref(false)

/** 根据起止日计算天数（含首尾） */
const computedDays = computed(() => {
  if (!form.startDate || !form.endDate) return 0
  const start = new Date(form.startDate)
  const end = new Date(form.endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0
  if (end < start) return 0
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
})

/** 是否为实际已有记录（非计算值） */
const isActual = computed(() => props.entry != null && !props.entry.computed)

const isCreateMode = computed(() => !props.entry && !!props.person)

const simplifyForm = computed(() => props.memberMode === true && isCreateMode.value)

/** 推算/未入库记录：可编辑保存，但不可删除 */
const isComputedEntry = computed(() => props.entry?.computed === true)

const saveButtonLabel = computed(() => {
  if (isCreateMode.value) return '提交请假'
  if (isComputedEntry.value) return '修改并保存'
  return '保存'
})

function resetCreateForm() {
  form.type = 'request'
  form.startDate = ''
  form.endDate = ''
  form.reason = ''
  form.remark = ''
}

const title = computed(() => {
  const name = props.person?.name ?? props.entry?.personnelId ?? ''
  if (isCreateMode.value) {
    return name ? `新建请假 — ${name}` : '新建请假'
  }
  const typeLabel = TYPE_OPTIONS.find((t) => t.value === props.entry?.type)?.label ?? ''
  return `休假编辑 — ${name}${typeLabel ? ` · ${typeLabel}` : ''}`
})

watch(
  () => [props.visible, props.entry] as const,
  ([visible, entry]) => {
    if (!visible) return
    if (entry) {
      form.type = entry.type
      form.startDate = entry.startDate
      form.endDate = entry.endDate
      form.reason = entry.reason || ''
      form.remark = entry.remark || ''
    } else {
      resetCreateForm()
    }
  },
  { immediate: true },
)

async function handleSave() {
  if (!form.startDate || !form.endDate) {
    ElMessage.warning('请选择起止日期')
    return
  }
  if (computedDays.value <= 0) {
    ElMessage.warning('结束日期不能早于开始日期')
    return
  }

  const personnelId = props.entry?.personnelId ?? props.person?.id
  if (!personnelId) return

  const payload: Partial<LeaveEntryDTO> = {
    id: isActual.value ? props.entry!.id : undefined,
    personnelId,
    type: form.type,
    startDate: form.startDate,
    endDate: form.endDate,
    plannedDays: computedDays.value,
    reason: form.reason || undefined,
    remark: form.remark || undefined,
  }

  saving.value = true
  try {
    const result = await saveLeaveEntry(payload)
    ElMessage.success(
      isCreateMode.value ? '请假已提交' : isComputedEntry.value ? '休假记录已修改并保存' : '休假记录已保存',
    )
    emit('saved', result)
    emit('update:visible', false)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleCancel() {
  if (!props.entry) return
  try {
    await ElMessageBox.confirm(
      `确认取消 ${props.person?.name ?? ''} 的这段休假？取消后状态变为「已取消」，不会删除记录。`,
      '取消休假',
      { confirmButtonText: '确认取消', cancelButtonText: '返回', type: 'warning' },
    )
    saving.value = true
    await cancelLeaveEntry(props.entry.id)
    ElMessage.success('已取消')
    emit('deleted', props.entry.id)
    emit('update:visible', false)
  } catch {
    // 用户取消操作
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!props.entry) return
  try {
    await ElMessageBox.confirm(
      `确认永久删除 ${props.person?.name ?? ''} 的这段休假记录？此操作不可撤销。`,
      '删除休假',
      { confirmButtonText: '确认删除', cancelButtonText: '返回', type: 'warning' },
    )
    saving.value = true
    await deleteLeaveEntry(props.entry.id)
    ElMessage.success('已删除')
    emit('deleted', props.entry.id)
    emit('update:visible', false)
  } catch {
    // 用户取消操作
  } finally {
    saving.value = false
  }
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="460px"
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <el-form label-position="top" size="default">
      <el-form-item v-if="!simplifyForm" label="休假类型">
        <el-select v-model="form.type" style="width: 100%">
          <el-option
            v-for="opt in TYPE_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="开始日期">
            <el-date-picker
              v-model="form.startDate"
              type="date"
              placeholder="选择开始日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="结束日期">
            <el-date-picker
              v-model="form.endDate"
              type="date"
              placeholder="选择结束日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item :label="simplifyForm ? '请假天数' : undefined">
        <span class="days-badge" :class="{ 'days-badge--large': simplifyForm }">
          <template v-if="computedDays > 0">
            共 <strong>{{ computedDays }}</strong> 天
          </template>
          <template v-else>
            请选择起止日期
          </template>
          <template v-if="entry && !isCreateMode">
            （原 {{ entry.plannedDays }} 天）
          </template>
        </span>
      </el-form-item>

      <el-form-item label="原因">
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="2"
          placeholder="休假原因（选填）"
        />
      </el-form-item>

      <el-form-item label="备注">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          placeholder="备注（选填）"
        />
      </el-form-item>

      <div v-if="entry" class="entry-meta">
        <span v-if="entry.status" class="meta-tag">{{ entry.status }}</span>
        <span v-if="entry.createdAt">创建于 {{ entry.createdAt }}</span>
        <span v-if="entry.computed" class="computed-hint">（当前为计算值，保存后将写入数据库）</span>
      </div>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-left">
          <el-button
            v-if="isActual && entry?.status !== 'cancelled'"
            type="warning"
            plain
            @click="handleCancel"
          >
            取消休假
          </el-button>
          <el-button
            v-if="isActual"
            type="danger"
            plain
            @click="handleDelete"
          >
            删除
          </el-button>
        </div>
        <div class="footer-right">
          <el-button @click="handleClose">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">
            {{ saveButtonLabel }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.days-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 14px;
}

.days-badge--large {
  padding: 8px 16px;
  font-size: 15px;
}

.days-badge--large strong {
  font-size: 20px;
  margin: 0 2px;
}

.entry-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.meta-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--el-fill-color);
  font-size: 11px;
  text-transform: uppercase;
}

.computed-hint {
  color: var(--el-color-warning);
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.footer-left {
  display: flex;
  gap: 8px;
}

.footer-right {
  display: flex;
  gap: 8px;
}
</style>
