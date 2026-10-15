<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance } from 'element-plus'
import { fetchProjectList } from '@/api/projects'
import {
  ProjectModelForm,
  type ProjectModelFormState,
  type ProjectModelRecord,
} from '@/models/biz/projectModel/ProjectModelForm'

const props = defineProps<{
  visible: boolean
  record: ProjectModelRecord | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [form: ProjectModelFormState]
}>()

const formRef = ref<FormInstance>()
const form = reactive(ProjectModelForm.createEmptyForm())
const submitting = ref(false)
const projectSearchLoading = ref(false)
const projectOptions = ref<{ value: string; label: string }[]>([])

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const dialogTitle = computed(() => (props.record ? '编辑项目模型' : '新建项目模型'))

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return
    Object.assign(form, props.record ? ProjectModelForm.fromRecord(props.record) : ProjectModelForm.createEmptyForm())
    submitting.value = false
    if (form.projectNo) {
      projectOptions.value = [
        {
          value: form.projectNo,
          label: props.record?.projectName
            ? `${form.projectNo} · ${props.record.projectName}`
            : form.projectNo,
        },
      ]
    } else {
      projectOptions.value = []
    }
    await searchProjects('')
  },
)

async function searchProjects(query: string) {
  projectSearchLoading.value = true
  try {
    const result = await fetchProjectList({
      keyword: query.trim() || undefined,
      natures: ['detail', 'detail_issue'],
      page: 1,
      pageSize: 30,
    })
    const options = result.list.map((item) => ({
      value: item.projectNo,
      label: `${item.projectNo} · ${item.name}${item.isJiagongdan ? '（甲供）' : ''}`,
    }))
    if (form.projectNo && !options.some((item) => item.value === form.projectNo)) {
      options.unshift({
        value: form.projectNo,
        label: props.record?.projectName
          ? `${form.projectNo} · ${props.record.projectName}`
          : form.projectNo,
      })
    }
    projectOptions.value = options
  } catch {
    // 保留已有选项
  } finally {
    projectSearchLoading.value = false
  }
}

async function handleConfirm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  emit('save', { ...form })
}

function handleClosed() {
  formRef.value?.resetFields()
  submitting.value = false
}

defineExpose({
  setSubmitting(value: boolean) {
    submitting.value = value
  },
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="640px"
    destroy-on-close
    @closed="handleClosed"
  >
    <el-form ref="formRef" :model="form" :rules="ProjectModelForm.FORM_RULES" label-width="100px">
      <el-form-item label="关联项目" prop="projectNo">
        <el-select
          v-model="form.projectNo"
          filterable
          remote
          clearable
          :remote-method="searchProjects"
          :loading="projectSearchLoading"
          placeholder="搜索细化项目号 / 名称"
          style="width: 100%"
        >
          <el-option
            v-for="item in projectOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="模型类型" prop="modelType">
        <el-radio-group v-model="form.modelType">
          <el-radio
            v-for="item in ProjectModelForm.MODEL_TYPE_FORM_OPTIONS"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="模型名称" prop="name">
        <el-input v-model="form.name" placeholder="如：主厂模型、甲供楼梯模型" maxlength="128" show-word-limit />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="form.status" style="width: 180px">
          <el-option
            v-for="item in ProjectModelForm.STATUS_FORM_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="模型重量(t)">
        <el-input-number
          v-model="form.modelWeightTons"
          :min="0"
          :precision="3"
          :controls="false"
          placeholder="可选"
          style="width: 180px"
        />
      </el-form-item>
      <el-form-item label="模型路径">
        <el-input v-model="form.modelPath" placeholder="Tekla 模型相对路径或本地路径（可选）" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="form.seq" :min="0" :controls="true" style="width: 180px" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="3"
          placeholder="可选备注"
          maxlength="500"
          show-word-limit
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleConfirm">保存</el-button>
    </template>
  </el-dialog>
</template>
