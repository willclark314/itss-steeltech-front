<script setup lang="ts">
import DevPreviewLayout from '@/components/dev/DevPreviewLayout.vue'
import ErrorView from '@/views/ErrorView.vue'
</script>

<template>
  <DevPreviewLayout title="错误页面" variant="error">
    <ErrorView embedded />
  </DevPreviewLayout>
</template>
