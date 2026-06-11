<script setup lang="ts">
import { computed } from 'vue'
import { AppError, type AppErrorOptions } from '@/models/error'

const props = withDefaults(
  defineProps<{
    error?: AppError | AppErrorOptions
    showDetail?: boolean
  }>(),
  {
    showDetail: true,
  },
)

const errorInfo = computed(() =>
  props.error instanceof AppError ? props.error : AppError.from(props.error ?? {}),
)

const detailFields = computed(() => errorInfo.value.getDetailFields())
</script>

<template>
  <el-result
    :icon="errorInfo.getIcon()"
    :title="String(errorInfo.code)"
    :sub-title="errorInfo.title"
  >
    <template #default>
      <p class="error-message">{{ errorInfo.message }}</p>

      <el-descriptions
        v-if="showDetail && detailFields.length > 0"
        class="error-details"
        :column="1"
        border
        size="small"
      >
        <el-descriptions-item
          v-for="field in detailFields"
          :key="field.key"
          :label="field.label"
        >
          <pre v-if="field.key === 'detail' || field.value.includes('\n')" class="error-pre">{{
            field.value
          }}</pre>
          <span v-else>{{ field.value }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </template>

    <template v-if="$slots.extra" #extra>
      <slot name="extra" />
    </template>
  </el-result>
</template>

<style scoped>
.error-message {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.error-details {
  max-width: 640px;
  margin: 0 auto;
  text-align: left;
}

.error-pre {
  margin: 0;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
