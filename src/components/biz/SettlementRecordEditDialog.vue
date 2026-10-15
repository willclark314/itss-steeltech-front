<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { SettlementPricingRecord } from '@/models/biz/settlement/SettlementRecordForm'
import {
  SettlementRecordForm,
  type SettlementRecordEditForm,
  type SettlementRecordRow,
} from '@/models/biz/settlement/SettlementRecordForm'

const props = defineProps<{
  visible: boolean
  row: SettlementRecordRow | null
  pricingOptions: SettlementPricingRecord[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [form: SettlementRecordEditForm]
}>()

const form = reactive<SettlementRecordEditForm>({
  name: '',
  projectNo: '',
  quantity: 0,
  unit: '',
  unitPrice: 0,
  coefficient: 1,
  pricingCode: '',
  settlementYear: null,
  settlementMonth: null,
  issueYear: null,
  issueMonth: null,
})

const previewTotal = computed(() =>
  SettlementRecordForm.calcTotalPrice(form.quantity, form.unitPrice, form.coefficient),
)

watch(
  () => props.visible,
  (visible) => {
    if (!visible || !props.row) return
    Object.assign(form, SettlementRecordForm.toEditForm(props.row))
  },
)

function handlePricingChange(code: string) {
  const pricing = props.pricingOptions.find(
    (item) => item.pricingCode.toUpperCase() === code.trim().toUpperCase(),
  )
  if (!pricing) return
  form.pricingCode = pricing.pricingCode
  form.unitPrice = pricing.unitPrice
  form.unit = pricing.unit
}

function handleClose() {
  emit('update:visible', false)
}

function handleSave() {
  if (!form.name.trim()) return
  emit('save', { ...form })
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="编辑结算记录"
    width="640px"
    destroy-on-close
    @close="handleClose"
  >
    <el-form label-width="96px">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="结算项目名称" />
      </el-form-item>
      <el-form-item label="项目号">
        <el-input v-model="form.projectNo" placeholder="可选" />
      </el-form-item>
      <el-form-item label="结算代码">
        <el-select
          v-model="form.pricingCode"
          filterable
          clearable
          placeholder="选择定价代码"
          style="width: 100%"
          @change="handlePricingChange"
        >
          <el-option
            v-for="item in pricingOptions"
            :key="item.id"
            :label="`${item.pricingCode} - ${item.itemName}`"
            :value="item.pricingCode"
          />
        </el-select>
      </el-form-item>
      <el-row :gutter="12">
        <el-col :span="8">
          <el-form-item label="耗用数量">
            <el-input-number v-model="form.quantity" :min="0" :precision="4" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="单位">
            <el-input v-model="form.unit" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="折减系数">
            <el-input-number v-model="form.coefficient" :min="0" :precision="4" :step="0.1" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="单价(美元)">
        <el-input-number v-model="form.unitPrice" :min="0" :precision="4" style="width: 100%" />
      </el-form-item>
      <el-form-item label="总价(美元)">
        <span class="preview-total">{{ SettlementRecordForm.formatAmount(previewTotal) }}</span>
      </el-form-item>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="结算年月">
            <div class="year-month-pair">
              <el-input-number v-model="form.settlementYear" :min="2000" :max="2100" controls-position="right" />
              <span>年</span>
              <el-input-number v-model="form.settlementMonth" :min="1" :max="12" controls-position="right" />
              <span>月</span>
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="发图年月">
            <div class="year-month-pair">
              <el-input-number v-model="form.issueYear" :min="2000" :max="2100" controls-position="right" />
              <span>年</span>
              <el-input-number v-model="form.issueMonth" :min="1" :max="12" controls-position="right" />
              <span>月</span>
            </div>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :disabled="!form.name.trim()" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.preview-total {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.year-month-pair {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
