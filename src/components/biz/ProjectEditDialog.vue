<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { updateProject } from '@/api/projects'
import { fetchPersonnelList } from '@/api/personnel'
import { fetchSystemConfig } from '@/api/system'
import ProjectDetailWorkflowPanel from '@/components/biz/ProjectDetailWorkflowPanel.vue'
import TagSelect from '@/components/biz/TagSelect.vue'
import { DetailWorkflowForm, ProjectForm } from '@/models/biz/project'
import { BusinessSystemConfig } from '@/models/biz'
import type { LocalWorkPathConfig } from '@/models/biz'
import type { PersonnelRecord } from '@/models/personnel'
import type { ProjectAssignee, ProjectRecord } from '@/models/biz/project'

const visible = defineModel<boolean>('visible', { default: false })

const props = defineProps<{
  record: ProjectRecord | null
}>()

const emit = defineEmits<{
  saved: [record: ProjectRecord]
}>()

const submitting = ref(false)
const formRef = ref<FormInstance>()
const form = reactive(ProjectForm.createEmptyForm())
const formRules = ProjectForm.FORM_RULES
const statusFormOptions = ProjectForm.STATUS_FORM_OPTIONS
const natureOptions = ProjectForm.NATURE_OPTIONS
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

const dialogTitle = computed(() =>
  props.record
    ? `编辑项目 · ${ProjectForm.getDisplayProjectNo(props.record)}`
    : '编辑项目',
)

const currentRecord = ref<ProjectRecord | null>(null)
const usesDetailWorkflow = computed(() =>
  currentRecord.value
    ? DetailWorkflowForm.needsDetailWorkflow(currentRecord.value.natures)
    : false,
)

type PersonnelSelectOption = {
  id: string
  name: string
  team: string
}

const personnelSelectOptions = computed((): PersonnelSelectOption[] => {
  const optionMap = new Map<string, PersonnelSelectOption>()

  for (const person of personnelOptions.value) {
    optionMap.set(person.id, { id: person.id, name: person.name, team: person.team })
  }

  for (const person of editingAssignedPersonnel.value) {
    if (!optionMap.has(person.id)) {
      optionMap.set(person.id, { id: person.id, name: person.name, team: person.team })
    }
  }

  return [...optionMap.values()].sort((a, b) => {
    const teamCompare = a.team.localeCompare(b.team, 'zh-CN')
    return teamCompare !== 0 ? teamCompare : a.name.localeCompare(b.name, 'zh-CN')
  })
})

async function loadOptions() {
  try {
    const [personnel, systemConfig] = await Promise.all([
      fetchPersonnelList(),
      fetchSystemConfig(),
    ])
    personnelOptions.value = personnel
    localWorkPathConfig.value = { ...systemConfig.localWorkPath }
  } catch {
    personnelOptions.value = []
  }
}

function resetForm(record: ProjectRecord | null) {
  currentRecord.value = record ? ProjectForm.cloneRecord(record) : null
  if (!record) {
    Object.assign(form, ProjectForm.createEmptyForm())
    editingAssignedPersonnel.value = []
    return
  }
  editingAssignedPersonnel.value = record.assignedPersonnel.map((person) => ({ ...person }))
  Object.assign(form, ProjectForm.createFormFromRecord(record))
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
  },
)

function handleClosed() {
  currentRecord.value = null
  Object.assign(form, ProjectForm.createEmptyForm())
  editingAssignedPersonnel.value = []
  formRef.value?.clearValidate()
}

function handleWorkflowUpdated(record: ProjectRecord) {
  currentRecord.value = ProjectForm.cloneRecord(record)
  form.detailCompleted = record.detailCompleted
  form.status = record.status
  emit('saved', record)
}

async function handleSubmit() {
  if (!props.record) return

  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const primaryWorkPath = form.detailWorkPath || form.designWorkPath
    const updated = await updateProject(props.record.projectNo, {
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
    })
    emit('saved', updated)
    visible.value = false
    ElMessage.success('项目已更新')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新项目失败')
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
        <el-input
          :model-value="props.record ? ProjectForm.getDisplayProjectNo(props.record) : form.projectNo"
          disabled
        />
      </el-form-item>
      <el-form-item label="项目名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入项目名称" />
      </el-form-item>
      <el-form-item label="本地路径">
        <div class="local-path-group">
          <template v-if="form.natures.includes(ProjectForm.NATURE.DESIGN)">
            <div class="local-path-item">
              <div class="local-path-item__label">设计路径</div>
              <el-input
                v-model="form.designWorkPath"
                type="textarea"
                :rows="2"
                placeholder="设计相对路径"
                class="local-path-input"
              />
              <div class="form-hint">
                全局配置：{{ localWorkPathConfig.ip }} · {{ localWorkPathConfig.drive }} 盘
                <template v-if="designWorkPathPreview">
                  · 完整路径 {{ designWorkPathPreview }}
                </template>
              </div>
            </div>
          </template>
          <template v-if="ProjectForm.hasDetailGroupNature(form)">
            <div class="local-path-item">
              <div class="local-path-item__label">细化路径</div>
              <el-input
                v-model="form.detailWorkPath"
                type="textarea"
                :rows="2"
                placeholder="细化相对路径"
                class="local-path-input"
              />
              <div class="form-hint">
                全局配置：{{ localWorkPathConfig.ip }} · {{ localWorkPathConfig.drive }} 盘
                <template v-if="detailWorkPathPreview">
                  · 完整路径 {{ detailWorkPathPreview }}
                </template>
              </div>
            </div>
          </template>
          <div v-if="!form.natures.length" class="form-hint">
            请先选择项目性质，再填写对应的设计路径或细化路径。
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
        <el-select
          v-model="form.assignedPersonnelIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="从人员系统选择分配人员"
          style="width: 100%"
        >
          <el-option
            v-for="person in personnelSelectOptions"
            :key="person.id"
            :label="`${person.name} · ${person.team}`"
            :value="person.id"
          />
        </el-select>
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
      <el-form-item v-if="currentRecord && usesDetailWorkflow" label="细化流程">
        <ProjectDetailWorkflowPanel
          :record="currentRecord"
          :preview-natures="form.natures"
          @updated="handleWorkflowUpdated"
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
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
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
</style>
