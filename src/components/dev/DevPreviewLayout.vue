<script setup lang="ts">
defineProps<{
  title: string
  variant: 'login' | 'error'
}>()
</script>

<template>
  <el-card shadow="never" class="dev-preview-card">
    <template #header>
      <div class="dev-preview-card__header">
        <span>{{ title }}</span>
        <span class="dev-preview-card__hint">预览模式，保留主布局与侧边栏</span>
      </div>
    </template>

    <div class="dev-preview-shell" :class="`dev-preview-shell--${variant}`">
      <div class="dev-preview-stage" :class="`dev-preview-stage--${variant}`">
        <slot />
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.dev-preview-card {
  --dev-preview-offset: 124px;
  height: calc(100vh - var(--dev-preview-offset));
  display: flex;
  flex-direction: column;
}

.dev-preview-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
}

.dev-preview-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dev-preview-card__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dev-preview-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.dev-preview-shell--login {
  background: linear-gradient(135deg, #001529 0%, #003a70 50%, #0050b3 100%);
}

.dev-preview-shell--error {
  background: var(--el-bg-color-page);
}

.dev-preview-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}

.dev-preview-stage--login {
  padding: 0;
  align-items: stretch;
}

.dev-preview-stage--error {
  padding: 24px;
  align-items: stretch;
}

.dev-preview-stage--login :deep(.login-page) {
  width: 100%;
  height: 100%;
}

.dev-preview-stage--error :deep(.error-page) {
  width: 100%;
  height: 100%;
}
</style>
