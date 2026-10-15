<script setup lang="ts">
import { computed } from 'vue'
import type { SettlementCategory, SettlementPricingRecord } from '@/models/biz/settlement/SettlementRecordForm'

const props = defineProps<{
  visible: boolean
  category: SettlementCategory
  pricingList: SettlementPricingRecord[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const title = computed(() => (props.category === 'detail' ? '细化定价依据' : '设计定价依据'))

function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="920px"
    destroy-on-close
    @close="handleClose"
  >
    <el-table
      v-loading="loading"
      :data="pricingList"
      stripe
      class="biz-data-table"
      height="480px"
      empty-text="暂无定价依据，请导入定价表"
    >
      <el-table-column prop="pricingCode" label="定价代码" width="108" />
      <el-table-column prop="itemName" label="项目" min-width="220" show-overflow-tooltip />
      <el-table-column
        v-if="category === 'design'"
        prop="calcProcess"
        label="计算过程"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column label="单价(美元)" width="108" align="right">
        <template #default="{ row }">
          {{ row.unitPrice }}
        </template>
      </el-table-column>
      <el-table-column prop="unit" label="单位" width="72" align="center" />
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
    </el-table>
  </el-dialog>
</template>
