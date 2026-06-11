<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { deletePersonnel, updatePersonnel } from '@/api/personnel'
import { PersonnelForm, PersonnelLeaveForm } from '@/models/personnel'
import type { LeaveEntryStatus, LeaveEntryType, PersonnelRecord } from '@/models/personnel'

const props = defineProps<{
  modelValue: boolean
  record: PersonnelRecord | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  updated: [record: PersonnelRecord]
  deleted: [id: string]
  closed: []
}>()

const saving = ref(false)
const isEditing = ref(false)
const formRef = ref<FormInstance>()
const editForm = reactive(PersonnelForm.createFormFromRecord(PersonnelForm.DEFAULT_SAMPLES[0]!))

const statusEditOptions = PersonnelForm.STATUS_OPTIONS.filter((item) => item.value)
const teamOptions = PersonnelForm.TEAM_OPTIONS
const nationalityOptions = PersonnelForm.NATIONALITY_OPTIONS
const genderOptions = PersonnelForm.GENDER_OPTIONS
const formRules = PersonnelForm.FORM_RULES
const leaveTypeMap = PersonnelLeaveForm.TYPE_MAP
const leaveStatusMap = PersonnelLeaveForm.STATUS_MAP

const leaveSummary = computed(() => {
  if (!props.record) return null
  return PersonnelLeaveForm.getLeaveSummary(props.record.id)
})

const drawerTitle = computed(() =>
  props.record ? `${props.record.name} - 人员详情` : '人员详情',
)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      isEditing.value = false
    }
  },
)

function closeDrawer() {
  emit('update:modelValue', false)
}

function handleDrawerClosed() {
  isEditing.value = false
  formRef.value?.clearValidate()
  emit('closed')
}

function startEdit() {
  if (!props.record) return
  Object.assign(editForm, PersonnelForm.createFormFromRecord(props.record))
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  formRef.value?.clearValidate()
}

async function handleSave() {
  if (!props.record) return

  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const payload = PersonnelForm.createFormFromRecord(editForm)
    payload.workshop = PersonnelForm.WORKSHOP
    const updated = await updatePersonnel(props.record.id, payload)
    emit('updated', updated)
    isEditing.value = false
    ElMessage.success('人员信息已更新')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!props.record) return

  try {
    await ElMessageBox.confirm(
      `确定删除人员「${props.record.name}」吗？此操作不可恢复。`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  try {
    await deletePersonnel(props.record.id)
    emit('deleted', props.record.id)
    closeDrawer()
    ElMessage.success('人员已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

function getLeaveTypeMeta(type: LeaveEntryType) {
  return leaveTypeMap[type]
}

function getLeaveStatusMeta(status: LeaveEntryStatus) {
  return leaveStatusMap[status]
}

function formatValue(value: string | number | undefined) {
  if (value === undefined || value === null || value === '') {
    return '-'
  }
  return String(value)
}

function formatDormitory(value: string | undefined) {
  if (!value) return '-'
  return PersonnelForm.formatDormitoryNo(value)
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="drawerTitle"
    size="560px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @closed="handleDrawerClosed"
  >
    <template v-if="record">
      <template v-if="!isEditing">
        <el-descriptions :column="1" border label-width="110px" class="detail-section">
          <el-descriptions-item label="姓名">
            {{ formatValue(record.name) }}
          </el-descriptions-item>
          <el-descriptions-item label="工号">
            {{ formatValue(record.employeeNo) }}
          </el-descriptions-item>
          <el-descriptions-item label="性别">
            {{ formatValue(record.gender) }}
          </el-descriptions-item>
          <el-descriptions-item label="出生日期">
            {{ formatValue(record.birthDate) }}
          </el-descriptions-item>
          <el-descriptions-item label="年龄">
            {{ formatValue(record.age) }}
          </el-descriptions-item>
          <el-descriptions-item label="民族">
            {{ formatValue(record.ethnicity) }}
          </el-descriptions-item>
          <el-descriptions-item label="国籍">
            {{ formatValue(record.nationality) }}
          </el-descriptions-item>
          <el-descriptions-item label="籍贯">
            {{ formatValue(record.nativePlace) }}
          </el-descriptions-item>
          <el-descriptions-item label="家庭住址">
            {{ formatValue(record.homeAddress) }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-group-title">组织信息</div>
        <el-descriptions :column="1" border label-width="110px" class="detail-section">
          <el-descriptions-item label="岗位">
            <el-tag
              v-if="record.position && PersonnelForm.getPositionTagType(record.position)"
              :type="PersonnelForm.getPositionTagType(record.position)"
              size="small"
              effect="light"
            >
              {{ record.position }}
            </el-tag>
            <span v-else>{{ formatValue(record.position) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="车间/科室">
            {{ formatValue(record.workshop) }}
          </el-descriptions-item>
          <el-descriptions-item label="班组">
            {{ formatValue(record.team) }}
          </el-descriptions-item>
          <el-descriptions-item label="宿舍号">
            {{ formatValue(record.dormitoryNo) }}
            <span v-if="record.dormitoryNo" class="dormitory-desc">
              （{{ formatDormitory(record.dormitoryNo) }}）
            </span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-group-title">证件信息</div>
        <el-descriptions :column="1" border label-width="110px" class="detail-section">
          <el-descriptions-item label="身份证号">
            {{ formatValue(record.idCardNo) }}
          </el-descriptions-item>
          <el-descriptions-item label="护照号">
            {{ formatValue(record.passportNo) }}
          </el-descriptions-item>
          <el-descriptions-item label="护照有效期">
            {{ formatValue(record.passportExpiry) }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-group-title">教育背景</div>
        <el-descriptions :column="1" border label-width="110px" class="detail-section">
          <el-descriptions-item label="学历">
            {{ formatValue(record.education) }}
          </el-descriptions-item>
          <el-descriptions-item label="毕业院校">
            {{ formatValue(record.graduationSchool) }}
          </el-descriptions-item>
          <el-descriptions-item label="所学专业">
            {{ formatValue(record.major) }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-group-title">联系方式</div>
        <el-descriptions :column="1" border label-width="110px" class="detail-section">
          <el-descriptions-item label="印尼号码">
            {{ formatValue(record.indonesiaPhone) }}
          </el-descriptions-item>
          <el-descriptions-item label="国内号码">
            {{ formatValue(record.domesticPhone) }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-group-title">休假信息</div>
        <template v-if="leaveSummary?.policy">
          <el-descriptions :column="1" border label-width="110px" class="detail-section">
            <el-descriptions-item label="休假周期">
              {{ PersonnelLeaveForm.formatCycle(leaveSummary.policy) }}
            </el-descriptions-item>
            <el-descriptions-item label="周期起始">
              {{ formatValue(leaveSummary.policy.cycleStartDate) }}
            </el-descriptions-item>
            <el-descriptions-item label="策略生效">
              {{ formatValue(leaveSummary.policy.effectiveFrom) }}
            </el-descriptions-item>
            <el-descriptions-item label="下次轮休">
              {{ formatValue(leaveSummary.nextRegularLeaveStart ?? undefined) }}
            </el-descriptions-item>
            <el-descriptions-item label="当前休假">
              <template v-if="leaveSummary.activeLeave">
                <el-tag :type="getLeaveTypeMeta(leaveSummary.activeLeave.type).type" size="small">
                  {{ getLeaveTypeMeta(leaveSummary.activeLeave.type).label }}
                </el-tag>
                <span class="leave-range">
                  {{ leaveSummary.activeLeave.startDate }} ~ {{ leaveSummary.activeLeave.endDate }}
                </span>
              </template>
              <span v-else>-</span>
            </el-descriptions-item>
          </el-descriptions>

          <div v-if="leaveSummary.revisions.length" class="detail-subtitle">周期调整记录</div>
          <el-table
            v-if="leaveSummary.revisions.length"
            :data="leaveSummary.revisions"
            size="small"
            class="leave-table"
          >
            <el-table-column label="调整前" min-width="110">
              <template #default="{ row }">
                工作 {{ row.previousWorkDays }} 天 / 休假 {{ row.previousLeaveDays }} 天
              </template>
            </el-table-column>
            <el-table-column label="调整后" min-width="110">
              <template #default="{ row }">
                工作 {{ row.workDays }} 天 / 休假 {{ row.leaveDays }} 天
              </template>
            </el-table-column>
            <el-table-column prop="effectiveFrom" label="生效日" width="100" />
            <el-table-column prop="reason" label="原因" min-width="120" show-overflow-tooltip />
          </el-table>

          <div v-if="leaveSummary.entries.length" class="detail-subtitle">休假记录</div>
          <el-table
            v-if="leaveSummary.entries.length"
            :data="leaveSummary.entries"
            size="small"
            class="leave-table"
          >
            <el-table-column label="类型" width="90">
              <template #default="{ row }">
                <el-tag :type="getLeaveTypeMeta(row.type).type" size="small">
                  {{ getLeaveTypeMeta(row.type).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="日期" min-width="150">
              <template #default="{ row }">
                {{ row.startDate }} ~ {{ row.endDate }}
              </template>
            </el-table-column>
            <el-table-column label="天数" width="70">
              <template #default="{ row }">
                {{ row.actualDays ?? row.plannedDays }} 天
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="getLeaveStatusMeta(row.status).type" size="small">
                  {{ getLeaveStatusMeta(row.status).label }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </template>
        <el-empty v-else description="暂无休假策略" :image-size="60" />
      </template>

      <el-form
        v-else
        ref="formRef"
        :model="editForm"
        :rules="formRules"
        label-width="110px"
        class="edit-form"
      >
        <div class="detail-group-title">基本信息</div>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="工号" prop="employeeNo">
          <el-input v-model="editForm.employeeNo" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-select v-model="editForm.gender" style="width: 100%">
            <el-option v-for="item in genderOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="出生日期" prop="birthDate">
          <el-input v-model="editForm.birthDate" placeholder="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="年龄" prop="age">
          <el-input-number v-model="editForm.age" :min="0" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="民族" prop="ethnicity">
          <el-input v-model="editForm.ethnicity" />
        </el-form-item>
        <el-form-item label="国籍" prop="nationality">
          <el-select v-model="editForm.nationality" style="width: 100%">
            <el-option
              v-for="item in nationalityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="籍贯" prop="nativePlace">
          <el-input v-model="editForm.nativePlace" />
        </el-form-item>
        <el-form-item label="家庭住址" prop="homeAddress">
          <el-input v-model="editForm.homeAddress" type="textarea" :rows="2" />
        </el-form-item>

        <div class="detail-group-title">组织信息</div>
        <el-form-item label="岗位" prop="position">
          <el-input v-model="editForm.position" />
        </el-form-item>
        <el-form-item label="车间/科室">
          <el-input :model-value="PersonnelForm.WORKSHOP" disabled />
        </el-form-item>
        <el-form-item label="班组" prop="team">
          <el-select v-model="editForm.team" style="width: 100%">
            <el-option
              v-for="item in teamOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="宿舍号" prop="dormitoryNo">
          <el-input v-model="editForm.dormitoryNo" placeholder="如 B3_603、N1_302" />
          <div class="field-hint">
            格式：楼栋_楼层+房间，如 B3_603 表示 B3 栋 6 楼 03 室（B 栋 6 层，N 栋 3 层）
          </div>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="editForm.status" style="width: 100%">
            <el-option
              v-for="item in statusEditOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <div class="detail-group-title">证件信息</div>
        <el-form-item label="身份证号" prop="idCardNo">
          <el-input v-model="editForm.idCardNo" />
        </el-form-item>
        <el-form-item label="护照号" prop="passportNo">
          <el-input v-model="editForm.passportNo" />
        </el-form-item>
        <el-form-item label="护照有效期" prop="passportExpiry">
          <el-input v-model="editForm.passportExpiry" placeholder="YYYY-MM-DD" />
        </el-form-item>

        <div class="detail-group-title">教育背景</div>
        <el-form-item label="学历" prop="education">
          <el-input v-model="editForm.education" />
        </el-form-item>
        <el-form-item label="毕业院校" prop="graduationSchool">
          <el-input v-model="editForm.graduationSchool" />
        </el-form-item>
        <el-form-item label="所学专业" prop="major">
          <el-input v-model="editForm.major" />
        </el-form-item>

        <div class="detail-group-title">联系方式</div>
        <el-form-item label="印尼号码" prop="indonesiaPhone">
          <el-input v-model="editForm.indonesiaPhone" />
        </el-form-item>
        <el-form-item label="国内号码" prop="domesticPhone">
          <el-input v-model="editForm.domesticPhone" />
        </el-form-item>
      </el-form>
    </template>

    <template #footer>
      <div class="drawer-footer">
        <template v-if="isEditing">
          <el-button @click="cancelEdit">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
        </template>
        <template v-else>
          <el-button type="danger" @click="handleDelete">删除</el-button>
          <el-button type="primary" @click="startEdit">编辑</el-button>
        </template>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.detail-group-title {
  margin: 20px 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.detail-group-title:first-of-type {
  margin-top: 0;
}

.detail-section :deep(.el-descriptions__label) {
  font-weight: 500;
}

.detail-subtitle {
  margin: 12px 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.leave-table {
  margin-bottom: 8px;
}

.leave-range {
  margin-left: 8px;
  font-size: 13px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.edit-form {
  padding-bottom: 8px;
}

.dormitory-desc {
  margin-left: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.field-hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
</style>
