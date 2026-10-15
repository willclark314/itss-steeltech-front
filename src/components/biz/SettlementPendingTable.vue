<script setup lang="ts">
import '@/styles/biz-data-table.css'
import {
  SettlementRecordForm,
  type SettlementPendingRow,
} from '@/models/biz/settlement/SettlementRecordForm'

withDefaults(
  defineProps<{
    data: SettlementPendingRow[]
    loading?: boolean
    tableHeight?: string | number
  }>(),
  {
    loading: false,
    tableHeight: 280,
  },
)
</script>

<template>
  <el-table
    v-loading="loading"
    :data="data"
    stripe
    class="biz-data-table settlement-pending-table"
    :height="tableHeight"
    style="width: 100%"
    empty-text="暂无已完成未结算项目"
  >
    <el-table-column label="行号" width="64" align="center">
      <template #default="{ $index }">
        {{ $index + 1 }}
      </template>
    </el-table-column>

    <el-table-column prop="name" label="名称" min-width="240" show-overflow-tooltip />

    <el-table-column prop="projectNo" label="项目号" width="120" show-overflow-tooltip>
      <template #default="{ row }">
        {{ row.projectNo || '-' }}
      </template>
    </el-table-column>

    <el-table-column prop="pricingCode" label="结算代码" width="108" />

    <el-table-column label="定价项目" min-width="180" show-overflow-tooltip>
      <template #default="{ row }">
        {{ row.pricingItemName || '-' }}
      </template>
    </el-table-column>

    <el-table-column label="发图年月" width="96" align="center">
      <template #default="{ row }">
        {{ SettlementRecordForm.formatYearMonth(row.issueYear, row.issueMonth) }}
      </template>
    </el-table-column>

    <el-table-column label="耗用数量" width="96" align="right">
      <template #default="{ row }">
        {{ row.quantity || '-' }}
      </template>
    </el-table-column>

    <el-table-column prop="unit" label="单位" width="72" align="center">
      <template #default="{ row }">
        {{ row.unit || '-' }}
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.settlement-pending-table :deep(.el-table__body tr > td.el-table__cell) {
  background: rgba(230, 162, 60, 0.06);
}
</style>
