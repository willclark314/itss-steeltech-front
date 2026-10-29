<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { createRole, updateRole } from '@/api/roles'
import { RoleForm, PersonnelForm } from '@/models/personnel'
import type {
  ModulePermissionGroup,
  PagePermissionGroup,
  PermissionRecord,
  PersonnelRecord,
  RoleRecord,
} from '@/models/personnel'

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

const workshopOptions = computed(() =>
  PersonnelForm.collectWorkshopTabs(props.personnelOptions),
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

function getPageViewId(page: PagePermissionGroup) {
  return RoleForm.getPagePermission(page, 'view')?.id ?? ''
}

function handleModuleCheckChange(group: ModulePermissionGroup, checked: boolean) {
  form.permissionIds = RoleForm.setModuleAccessEnabled(form.permissionIds, group, checked)
}

function handlePageCheckChange(page: PagePermissionGroup, checked: boolean) {
  form.permissionIds = RoleForm.applyPageAccessToggle(form.permissionIds, page, checked)
}

function handlePageExtraCheckChange(
  page: PagePermissionGroup,
  action: 'view-all',
  checked: boolean,
) {
  form.permissionIds = RoleForm.applyPageExtraToggle(
    form.permissionIds,
    page,
    action,
    checked,
  )
}

const accessiblePageCount = computed(() =>
  RoleForm.countAccessiblePages(permissionGroups.value, form.permissionIds),
)

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
      assignedWorkshops: RoleForm.toApiWorkshops([...form.assignedWorkshops]),
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
            <el-form-item label="关联科室">
              <el-select
                v-model="form.assignedWorkshops"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                class="personnel-select"
                placeholder="选择关联科室"
                style="width: 100%"
              >
                <el-option
                  v-for="tab in workshopOptions"
                  :key="tab.key"
                  :label="`${tab.label}（${tab.count}人）`"
                  :value="tab.key"
                />
              </el-select>
              <p class="assign-hint">关联科室的人员将自动拥有该角色；也可额外指定个人。</p>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="关联人员">
              <el-select
                v-model="form.assignedPersonnelIds"
                multiple
                filterable
                :reserve-keyword="false"
                collapse-tags
                collapse-tags-tooltip
                class="personnel-select"
                placeholder="选择额外关联的具体人员"
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
          <span class="role-permission-count">已选择 {{ accessiblePageCount }} 个页面</span>
        </div>
        <p class="role-permission-hint">
          勾选<strong>系统</strong>可全选该系统下所有页面；取消系统勾选将关闭该系统全部页面访问与数据请求，也可单独勾选具体页面。年休页可额外勾选「查看全员」。
        </p>

        <div class="permission-panel">
          <div v-if="permissionGroups.length" class="permission-module-list">
            <section
              v-for="group in permissionGroups"
              :key="group.module"
              class="permission-module-block"
            >
              <el-checkbox
                :model-value="RoleForm.isModuleFullySelected(group, form.permissionIds)"
                :indeterminate="RoleForm.isModulePartiallySelected(group, form.permissionIds)"
                class="permission-module-checkbox"
                @change="(checked) => handleModuleCheckChange(group, Boolean(checked))"
              >
                <span class="permission-module-name">{{ group.module }}</span>
                <span class="permission-module-count">
                  （{{ RoleForm.countAccessiblePagesInModule(group, form.permissionIds) }}/{{
                    group.pages.length
                  }}）
                </span>
              </el-checkbox>

              <div class="permission-page-list">
                <div
                  v-for="page in group.pages"
                  :key="page.pageKey"
                  class="permission-page-item"
                >
                  <el-checkbox
                    :model-value="RoleForm.isPageAccessGranted(page, form.permissionIds)"
                    :disabled="!getPageViewId(page)"
                    :title="page.path"
                    class="permission-page-checkbox"
                    @change="(checked) => handlePageCheckChange(page, Boolean(checked))"
                  >
                    {{ page.pageName }}
                  </el-checkbox>
                  <div
                    v-if="RoleForm.getPageExtraPermissions(page).length"
                    class="permission-page-extras"
                  >
                    <el-checkbox
                      v-for="extra in RoleForm.getPageExtraPermissions(page)"
                      :key="extra.id"
                      :model-value="
                        RoleForm.isPageExtraGranted(page, extra.action, form.permissionIds)
                      "
                      :disabled="!RoleForm.isPageAccessGranted(page, form.permissionIds)"
                      class="permission-extra-checkbox"
                      @change="
                        (checked) =>
                          handlePageExtraCheckChange(
                            page,
                            extra.action as 'view-all',
                            Boolean(checked),
                          )
                      "
                    >
                      {{ extra.name }}
                    </el-checkbox>
                  </div>
                </div>
              </div>
            </section>
          </div>
          <p v-else class="permission-empty">暂无页面权限</p>
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
  margin-bottom: 6px;
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

.role-permission-hint {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.assign-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
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
  min-height: 360px;
  max-height: calc(72vh - 240px);
  overflow-y: auto;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.permission-module-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.permission-module-block {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.permission-module-block:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.permission-module-checkbox {
  display: flex;
  align-items: center;
  height: auto;
  margin-right: 0;
}

.permission-module-checkbox :deep(.el-checkbox__label) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.permission-module-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.permission-page-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px 16px;
  margin-top: 10px;
  padding-left: 24px;
}

.permission-page-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.permission-page-checkbox {
  display: flex;
  align-items: center;
  height: auto;
  margin-right: 0;
}

.permission-page-checkbox :deep(.el-checkbox__label) {
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.permission-page-extras {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 22px;
}

.permission-extra-checkbox {
  display: flex;
  align-items: center;
  height: auto;
  margin-right: 0;
}

.permission-extra-checkbox :deep(.el-checkbox__label) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.permission-empty {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 48px 0;
}
</style>

<style>
.role-form-dialog .el-dialog__body {
  padding-top: 12px;
  padding-bottom: 8px;
}
</style>
