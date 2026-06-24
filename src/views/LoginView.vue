<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Lock, Moon, Sunny, User } from '@element-plus/icons-vue'
import { login } from '@/api/auth'
import { setToken, setUser } from '@/utils/auth'
import { useTheme } from '@/composables/useTheme'

const props = defineProps<{
  embedded?: boolean
}>()

const router = useRouter()
const formRef = ref()
const loading = ref(false)
const { isDark, toggle: toggleTheme } = useTheme()

const isDev = import.meta.env.DEV

const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入工号或用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 位', trigger: 'blur' },
  ],
}

async function handleLogin() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const res = await login({
      username: form.username,
      password: form.password,
    })
    setToken(res.token)
    setUser({ ...res.user, password: form.password })
    ElMessage.success('登录成功')
    router.push('/home')
  } catch {
    ElMessage.error('登录失败，请检查工号和密码')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page" :class="{ 'is-embedded': props.embedded }">
    <el-button
      class="login-theme-btn"
      :class="{ 'is-embedded': props.embedded }"
      circle
      @click="toggleTheme"
    >
      <el-icon :size="18">
        <Moon v-if="!isDark" />
        <Sunny v-else />
      </el-icon>
    </el-button>

    <div class="login-card">
      <div class="login-header">
        <h1>ITSS Steeltech</h1>
        <p>管理系统登录</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        size="large"
        @keyup.enter="handleLogin"
      >
        <p class="login-tip">使用工号登录，默认密码 123456</p>

        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            :placeholder="'工号'"
            :prefix-icon="User"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            show-password
            :prefix-icon="Lock"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #001529 0%, #003a70 50%, #0050b3 100%);
}

.login-page.is-embedded {
  width: 100%;
  height: 100%;
  min-height: 100%;
  background: transparent;
}

.login-theme-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.login-theme-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.login-theme-btn.is-embedded {
  top: 20px;
  right: 20px;
}

.login-card {
  width: 400px;
  padding: 40px;
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.login-header p {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.login-tip {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.login-tip--dev {
  margin-bottom: 16px;
  color: var(--el-color-primary);
}

.login-btn {
  width: 100%;
}

/* 去除浏览器自动填充的泥巴色背景 */
.login-page :deep(.el-input__wrapper) {
  background-color: var(--el-fill-color-blank);
  box-shadow: none;
}

.login-page :deep(.el-input__inner) {
  background-color: transparent !important;
}

.login-page :deep(.el-input__inner:-webkit-autofill),
.login-page :deep(.el-input__inner:-webkit-autofill:hover),
.login-page :deep(.el-input__inner:-webkit-autofill:focus),
.login-page :deep(.el-input__inner:-webkit-autofill:active) {
  -webkit-box-shadow: 0 0 0 30px var(--el-fill-color-blank) inset !important;
  -webkit-text-fill-color: var(--el-text-color-regular) !important;
  caret-color: var(--el-text-color-regular);
  transition: background-color 5000s ease-in-out 0s;
}
</style>
