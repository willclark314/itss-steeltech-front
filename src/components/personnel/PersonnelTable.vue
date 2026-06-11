<script setup lang="ts">
import { PersonnelForm } from '@/models/personnel'
import type { PersonnelRecord, PersonnelStatus } from '@/models/personnel'

defineProps<{
  data: PersonnelRecord[]
  loading?: boolean
  showTeam?: boolean
  showNationality?: boolean
  showDormitory?: boolean
}>()

const emit = defineEmits<{
  rowClick: [row: PersonnelRecord]
  detail: [row: PersonnelRecord]
}>()

const statusMap = PersonnelForm.STATUS_MAP

function getStatusMeta(status: PersonnelStatus) {
  return statusMap[status]
}

function getPositionTagType(position: string) {
  return PersonnelForm.getPositionTagType(position)
}
</script>

<template>
  <el-table
    v-loading="loading"
    :data="data"
    stripe
    class="personnel-table"
    @row-click="(row) => emit('rowClick', row as PersonnelRecord)"
  >
    <el-table-column prop="name" label="姓名" width="90" fixed />
    <el-table-column prop="employeeNo" label="工号" width="120" />
    <el-table-column prop="position" label="岗位" min-width="168">
      <template #default="{ row }">
        <el-tag
          v-if="getPositionTagType(row.position)"
          :type="getPositionTagType(row.position)"
          size="small"
          effect="light"
        >
          {{ row.position }}
        </el-tag>
        <span v-else>{{ row.position || '-' }}</span>
      </template>
    </el-table-column>
    <el-table-column prop="workshop" label="车间/科室" width="130" show-overflow-tooltip />
    <el-table-column
      v-if="showTeam !== false"
      prop="team"
      label="班组"
      width="90"
      show-overflow-tooltip
    />
    <el-table-column prop="gender" label="性别" width="70" />
    <el-table-column prop="age" label="年龄" width="70" />
    <el-table-column prop="domesticPhone" label="国内号码" width="130" />
    <el-table-column prop="status" label="状态" width="90">
      <template #default="{ row }">
        <el-tag :type="getStatusMeta(row.status).type" size="small">
          {{ getStatusMeta(row.status).label }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column
      v-if="showDormitory !== false"
      prop="dormitoryNo"
      label="宿舍号"
      width="100"
      fixed="right"
    />
    <el-table-column
      v-if="showNationality !== false"
      prop="nationality"
      label="国籍"
      width="100"
      fixed="right"
    />
    <el-table-column label="操作" width="80" fixed="right">
      <template #default="{ row }">
        <el-button type="primary" link @click.stop="emit('detail', row as PersonnelRecord)">
          详情
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.personnel-table :deep(.el-table__body .el-table__row) {
  cursor: pointer;
  height: 48px;
}

:deep(.personnel-table .el-table__body .el-table__cell) {
  padding: 6px 0;
  vertical-align: middle;
}
</style>
