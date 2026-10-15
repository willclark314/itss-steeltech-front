<script setup lang="ts">
import { computed } from 'vue'
import { DesignDrawingIssuePlanForm } from '@/models/biz/designDrawingIssuePlan/DesignDrawingIssuePlanForm'
import { DesignDrawingIssuePlanSettings } from '@/models/biz/designDrawingIssuePlan/DesignDrawingIssuePlanSettings'

const props = withDefaults(
  defineProps<{
    year: number
    month: number
    currentCount: number
    approachingDays?: number
  }>(),
  {
    approachingDays: 0,
  },
)

const emit = defineEmits<{
  change: [year: number, month: number]
}>()

const centerLabel = computed(() =>
  DesignDrawingIssuePlanForm.formatMonthLabel(props.year, props.month),
)

const approachingLegend = computed(() =>
  DesignDrawingIssuePlanSettings.formatApproachingLegend(props.approachingDays),
)

function shiftMonth(delta: number) {
  const next = DesignDrawingIssuePlanForm.shiftMonth(props.year, props.month, delta)
  emit('change', next.year, next.month)
}
</script>

<template>
  <div class="plan-month-header">
    <div class="calendar-toolbar">
      <div class="month-switcher">
        <el-button link aria-label="上一月" @click="shiftMonth(-1)">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <span class="month-label">{{ centerLabel }}</span>
        <el-button link aria-label="下一月" @click="shiftMonth(1)">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>

      <div class="calendar-actions">
        <div class="issue-legend">
          <span class="legend-item">
            <i class="legend-swatch legend-swatch--unissued" />
            未发图
          </span>
          <span class="legend-item">
            <i class="legend-swatch legend-swatch--approaching" />
            {{ approachingLegend }}
          </span>
          <span class="legend-item">
            <i class="legend-swatch legend-swatch--overdue" />
            发出超时
          </span>
        </div>
        <span class="plan-summary">共 {{ currentCount }} 项</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plan-month-header {
  margin-bottom: 12px;
}

.calendar-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  min-width: 0;
}

.month-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
}

.month-label {
  min-width: 108px;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.calendar-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-left: auto;
}

.issue-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-swatch {
  width: 14px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-swatch--unissued {
  background: var(--el-color-primary-light-8);
  box-shadow: inset 0 0 0 1px var(--el-color-primary-light-5);
}

.legend-swatch--approaching {
  background: rgba(230, 162, 60, 0.28);
  box-shadow: inset 0 0 0 1px var(--el-color-warning);
}

.legend-swatch--overdue {
  background: rgba(245, 108, 108, 0.24);
  box-shadow: inset 0 0 0 1px var(--el-color-danger);
}

.plan-summary {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
