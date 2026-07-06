<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  createTempTask,
  deleteTempTask,
  fetchTempTaskList,
  updateTempTask,
  type TempTaskRecord,
} from '@/api/tempTasks'
import { fetchPersonnelList } from '@/api/personnel'
import OverflowTooltip from '@/components/biz/OverflowTooltip.vue'
import { TempTaskForm } from '@/models/portal/TempTaskForm'
import type { PersonnelRecord } from '@/models/personnel'
import { getUser } from '@/utils/auth'

const props = defineProps<{
  personnelId: string
}>()

const loading = ref(false)
const saving = ref(false)
const tasks = ref<TempTaskRecord[]>([])
const personnelOptions = ref<PersonnelRecord[]>([])
const dialogVisible = ref(false)
const editingTask = ref<TempTaskRecord | null>(null)

const currentUserPersonnelId = getUser()?.personnelId ?? ''

const form = reactive({
  name: '',
  description: '',
  startTime: '',
  completedAt: '',
  personnelIds: [] as string[],
})

const dialogTitle = computed(() => (editingTask.value ? '编辑临时任务' : '新建临时任务'))

async function loadTasks() {
  if (!props.personnelId) {
    tasks.value = []
    return
  }
  loading.value = true
  try {
    const list = await fetchTempTaskList({ personnelId: props.personnelId })
    tasks.value = TempTaskForm.sortForDisplay(list)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载临时任务失败')
  } finally {
    loading.value = false
  }
}

async function loadPersonnelOptions() {
  try {
    personnelOptions.value = await fetchPersonnelList({ status: 'active' })
  } catch {
    personnelOptions.value = []
  }
}

function resetForm(task: TempTaskRecord | null = null) {
  if (task) {
    form.name = task.name
    form.description = task.description
    form.startTime = task.startTime
    form.completedAt = task.completedAt
    form.personnelIds = [...task.personnelIds]
    return
  }
  const defaults = TempTaskForm.buildCreateDefaults(props.personnelId)
  form.name = defaults.name
  form.description = defaults.description
  form.startTime = defaults.startTime
  form.completedAt = defaults.completedAt
  form.personnelIds = defaults.personnelIds
  if (currentUserPersonnelId && !form.personnelIds.includes(currentUserPersonnelId)) {
    form.personnelIds.unshift(currentUserPersonnelId)
  }
}

function openCreateDialog() {
  editingTask.value = null
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(task: TempTaskRecord) {
  editingTask.value = task
  resetForm(task)
  dialogVisible.value = true
}

async function handleSave() {
  const name = form.name.trim()
  if (!name) {
    ElMessage.warning('请填写任务名称')
    return
  }
  if (!form.startTime) {
    ElMessage.warning('请选择开始时间')
    return
  }
  if (!form.personnelIds.length) {
    ElMessage.warning('请至少选择一名关联人员')
    return
  }

  saving.value = true
  try {
    const payload = {
      name,
      description: form.description.trim(),
      startTime: form.startTime,
      completedAt: form.completedAt,
      personnelIds: form.personnelIds,
    }
    if (editingTask.value) {
      await updateTempTask(editingTask.value.id, payload)
      ElMessage.success('任务已更新')
    } else {
      await createTempTask(payload)
      ElMessage.success('任务已创建')
    }
    dialogVisible.value = false
    await loadTasks()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(task: TempTaskRecord) {
  try {
    await ElMessageBox.confirm(`确定删除任务「${task.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    await deleteTempTask(task.id)
    ElMessage.success('任务已删除')
    await loadTasks()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

watch(
  () => props.personnelId,
  () => {
    void loadTasks()
  },
)

onMounted(() => {
  void loadPersonnelOptions()
  void loadTasks()
})
</script>

<template>
  <section v-loading="loading" class="my-temp-task-panel">
    <div class="my-temp-task-header">
      <span class="my-temp-task-title">我的临时任务</span>
      <el-button type="primary" link @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        新建
      </el-button>
    </div>

    <div v-if="!tasks.length && !loading" class="my-temp-task-empty">
      暂无临时任务
    </div>

    <div v-else class="my-temp-task-list">
      <button
        v-for="task in tasks"
        :key="task.id"
        type="button"
        class="my-temp-task-item"
        @click="openEditDialog(task)"
      >
        <OverflowTooltip :content="task.name">
          <span class="my-temp-task-item__line">
            <span class="my-temp-task-item__name ellipsis-cell">{{ task.name }}</span>
            <span class="my-temp-task-item__date">{{ TempTaskForm.formatShortDate(task.startTime) }}</span>
          </span>
        </OverflowTooltip>
      </button>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="420px"
      destroy-on-close
      append-to-body
    >
      <el-form label-width="100px" label-position="left" @submit.prevent>
        <el-form-item label="任务名称" required>
          <el-input v-model="form.name" maxlength="100" placeholder="请输入任务名称" />
        </el-form-item>

        <el-form-item label="开始时间" required>
          <el-date-picker
            v-model="form.startTime"
            type="datetime"
            placeholder="选择开始时间"
            :value-format="TempTaskForm.DATETIME_FORMAT"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="完成时间">
          <el-date-picker
            v-model="form.completedAt"
            type="datetime"
            placeholder="选择完成时间"
            :value-format="TempTaskForm.DATETIME_FORMAT"
            clearable
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="关联人员">
          <el-select
            v-model="form.personnelIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择关联人员"
            style="width: 100%"
          >
            <el-option
              v-for="person in personnelOptions"
              :key="person.id"
              :label="`${person.name}（${person.team}）`"
              :value="person.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="任务描述（可选）"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="my-temp-task-dialog__footer">
          <el-button
            v-if="editingTask"
            type="danger"
            plain
            @click="handleDelete(editingTask)"
          >
            删除
          </el-button>
          <div class="my-temp-task-dialog__footer-actions">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="saving" @click="handleSave">
              保存
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.my-temp-task-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  height: 100%;
  padding: 4px 8px 4px 2px;
  border-right: 1px solid var(--el-border-color-lighter);
}

.my-temp-task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.my-temp-task-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.my-temp-task-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.my-temp-task-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-right: 2px;
}

.my-temp-task-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  min-height: 26px;
  padding: 3px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-bg-color);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.my-temp-task-item:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-8);
}

.my-temp-task-item :deep(.overflow-tooltip-trigger) {
  width: 100%;
  min-width: 0;
}

.my-temp-task-item__line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.my-temp-task-item__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--el-text-color-primary);
}

.my-temp-task-item__date {
  flex-shrink: 0;
  font-size: 11px;
  line-height: 1.2;
  color: var(--el-text-color-secondary);
}

.my-temp-task-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.my-temp-task-dialog__footer-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
