<script setup lang="ts">
import { computed } from 'vue'
import type { UserPersonnelProfile } from '@/models/auth'
import { PersonnelForm, PersonnelLeaveForm } from '@/models/personnel'
import type {
  LeaveEntryStatus,
  LeaveEntryType,
  PersonnelRecord,
  PersonnelStatus,
} from '@/models/personnel'

const props = withDefaults(
  defineProps<{
    record: UserPersonnelProfile | PersonnelRecord
    labelWidth?: string
    showLeave?: boolean
  }>(),
  {
    labelWidth: '110px',
    showLeave: true,
  },
)

const leaveTypeMap = PersonnelLeaveForm.TYPE_MAP
const leaveStatusMap = PersonnelLeaveForm.STATUS_MAP

const leaveSummary = computed(() => {
  if (!props.showLeave) return null
  return PersonnelLeaveForm.getLeaveSummary(props.record.id)
})

function getLeaveTypeMeta(type: LeaveEntryType) {
  return leaveTypeMap[type]
}

function getLeaveStatusMeta(status: LeaveEntryStatus) {
  return leaveStatusMap[status]
}

function formatValue(value: string | number | undefined) {
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}

function formatDormitory(value: string | undefined) {
  if (!value) return '-'
  return PersonnelForm.formatDormitoryNo(value)
}

function getStatusMeta(status: string | undefined) {
  if (!status) return null
  return PersonnelForm.STATUS_MAP[status as PersonnelStatus] ?? null
}
</script>

<template>
  <el-descriptions :column="1" border :label-width="labelWidth" class="detail-section">
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
  <el-descriptions :column="1" border :label-width="labelWidth" class="detail-section">
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
    <el-descriptions-item label="状态">
      <template v-if="getStatusMeta(record.status)">
        <el-tag :type="getStatusMeta(record.status)!.type" size="small">
          {{ getStatusMeta(record.status)!.label }}
        </el-tag>
      </template>
      <span v-else>{{ formatValue(record.status) }}</span>
    </el-descriptions-item>
  </el-descriptions>

  <div class="detail-group-title">证件信息</div>
  <el-descriptions :column="1" border :label-width="labelWidth" class="detail-section">
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
  <el-descriptions :column="1" border :label-width="labelWidth" class="detail-section">
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
  <el-descriptions :column="1" border :label-width="labelWidth" class="detail-section">
    <el-descriptions-item label="印尼号码">
      {{ formatValue(record.indonesiaPhone) }}
    </el-descriptions-item>
    <el-descriptions-item label="国内号码">
      {{ formatValue(record.domesticPhone) }}
    </el-descriptions-item>
  </el-descriptions>

  <template v-if="showLeave">
    <div class="detail-group-title">休假信息</div>
    <template v-if="leaveSummary?.policy">
      <el-descriptions :column="1" border :label-width="labelWidth" class="detail-section">
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
</template>

<style scoped>
.detail-group-title {
  margin: 16px 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.detail-group-title:first-of-type {
  margin-top: 12px;
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

.dormitory-desc {
  margin-left: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
