<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { createRole, updateRole } from '@/api/roles'
import { RoleForm } from '@/models/personnel'
import type { PermissionRecord, PersonnelRecord, RoleRecord } from '@/models/personnel'

const props = defineProps<{
  modelValue: boolean
  role: RoleRecord | null
  permissionOptions: PermissionRecord[]
  personnelOptions: PersonnelRecord[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [record: RoleRecord]
  updated: [record: RoleRecord]
  closed: []
}>()

const submitting = ref(false)
const formRef = ref<FormInstance>()
const form = reactive(RoleForm.createEmptyForm())
const formRules = RoleForm.FORM_RULES
const statusFormOptions = RoleForm.STATUS_FORM_OPTIONS

const dialogTitle = computed(() => (props.role ? '编辑角色' : '新建角色'))

const permissionGroups = computed(() =>
  RoleForm.groupPermissionsByModule(props.permissionOptions),
)

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    Object.assign(
      form,
      props.role ? RoleForm.createFormFromRecord(props.role) : RoleForm.createEmptyForm(),
    )
  },
)

function closeDialog() {
  emit('update:modelValue', false)
}

function handleDialogClosed() {
  Object.assign(form, RoleForm.createEmptyForm())
  formRef.value?.clearValidate()
  emit('closed')
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim(),
      status: form.status,
      permissionIds: [...form.permissionIds],
      assignedPersonnelIds: [...form.assignedPersonnelIds],
    }

    if (props.role) {
      const updated = await updateRole(props.role.id, payload)
      emit('updated', updated)
      closeDialog()
      ElMessage.success('角色已更新')
      return
    }

    const created = await createRole(payload)
    emit('created', created)
    closeDialog()
    ElMessage.success('角色已创建')
  } catch (error) {
    ElMessage.error(
      error instanceof Error
        ? error.message
        : props.role
          ? '更新角色失败'
          : '创建角色失败',
    )
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="920px"
    top="4vh"
    class="role-form-dialog"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @closed="handleDialogClosed"
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px" class="role-form">
      <section class="role-basic-section">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="角色名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入角色名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色编码" prop="code">
              <el-input v-model="form.code" placeholder="如 admin" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
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
          </el-col>
          <el-col :span="12">
            <el-form-item label="描述">
              <el-input v-model="form.description" placeholder="角色描述（可选）" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="关联人员">
              <el-select
                v-model="form.assignedPersonnelIds"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                class="personnel-select"
                placeholder="选择关联的具体人员"
                style="width: 100%"
              >
                <el-option
                  v-for="person in personnelOptions"
                  :key="person.id"
                  :label="`${person.name} · ${person.team}`"
                  :value="person.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </section>

      <section class="role-permission-section">
        <div class="role-permission-header">
          <span class="role-permission-title">页面权限</span>
          <span class="role-permission-count">已选 {{ form.permissionIds.length }} 项</span>
        </div>
        <div class="permission-panel">
          <div
            v-for="group in permissionGroups"
            :key="group.module"
            class="permission-group"
          >
            <div class="permission-group-title">{{ group.module }}</div>
            <div class="permission-page-grid">
              <div
                v-for="page in group.pages"
                :key="page.pageKey"
                class="permission-page"
              >
                <div class="permission-page-title" :title="page.path">{{ page.pageName }}</div>
                <el-checkbox-group v-model="form.permissionIds" class="permission-checkbox-group">
                  <el-checkbox
                    v-for="permission in page.permissions"
                    :key="permission.id"
                    :value="permission.id"
                    :title="permission.code"
                  >
                    {{ permission.name }}
                  </el-checkbox>
                </el-checkbox-group>
              </div>
            </div>
          </div>
        </div>
      </section>
    </el-form>

    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ role ? '保存' : '提交' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.role-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.role-basic-section {
  padding-bottom: 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.role-basic-section :deep(.el-form-item) {
  margin-bottom: 12px;
}

.role-permission-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.role-permission-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.role-permission-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.role-permission-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.personnel-select :deep(.el-select__wrapper) {
  height: auto;
  min-height: 32px;
}

.personnel-select :deep(.el-select__tags) {
  flex-wrap: wrap;
  max-width: 100%;
}

.permission-panel {
  width: 100%;
  min-height: 420px;
  max-height: calc(72vh - 220px);
  overflow-y: auto;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.permission-group + .permission-group {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.permission-group-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.permission-page-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.permission-page {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-extra-light);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.permission-page-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.permission-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
}

.permission-page :deep(.el-checkbox) {
  margin-right: 0;
  height: 28px;
}

.permission-page :deep(.el-checkbox__label) {
  font-size: 13px;
  padding-left: 6px;
}

@media (max-width: 768px) {
  .permission-page-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
.role-form-dialog .el-dialog__body {
  padding-top: 12px;
  padding-bottom: 8px;
}
</style>
