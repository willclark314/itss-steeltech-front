<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { copyProject, fetchProjectList, splitProject, updateProject } from '@/api/projects'
import { fetchPersonnelList } from '@/api/personnel'
import { fetchSystemConfig } from '@/api/system'
import PersonnelAssignSelect from '@/components/biz/PersonnelAssignSelect.vue'
import ProjectDetailWorkflowPanel from '@/components/biz/ProjectDetailWorkflowPanel.vue'
import ProjectContactFormSelect from '@/components/biz/ProjectContactFormSelect.vue'
import TagSelect from '@/components/biz/TagSelect.vue'
import { DetailWorkflowForm, ProjectForm } from '@/models/biz/project'
import { ProjectWorkPath } from '@/models/biz/ProjectWorkPath'
import { BusinessSystemConfig } from '@/models/biz'
import type { LocalWorkPathConfig } from '@/models/biz'
import type { PersonnelRecord } from '@/models/personnel'
import type { ProjectAssignee, ProjectNatureCode, ProjectRecord } from '@/models/biz/project'
import type { SplitProjectResult } from '@/api/projects'

const visible = defineModel<boolean>('visible', { default: false })

const props = defineProps<{
  record: ProjectRecord | null
}>()

const emit = defineEmits<{
  saved: [record: ProjectRecord, previousProjectNo?: string]
  split: [result: SplitProjectResult]
}>()

type DialogMode = 'edit' | 'copy'

const submitting = ref(false)
const splitting = ref(false)
const dialogMode = ref<DialogMode>('edit')
const copySourceNo = ref<string | null>(null)
const formRef = ref<FormInstance>()
const form = reactive(ProjectForm.createEmptyForm())
const naturesSnapshot = ref<ProjectNatureCode[]>([])
const formRules = ProjectForm.FORM_RULES
const statusFormOptions = ProjectForm.STATUS_FORM_OPTIONS
const natureOptions = ProjectForm.NATURE_OPTIONS
const structureTypeOptions = ProjectForm.STRUCTURE_TYPE_OPTIONS
const personnelOptions = ref<PersonnelRecord[]>([])
const editingAssignedPersonnel = ref<ProjectAssignee[]>([])
const localWorkPathConfig = ref<LocalWorkPathConfig>({
  ...BusinessSystemConfig.LOCAL_WORK_PATH,
})

const designWorkPathPreview = computed(() =>
  ProjectForm.buildLocalWorkPathFull(form.designWorkPath, localWorkPathConfig.value),
)
const detailWorkPathPreview = computed(() =>
  ProjectForm.buildLocalWorkPathFull(form.detailWorkPath, localWorkPathConfig.value),
)

const dialogTitle = computed(() => {
  if (dialogMode.value === 'copy') return '复制为新项目'
  if (props.record) {
    return `编辑项目 · ${ProjectForm.getDisplayProjectNo(props.record)}`
  }
  return '编辑项目'
})

const currentRecord = ref<ProjectRecord | null>(null)
const usesDetailWorkflow = computed(() =>
  currentRecord.value
    ? DetailWorkflowForm.needsDetailWorkflow(currentRecord.value.natures)
    : false,
)

function syncNaturesSnapshot() {
  naturesSnapshot.value = [...form.natures]
}

function isSameNatures(left: ProjectNatureCode[], right: ProjectNatureCode[]) {
  if (left.length !== right.length) return false
  return left.every((item) => right.includes(item))
}

function syncWorkPathsForNatureChange() {
  const nextNatures = [...form.natures]
  if (isSameNatures(nextNatures, naturesSnapshot.value)) return

  const synced = ProjectWorkPath.syncWorkPathsForNatures(
    {
      ...form,
      natures: nextNatures,
      isJiagongdan: currentRecord.value?.isJiagongdan ?? false,
      receivedDate: currentRecord.value?.receivedDate ?? form.plannedStartDate ?? '',
    },
    naturesSnapshot.value,
    localWorkPathConfig.value.pathPatterns,
  )
  form.designWorkPath = synced.designWorkPath
  form.detailWorkPath = synced.detailWorkPath
  form.localWorkPath = synced.localWorkPath
  naturesSnapshot.value = nextNatures
}

async function loadOptions() {
  try {
    personnelOptions.value = await fetchPersonnelList({ status: 'active' })
  } catch {
    personnelOptions.value = []
  }
  try {
    const systemConfig = await fetchSystemConfig()
    localWorkPathConfig.value = { ...systemConfig.localWorkPath }
  } catch {
    // 无系统配置权限时保留默认路径预览，不影响分配人员
  }
}

function resetForm(record: ProjectRecord | null) {
  dialogMode.value = 'edit'
  copySourceNo.value = null
  currentRecord.value = record ? ProjectForm.cloneRecord(record) : null
  if (!record) {
    Object.assign(form, ProjectForm.createEmptyForm())
    editingAssignedPersonnel.value = []
    naturesSnapshot.value = []
    return
  }
  editingAssignedPersonnel.value = record.assignedPersonnel.map((person) => ({ ...person }))
  Object.assign(form, ProjectForm.createFormFromRecord(record))
  syncNaturesSnapshot()
}

watch(
  () => [visible.value, props.record] as const,
  ([open, record]) => {
    if (!open) return
    resetForm(record)
    void loadOptions()
  },
)

watch(
  () => [...form.natures],
  (natures) => {
    if (!natures.includes(ProjectForm.NATURE.DESIGN)) {
      form.designCompleted = false
    }
    if (!ProjectForm.hasDetailGroupNature({ natures })) {
      form.detailCompleted = false
    }
    syncWorkPathsForNatureChange()
  },
)

watch(
  () => form.drawingIssueEnabled,
  (enabled) => {
    if (!enabled) {
      form.drawingIssueYearMonth = ''
    }
  },
)

function handleClosed() {
  dialogMode.value = 'edit'
  copySourceNo.value = null
  currentRecord.value = null
  Object.assign(form, ProjectForm.createEmptyForm())
  naturesSnapshot.value = []
  editingAssignedPersonnel.value = []
  formRef.value?.clearValidate()
}

function handleWorkflowUpdated(record: ProjectRecord) {
  currentRecord.value = ProjectForm.cloneRecord(record)
  form.detailCompleted = record.detailCompleted
  form.status = record.status
  emit('saved', record)
}

async function openCopyMode() {
  if (!props.record) return
  dialogMode.value = 'copy'
  copySourceNo.value = props.record.projectNo
  try {
    const result = await fetchProjectList({ all: true })
    Object.assign(
      form,
      ProjectForm.createFormForCopy(
        props.record,
        result.list.map((item) => item.projectNo),
      ),
    )
    syncNaturesSnapshot()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目列表失败')
  }
}

async function handleSplit() {
  if (!props.record) return

  try {
    await ElMessageBox.confirm(
      '将把当前项目拆分为两个独立项目：原项目保留联系单，新项目不复制联系单。若项目号尚无 -1 后缀，将自动改名为「根号-1」并创建「根号-2」。是否继续？',
      '拆分项目',
      { type: 'warning', confirmButtonText: '拆分', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  splitting.value = true
  try {
    const result = await splitProject(props.record.projectNo)
    emit('split', result)
    visible.value = false
    ElMessage.success(`已拆分：${result.original.projectNo}、${result.clone.projectNo}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '拆分项目失败')
  } finally {
    splitting.value = false
  }
}

async function handleSubmit() {
  if (!props.record) return

  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const primaryWorkPath = form.detailWorkPath || form.designWorkPath
    if (dialogMode.value === 'copy' && copySourceNo.value) {
      const created = await copyProject(copySourceNo.value, {
        projectNo: form.projectNo.trim(),
        name: form.name.trim(),
        status: form.status,
        designCompleted: form.designCompleted,
        detailCompleted: form.detailCompleted,
        natures: [...form.natures],
        tagIds: [...form.tagIds],
        assignedPersonnelIds: [...form.assignedPersonnelIds],
        plannedStartDate: form.plannedStartDate,
        plannedEndDate: form.plannedEndDate,
        actualStartDate: form.actualStartDate,
        actualEndDate: form.actualEndDate,
        designWorkPath: form.designWorkPath,
        detailWorkPath: form.detailWorkPath,
        localWorkPath: primaryWorkPath,
        drawingIssueEnabled: form.drawingIssueEnabled,
        drawingIssueYearMonth: form.drawingIssueYearMonth,
        structureType: form.structureType || '',
        estimatedWeightTons: form.estimatedWeightTons,
        clearActualDates: true,
      })
      emit('saved', created)
      visible.value = false
      ElMessage.success(`已复制为新项目：${created.projectNo}`)
      return
    }

    const updated = await updateProject(props.record.projectNo, {
      projectNo: form.projectNo.trim(),
      name: form.name.trim(),
      status: form.status,
      designCompleted: form.designCompleted,
      detailCompleted: form.detailCompleted,
      natures: [...form.natures],
      tagIds: [...form.tagIds],
      assignedPersonnelIds: [...form.assignedPersonnelIds],
      contactFormIds: [...form.contactFormIds],
      plannedStartDate: form.plannedStartDate,
      plannedEndDate: form.plannedEndDate,
      actualStartDate: form.actualStartDate,
      actualEndDate: form.actualEndDate,
      designWorkPath: form.designWorkPath,
      detailWorkPath: form.detailWorkPath,
      localWorkPath: primaryWorkPath,
      drawingIssueEnabled: form.drawingIssueEnabled,
      drawingIssueYearMonth: form.drawingIssueYearMonth,
      structureType: form.structureType || '',
      estimatedWeightTons: form.estimatedWeightTons,
    })
    emit('saved', updated, props.record.projectNo)
    visible.value = false
    ElMessage.success('项目已更新')
  } catch (error) {
    ElMessage.error(
      error instanceof Error
        ? error.message
        : dialogMode.value === 'copy'
          ? '复制项目失败'
          : '更新项目失败',
    )
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="760px"
    destroy-on-close
    @closed="handleClosed"
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
      <el-form-item label="项目号" prop="projectNo">
        <el-input v-model="form.projectNo" placeholder="请输入项目号" />
      </el-form-item>
      <el-form-item label="项目名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入项目名称" />
      </el-form-item>
      <el-form-item v-if="dialogMode === 'edit'" label="关联联系单">
        <ProjectContactFormSelect
          v-model="form.contactFormIds"
          :display-project-no="ProjectForm.getDisplayProjectNo(currentRecord || { projectNo: form.projectNo, baseProjectNo: form.projectNo })"
        />
      </el-form-item>
      <el-form-item label="本地路径">
        <div class="local-path-group">
          <template v-if="form.natures.includes(ProjectForm.NATURE.DESIGN)">
            <div class="local-path-item">
              <div class="local-path-item__label">设计归档路径</div>
              <el-input
                v-model="form.designWorkPath"
                type="textarea"
                :rows="2"
                placeholder="设计归档相对路径"
                class="local-path-input"
              />
              <div class="form-hint">
                全局配置：{{ localWorkPathConfig.ip }}
                <template v-if="designWorkPathPreview">
                  · 完整路径 {{ designWorkPathPreview }}
                </template>
              </div>
            </div>
          </template>
          <template v-if="ProjectForm.hasDetailGroupNature(form)">
            <div class="local-path-item">
              <div class="local-path-item__label">细化归档路径</div>
              <el-input
                v-model="form.detailWorkPath"
                type="textarea"
                :rows="2"
                placeholder="细化归档相对路径"
                class="local-path-input"
              />
              <div class="form-hint">
                全局配置：{{ localWorkPathConfig.ip }}
                <template v-if="detailWorkPathPreview">
                  · 完整路径 {{ detailWorkPathPreview }}
                </template>
              </div>
            </div>
          </template>
          <div v-if="!form.natures.length" class="form-hint">
            请先选择项目性质，再填写对应的设计归档路径或细化归档路径。
          </div>
        </div>
      </el-form-item>
      <el-form-item label="项目性质">
        <el-checkbox-group v-model="form.natures">
          <el-checkbox
            v-for="item in natureOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="标签">
        <TagSelect v-model="form.tagIds" />
      </el-form-item>
      <el-form-item label="分配人员">
        <PersonnelAssignSelect
          v-model="form.assignedPersonnelIds"
          :personnel-options="personnelOptions"
          :extra-assignees="editingAssignedPersonnel"
          placeholder="从人员系统选择分配人员"
        />
      </el-form-item>
      <el-form-item label="流程状态">
        <el-radio-group v-model="form.status">
          <el-radio
            v-for="item in statusFormOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="完成状态">
        <div class="completion-status-grid">
          <el-checkbox v-model="form.designCompleted" :disabled="!form.natures.includes(ProjectForm.NATURE.DESIGN)">
            设计已完成
          </el-checkbox>
          <el-checkbox
            v-if="!DetailWorkflowForm.needsDetailWorkflow(form.natures)"
            v-model="form.detailCompleted"
            :disabled="!ProjectForm.hasDetailGroupNature(form)"
          >
            细化已完成
          </el-checkbox>
        </div>
      </el-form-item>
      <el-form-item v-if="dialogMode === 'edit' && currentRecord && usesDetailWorkflow" label="细化流程">
        <ProjectDetailWorkflowPanel
          :record="currentRecord"
          @updated="handleWorkflowUpdated"
        />
      </el-form-item>
      <el-form-item label="发图计划">
        <div class="drawing-issue-fields">
          <el-checkbox v-model="form.drawingIssueEnabled">
            是否发图
          </el-checkbox>
          <el-date-picker
            v-model="form.drawingIssueYearMonth"
            type="month"
            placeholder="选择发图年月"
            value-format="YYYY-MM"
            format="YYYY年M月"
            :disabled="!form.drawingIssueEnabled"
            style="width: 180px"
          />
        </div>
      </el-form-item>
      <el-form-item label="结构形式">
        <el-select
          v-model="form.structureType"
          clearable
          placeholder="选择结构形式"
          style="width: 100%"
        >
          <el-option
            v-for="item in structureTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="预估重量">
        <el-input-number
          v-model="form.estimatedWeightTons"
          :min="0"
          :precision="3"
          :controls="false"
          placeholder="吨"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="计划开始">
        <el-date-picker
          v-model="form.plannedStartDate"
          type="date"
          placeholder="选择计划开始日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="计划结束">
        <el-date-picker
          v-model="form.plannedEndDate"
          type="date"
          placeholder="选择计划结束日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="实际开始">
        <el-date-picker
          v-model="form.actualStartDate"
          type="date"
          placeholder="选择实际开始日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="实际结束">
        <el-date-picker
          v-model="form.actualEndDate"
          type="date"
          placeholder="选择实际结束日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="project-dialog-footer">
        <div v-if="dialogMode === 'edit' && record" class="project-dialog-footer__left">
          <el-button @click="openCopyMode">复制为新项目</el-button>
          <el-button :loading="splitting" @click="handleSplit">拆分项目</el-button>
        </div>
        <div class="project-dialog-footer__right">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ dialogMode === 'edit' ? '保存' : '复制' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.local-path-input :deep(.el-textarea__inner) {
  font-family: var(--el-font-family);
  line-height: 1.5;
  word-break: break-all;
}

.local-path-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.local-path-item {
  width: 100%;
}

.local-path-item__label {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.form-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.completion-status-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
}

.drawing-issue-fields {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.project-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.project-dialog-footer__left,
.project-dialog-footer__right {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
