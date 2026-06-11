<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import { AppError } from '@/models/error'

const props = defineProps<{
  embedded?: boolean
}>()

const route = useRoute()
const router = useRouter()

const previewError = AppError.from({
  code: 404,
  title: '页面未找到',
  message: '请求的页面不存在，或已被移除。',
  path: '/business/example',
})

const errorInfo = computed(() =>
  props.embedded ? previewError : AppError.fromQuery(route.query),
)

function goHome() {
  router.push('/home')
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    goHome()
  }
}
</script>

<template>
  <div class="error-page" :class="{ 'is-embedded': props.embedded }">
    <ErrorDisplay :error="errorInfo">
      <template v-if="!props.embedded" #extra>
        <el-space>
          <el-button @click="goBack">返回上一页</el-button>
          <el-button type="primary" @click="goHome">返回首页</el-button>
        </el-space>
      </template>
    </ErrorDisplay>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color-page);
}

.error-page.is-embedded {
  width: 100%;
  min-height: 100%;
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-light);
  padding: 24px;
  box-sizing: border-box;
}
</style>
