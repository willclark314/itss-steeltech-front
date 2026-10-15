<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { createPersonnel } from '@/api/personnel'
import { PersonnelForm } from '@/models/personnel'
import type { PersonnelRecord } from '@/models/personnel'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [record: PersonnelRecord]
  closed: []
}>()

const submitting = ref(false)
const formRef = ref<FormInstance>()
const form = reactive(PersonnelForm.createEmptyForm())

const statusEditOptions = PersonnelForm.STATUS_OPTIONS.filter((item) => item.value)
const teamOptions = PersonnelForm.TEAM_OPTIONS
const nationalityOptions = PersonnelForm.NATIONALITY_OPTIONS
const genderOptions = PersonnelForm.GENDER_OPTIONS
const formRules = PersonnelForm.FORM_RULES

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    Object.assign(form, PersonnelForm.createEmptyForm())
  },
)

function closeDialog() {
  emit('update:modelValue', false)
}

function handleDialogClosed() {
  Object.assign(form, PersonnelForm.createEmptyForm())
  formRef.value?.clearValidate()
  emit('closed')
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = PersonnelForm.createFormFromRecord(form)
    payload.workshop = PersonnelForm.resolveWorkshopByTeam(payload.team, payload.workshop)
    const created = await createPersonnel(payload)
    emit('created', created)
    closeDialog()
    ElMessage.success('人员已创建')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建人员失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="新建人员"
    width="720px"
    top="4vh"
    class="personnel-form-dialog"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @closed="handleDialogClosed"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="formRules"
      label-width="110px"
      class="personnel-create-form"
    >
      <div class="form-group-title">基本信息</div>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="姓名" prop="name">
            <el-input v-model="form.name" placeholder="请输入姓名" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="工号" prop="employeeNo">
            <el-input v-model="form.employeeNo" placeholder="请输入工号" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="性别" prop="gender">
            <el-select v-model="form.gender" clearable style="width: 100%">
              <el-option v-for="item in genderOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="出生日期" prop="birthDate">
            <el-input v-model="form.birthDate" placeholder="YYYY-MM-DD" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="年龄" prop="age">
            <el-input-number v-model="form.age" :min="0" :max="100" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="民族" prop="ethnicity">
            <el-input v-model="form.ethnicity" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="国籍" prop="nationality">
            <el-select v-model="form.nationality" style="width: 100%">
              <el-option
                v-for="item in nationalityOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="籍贯" prop="nativePlace">
            <el-input v-model="form.nativePlace" />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="家庭住址" prop="homeAddress">
            <el-input v-model="form.homeAddress" type="textarea" :rows="2" />
          </el-form-item>
        </el-col>
      </el-row>

      <div class="form-group-title">组织信息</div>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="岗位" prop="position">
            <el-input v-model="form.position" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="车间/科室">
            <el-input
              :model-value="PersonnelForm.resolveWorkshopByTeam(form.team, form.workshop)"
              disabled
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="班组" prop="team">
            <el-select v-model="form.team" clearable placeholder="可选" style="width: 100%">
              <el-option
                v-for="item in teamOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="宿舍号" prop="dormitoryNo">
            <el-input v-model="form.dormitoryNo" placeholder="如 B3_603、N1_302" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态" prop="status">
            <el-select v-model="form.status" style="width: 100%">
              <el-option
                v-for="item in statusEditOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <div class="form-group-title">证件信息</div>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="身份证号" prop="idCardNo">
            <el-input v-model="form.idCardNo" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="护照号" prop="passportNo">
            <el-input v-model="form.passportNo" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="护照有效期" prop="passportExpiry">
            <el-input v-model="form.passportExpiry" placeholder="YYYY-MM-DD" />
          </el-form-item>
        </el-col>
      </el-row>

      <div class="form-group-title">教育背景</div>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="学历" prop="education">
            <el-input v-model="form.education" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="毕业院校" prop="graduationSchool">
            <el-input v-model="form.graduationSchool" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="所学专业" prop="major">
            <el-input v-model="form.major" />
          </el-form-item>
        </el-col>
      </el-row>

      <div class="form-group-title">联系方式</div>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="印尼号码" prop="indonesiaPhone">
            <el-input v-model="form.indonesiaPhone" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="国内号码" prop="domesticPhone">
            <el-input v-model="form.domesticPhone" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">提交</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.personnel-create-form {
  max-height: calc(80vh - 160px);
  overflow-y: auto;
  padding-right: 8px;
}

.form-group-title {
  margin: 16px 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.form-group-title:first-child {
  margin-top: 0;
}

.personnel-create-form :deep(.el-form-item) {
  margin-bottom: 14px;
}
</style>

<style>
.personnel-form-dialog .el-dialog__body {
  padding-top: 12px;
  padding-bottom: 8px;
}
</style>
