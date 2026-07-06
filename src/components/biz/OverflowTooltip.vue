<script setup lang="ts">
import { ref } from 'vue'

withDefaults(
  defineProps<{
    content: string
    placement?: 'top' | 'bottom' | 'left' | 'right'
    showAfter?: number
  }>(),
  {
    placement: 'top',
    showAfter: 200,
  },
)

const disabled = ref(true)

function onMouseEnter(event: MouseEvent) {
  const trigger = event.currentTarget as HTMLElement
  const textEl =
    (trigger.querySelector('.el-tag__content') as HTMLElement | null) ??
    (trigger.querySelector('.ellipsis-cell') as HTMLElement | null) ??
    trigger
  disabled.value = textEl.scrollWidth <= textEl.clientWidth
}
</script>

<template>
  <el-tooltip
    :content="content"
    :placement="placement"
    :show-after="showAfter"
    :disabled="disabled"
  >
    <span class="overflow-tooltip-trigger" @mouseenter="onMouseEnter">
      <slot />
    </span>
  </el-tooltip>
</template>

<style scoped>
.overflow-tooltip-trigger {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}
</style>
