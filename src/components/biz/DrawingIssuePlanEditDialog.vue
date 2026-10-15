<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ProjectPersonnelCell from '@/components/biz/ProjectPersonnelCell.vue'
import {
  DrawingIssuePlanForm,
  type DrawingIssuePlanEditForm,
  type DrawingIssuePlanRow,
} from '@/models/biz/drawingIssuePlan/DrawingIssuePlanForm'
import type { ProjectRecord } from '@/models/biz/project'
import { ProjectForm } from '@/models/biz/project'

const props = defineProps<{
  modelValue: boolean
  row: DrawingIssuePlanRow | null
  projectMap?: Map<string, ProjectRecord>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [form: DrawingIssuePlanEditForm]
}>()

const form = reactive<DrawingIssuePlanEditForm>({
  projectNo: '',
  componentWeightKg: null,
  materialPrepListIssueDate: '',
  detailPlannedIssueDate: '',
  detailActualIssueDate: '',
  floorDeckPlannedIssueDate: '',
  floorDeckActualIssueDate: '',
  remark: '',
})

const importedProjectNo = ref('')

const projectOptions = computed(() =>
  ProjectForm.sortForDisplay([...props.projectMap?.values() ?? []]),
)

const previewLinkedProject = computed(() => {
  if (!props.projectMap) return null
  return DrawingIssuePlanForm.resolveLinkedProject(form.projectNo, props.projectMap)
})

const previewProjectName = computed(() => {
  if (previewLinkedProject.value?.name?.trim()) {
    return previewLinkedProject.value.name
  }
  return props.row?.projectName || '-'
})

const showImportedHint = computed(
  () =>
    Boolean(importedProjectNo.value) &&
    importedProjectNo.value.trim().toUpperCase() !== form.projectNo.trim().toUpperCase(),
)

const componentWeightTons = computed({
  get: () => DrawingIssuePlanForm.kgToTons(form.componentWeightKg),
  set: (value) => {
    form.componentWeightKg = DrawingIssuePlanForm.tonsToKg(value)
  },
})

const dialogTitle = computed(() => {
  if (!props.row) return '编辑细化发图计划'
  const projectNo = importedProjectNo.value || props.row.projectNo
  return projectNo ? `编辑细化发图计划 · ${projectNo}` : '编辑细化发图计划'
})

watch(
  () => [props.modelValue, props.row] as const,
  ([visible, row]) => {
    if (!visible || !row) return
    importedProjectNo.value = row.projectNo
    Object.assign(form, DrawingIssuePlanForm.createEditForm(row))
    const linked = props.projectMap
      ? DrawingIssuePlanForm.resolveLinkedProject(row.projectNo, props.projectMap)
      : null
    if (linked) {
      form.projectNo = linked.projectNo
    }
  },
)

function closeDialog() {
  emit('update:modelValue', false)
}

function handleSave() {
  const projectNo = form.projectNo.trim()
  if (!projectNo) {
    ElMessage.warning('请选择项目库中的项目号')
    return
  }

  if (props.projectMap && !DrawingIssuePlanForm.resolveLinkedProject(projectNo, props.projectMap)) {
    ElMessage.warning('请从项目库中选择有效的项目号')
    return
  }

  emit('save', { ...form, projectNo })
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="620px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @closed="closeDialog"
  >
    <template v-if="row">
      <el-alert
        v-if="!previewLinkedProject"
        type="warning"
        :closable="false"
        show-icon
        class="plan-edit-alert"
        title="当前项目号未关联项目库"
        description="Excel 导入的项目号可能与系统不一致，请从项目库中选择正确的项目号完成关联。"
      />

      <el-form label-width="128px" class="plan-edit-form" @submit.prevent>
        <el-form-item label="关联项目号" required>
          <el-select
            v-model="form.projectNo"
            filterable
            clearable
            placeholder="搜索并选择项目库中的项目号"
            style="width: 100%"
          >
            <el-option
              v-for="project in projectOptions"
              :key="project.projectNo"
              :label="`${ProjectForm.getDisplayProjectNo(project)} · ${project.name}`"
              :value="project.projectNo"
            />
          </el-select>
          <p v-if="showImportedHint" class="field-hint">
            Excel 导入项目号：{{ importedProjectNo }}
          </p>
        </el-form-item>

        <el-descriptions :column="1" border size="small" class="plan-edit-summary">
          <el-descriptions-item label="项目名称">
            {{ previewProjectName }}
          </el-descriptions-item>
          <el-descriptions-item label="模型重(吨)">
            {{ DrawingIssuePlanForm.getModelWeightDisplay(previewLinkedProject) }}
          </el-descriptions-item>
          <el-descriptions-item label="分配人员">
            <ProjectPersonnelCell :personnel="previewLinkedProject?.assignedPersonnel || []" />
          </el-descriptions-item>
        </el-descriptions>

        <el-form-item label="构件重量/吨">
          <el-input-number
            v-model="componentWeightTons"
            :min="0"
            :precision="3"
            :step="0.1"
            :controls="false"
            class="weight-input"
            placeholder="构件重量"
          />
        </el-form-item>
        <el-form-item label="备料清单发出">
          <el-date-picker
            v-model="form.materialPrepListIssueDate"
            type="date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            clearable
            placeholder="选择备料清单发出日期"
            style="width: 100%"
          />
        </el-form-item>

        <el-divider content-position="left">细化图纸</el-divider>
        <el-form-item label="细化计划发图">
          <el-date-picker
            v-model="form.detailPlannedIssueDate"
            type="date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            clearable
            placeholder="细化图纸计划发出日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="细化实际发图">
          <el-date-picker
            v-model="form.detailActualIssueDate"
            type="date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            clearable
            placeholder="细化图纸实际发出日期"
            style="width: 100%"
          />
        </el-form-item>

        <el-divider content-position="left">排楼承板图纸</el-divider>
        <el-form-item label="楼承板计划发图">
          <el-date-picker
            v-model="form.floorDeckPlannedIssueDate"
            type="date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            clearable
            placeholder="排楼承板图纸计划发出日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="楼承板实际发图">
          <el-date-picker
            v-model="form.floorDeckActualIssueDate"
            type="date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            clearable
            placeholder="排楼承板图纸实际发出日期"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            placeholder="备注"
          />
        </el-form-item>
      </el-form>
    </template>

    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" @click="handleSave">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.plan-edit-alert {
  margin-bottom: 14px;
}

.plan-edit-summary {
  margin-bottom: 16px;
}

.plan-edit-summary :deep(.el-descriptions__label) {
  width: 108px;
}

.plan-edit-form {
  margin-top: 4px;
}

.field-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.weight-input {
  width: 100%;
}

.weight-input :deep(.el-input__inner) {
  text-align: left;
}
</style>
