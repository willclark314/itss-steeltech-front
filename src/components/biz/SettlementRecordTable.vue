<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { ref } from 'vue'
import SettlementRecordEditDialog from '@/components/biz/SettlementRecordEditDialog.vue'
import type { SettlementPricingRecord } from '@/models/biz/settlement/SettlementRecordForm'
import {
  SettlementRecordForm,
  type SettlementRecordEditForm,
  type SettlementRecordRow,
} from '@/models/biz/settlement/SettlementRecordForm'

const props = withDefaults(
  defineProps<{
    data: SettlementRecordRow[]
    loading?: boolean
    canEdit?: boolean
    tableHeight?: string | number
    pricingOptions: SettlementPricingRecord[]
  }>(),
  {
    loading: false,
    canEdit: false,
    tableHeight: 'calc(100vh - 320px)',
  },
)

const emit = defineEmits<{
  remove: [index: number]
  change: []
}>()

const editVisible = ref(false)
const editingRow = ref<SettlementRecordRow | null>(null)

function openEdit(row: SettlementRecordRow) {
  if (!props.canEdit) return
  editingRow.value = row
  editVisible.value = true
}

function handleEditSave(form: SettlementRecordEditForm) {
  if (!editingRow.value) return
  Object.assign(editingRow.value, SettlementRecordForm.applyEditForm(editingRow.value, form))
  emit('change')
}

function handlePricingCodeChange(row: SettlementRecordRow, code: string) {
  const pricing = props.pricingOptions.find(
    (item) => item.pricingCode.toUpperCase() === code.trim().toUpperCase(),
  )
  Object.assign(row, SettlementRecordForm.applyPricingToRow(row, pricing))
  emit('change')
}

function handleQuantityChange(row: SettlementRecordRow) {
  row.totalPrice = SettlementRecordForm.calcTotalPrice(row.quantity, row.unitPrice, row.coefficient)
  emit('change')
}
</script>

<template>
  <el-table
    v-loading="loading"
    :data="data"
    stripe
    class="biz-data-table settlement-record-table"
    :height="tableHeight"
    style="width: 100%"
    empty-text="本月暂无结算记录"
  >
    <el-table-column label="行号" width="64" align="center">
      <template #default="{ $index }">
        {{ $index + 1 }}
      </template>
    </el-table-column>

    <el-table-column label="名称" min-width="240" show-overflow-tooltip>
      <template #default="{ row }">
        <span
          class="editable-cell"
          :class="{ 'is-readonly': !canEdit }"
          @click="openEdit(row as SettlementRecordRow)"
        >
          {{ row.name || '点击编辑' }}
        </span>
      </template>
    </el-table-column>

    <el-table-column prop="projectNo" label="项目号" width="120" show-overflow-tooltip />

    <el-table-column label="耗用数量" width="108" align="right">
      <template #default="{ row }">
        <el-input-number
          v-if="canEdit"
          v-model="row.quantity"
          :min="0"
          :precision="4"
          controls-position="right"
          size="small"
          @change="handleQuantityChange(row as SettlementRecordRow)"
        />
        <span v-else>{{ row.quantity }}</span>
      </template>
    </el-table-column>

    <el-table-column prop="unit" label="单位" width="72" align="center" />

    <el-table-column label="单价(美元)" width="108" align="right">
      <template #default="{ row }">
        {{ SettlementRecordForm.formatAmount(row.unitPrice) }}
      </template>
    </el-table-column>

    <el-table-column label="总价(美元)" width="120" align="right">
      <template #default="{ row }">
        <strong>{{ SettlementRecordForm.formatAmount(row.totalPrice) }}</strong>
      </template>
    </el-table-column>

    <el-table-column label="折减系数" width="96" align="center">
      <template #default="{ row }">
        <el-input-number
          v-if="canEdit"
          v-model="row.coefficient"
          :min="0"
          :precision="4"
          :step="0.1"
          controls-position="right"
          size="small"
          @change="handleQuantityChange(row as SettlementRecordRow)"
        />
        <span v-else>{{ row.coefficient }}</span>
      </template>
    </el-table-column>

    <el-table-column label="结算代码" width="140">
      <template #default="{ row }">
        <el-select
          v-if="canEdit"
          v-model="row.pricingCode"
          filterable
          clearable
          size="small"
          placeholder="代码"
          @change="(value: string) => handlePricingCodeChange(row as SettlementRecordRow, value)"
        >
          <el-option
            v-for="item in pricingOptions"
            :key="item.id"
            :label="item.pricingCode"
            :value="item.pricingCode"
          />
        </el-select>
        <span v-else>{{ row.pricingCode || '-' }}</span>
      </template>
    </el-table-column>

    <el-table-column label="定价项目" min-width="160" show-overflow-tooltip>
      <template #default="{ row }">
        {{ row.pricingItemName || '-' }}
      </template>
    </el-table-column>

    <el-table-column label="结算年月" width="96" align="center">
      <template #default="{ row }">
        {{ SettlementRecordForm.formatYearMonth(row.settlementYear, row.settlementMonth) }}
      </template>
    </el-table-column>

    <el-table-column label="发图年月" width="96" align="center">
      <template #default="{ row }">
        {{ SettlementRecordForm.formatYearMonth(row.issueYear, row.issueMonth) }}
      </template>
    </el-table-column>

    <el-table-column v-if="canEdit" label="操作" width="72" align="center" fixed="right">
      <template #default="{ $index }">
        <el-button link type="danger" @click="emit('remove', $index)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>

  <SettlementRecordEditDialog
    v-model:visible="editVisible"
    :row="editingRow"
    :pricing-options="pricingOptions"
    @save="handleEditSave"
  />
</template>

<style scoped>
.editable-cell {
  cursor: pointer;
  color: var(--el-color-primary);
}

.editable-cell.is-readonly {
  cursor: default;
  color: inherit;
}
</style>
