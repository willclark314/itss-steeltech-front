<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Hide, View } from '@element-plus/icons-vue'
import { changePassword, fetchCurrentUser } from '@/api/auth'
import PersonnelProfileReadonly from '@/components/personnel/PersonnelProfileReadonly.vue'
import { getDevUserProfile } from '@/models/auth'
import type { UserPersonnelProfile } from '@/models/auth'
import { getToken, getUser, getUsername, setUser, type User } from '@/utils/auth'

interface UserDetailInfo extends User {
  password: string
}

interface PasswordForm {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

const DEFAULT_PASSWORD = '123456'

const visible = ref(false)
const loadingProfile = ref(false)
const showPassword = ref(false)
const showPasswordForm = ref(false)
const changingPassword = ref(false)
const userInfo = ref<UserDetailInfo | null>(null)
const passwordFormRef = ref<FormInstance>()
const passwordForm = reactive<PasswordForm>({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const passwordRules: FormRules<PasswordForm> = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码长度不能少于 6 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的新密码不一致'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}

const profile = computed<UserPersonnelProfile | null>(() => {
  if (userInfo.value?.profile) return userInfo.value.profile
  if (userInfo.value?.loginType === 'dev') {
    const devProfile = getDevUserProfile(userInfo.value.username as 'admin' | 'user')
    return devProfile ?? null
  }
  return null
})

const accountLabel = computed(() =>
  userInfo.value?.loginType === 'dev' ? '登录账号' : '工号',
)
const accountValue = computed(() => userInfo.value?.username || getUsername() || '-')
const password = computed(() => userInfo.value?.password || '')
const displayName = computed(() => profile.value?.name || userInfo.value?.name || '')

const maskedPassword = computed(() => {
  if (showPassword.value) {
    return password.value || '-'
  }
  return password.value ? '***' : '-'
})

function resetPasswordForm() {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordFormRef.value?.clearValidate()
}

function loadStoredUser() {
  const stored = getUser()
  if (stored) {
    userInfo.value = {
      ...stored,
      password: stored.password || DEFAULT_PASSWORD,
    }
    return
  }

  const username = getUsername()
  userInfo.value = username ? { username, password: DEFAULT_PASSWORD } : null
}

async function refreshProfile() {
  if (!getToken()) return

  loadingProfile.value = true
  try {
    const { user } = await fetchCurrentUser()
    const stored = getUser()
    const merged: UserDetailInfo = {
      ...user,
      password: stored?.password || userInfo.value?.password || DEFAULT_PASSWORD,
    }
    userInfo.value = merged
    setUser(merged)
  } catch {
    // 保留本地缓存，避免接口不可用时无法查看
  } finally {
    loadingProfile.value = false
  }
}

async function open() {
  showPassword.value = false
  showPasswordForm.value = false
  resetPasswordForm()
  loadStoredUser()
  visible.value = true
  await refreshProfile()
}

function handleDialogClosed() {
  showPassword.value = false
  showPasswordForm.value = false
  resetPasswordForm()
}

function togglePasswordVisible() {
  if (!password.value) return
  showPassword.value = !showPassword.value
}

function togglePasswordForm() {
  showPasswordForm.value = !showPasswordForm.value
  if (!showPasswordForm.value) {
    resetPasswordForm()
  }
}

async function handleChangePassword() {
  const valid = await passwordFormRef.value?.validate().catch(() => false)
  if (!valid || !userInfo.value) return

  changingPassword.value = true
  try {
    await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    })

    userInfo.value.password = passwordForm.newPassword
    setUser({
      ...userInfo.value,
      password: passwordForm.newPassword,
    })

    showPasswordForm.value = false
    resetPasswordForm()
    ElMessage.success('密码已更新')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '修改密码失败')
  } finally {
    changingPassword.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <el-dialog
    v-model="visible"
    title="用户信息"
    class="user-detail-dialog"
    destroy-on-close
    align-center
    @closed="handleDialogClosed"
  >
    <div class="user-detail-layout">
      <section class="user-detail-column user-detail-column--account">
        <header class="column-header">
          <h3 class="column-title">账号信息</h3>
          <p class="column-desc">登录凭证与密码管理</p>
        </header>

        <div class="column-body">
          <el-descriptions :column="1" border label-width="88px" class="user-detail">
            <el-descriptions-item :label="accountLabel">
              {{ accountValue }}
            </el-descriptions-item>
            <el-descriptions-item label="密码">
              <div class="password-row">
                <span class="password-value">
                  <span class="password-text">{{ maskedPassword }}</span>
                </span>
                <button
                  type="button"
                  class="password-toggle"
                  :class="{ 'is-disabled': !password }"
                  :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                  @click.stop="togglePasswordVisible"
                >
                  <el-icon>
                    <View v-if="!showPassword" />
                    <Hide v-else />
                  </el-icon>
                </button>
              </div>
            </el-descriptions-item>
          </el-descriptions>

          <div class="password-section">
            <el-button type="primary" link @click="togglePasswordForm">
              {{ showPasswordForm ? '收起修改密码' : '修改密码' }}
            </el-button>

            <el-form
              v-if="showPasswordForm"
              ref="passwordFormRef"
              :model="passwordForm"
              :rules="passwordRules"
              label-width="88px"
              class="password-form"
              @submit.prevent
            >
              <el-form-item label="当前密码" prop="oldPassword">
                <el-input
                  v-model="passwordForm.oldPassword"
                  type="password"
                  show-password
                  placeholder="请输入当前密码"
                />
              </el-form-item>
              <el-form-item label="新密码" prop="newPassword">
                <el-input
                  v-model="passwordForm.newPassword"
                  type="password"
                  show-password
                  placeholder="至少 6 位"
                />
              </el-form-item>
              <el-form-item label="确认新密码" prop="confirmPassword">
                <el-input
                  v-model="passwordForm.confirmPassword"
                  type="password"
                  show-password
                  placeholder="请再次输入新密码"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="changingPassword" @click="handleChangePassword">
                  保存新密码
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </section>

      <section class="user-detail-column user-detail-column--profile">
        <header class="column-header">
          <h3 class="column-title">人员档案</h3>
          <p class="column-desc">与个人资料相关的详细信息</p>
        </header>

        <div v-loading="loadingProfile" class="column-body profile-scroll">
          <PersonnelProfileReadonly
            v-if="profile"
            :record="profile"
            label-width="96px"
          />
          <el-descriptions
            v-else-if="displayName"
            :column="1"
            border
            label-width="96px"
            class="user-detail user-detail--fallback"
          >
            <el-descriptions-item label="姓名">
              {{ displayName }}
            </el-descriptions-item>
          </el-descriptions>
          <el-empty v-else description="暂无人员档案" :image-size="72" />
        </div>
      </section>
    </div>
  </el-dialog>
</template>

<style scoped>
.user-detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0;
  height: 100%;
  min-height: 0;
}

.user-detail-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.user-detail-column--account {
  padding-right: 18px;
  border-right: 1px solid var(--el-border-color-lighter);
}

.user-detail-column--profile {
  padding-left: 18px;
}

.column-header {
  flex-shrink: 0;
  margin-bottom: 12px;
}

.column-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.column-desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.column-body {
  flex: 1;
  min-height: 0;
}

.profile-scroll {
  overflow: auto;
  padding-right: 4px;
}

.user-detail--fallback {
  margin-top: 0;
}

.user-detail :deep(.el-descriptions__label) {
  width: 88px;
  min-width: 88px;
}

.user-detail :deep(.el-descriptions__content) {
  width: auto;
}

.password-row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.password-value {
  flex: 1;
  min-width: 0;
}

.password-text {
  display: inline-block;
  min-width: 6em;
  font-variant-numeric: tabular-nums;
}

.password-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
}

.password-toggle:hover:not(.is-disabled) {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

.password-toggle.is-disabled {
  color: var(--el-text-color-disabled);
  cursor: not-allowed;
}

.password-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.password-form {
  margin-top: 12px;
}

@media (max-width: 860px) {
  .user-detail-layout {
    grid-template-columns: 1fr;
    gap: 16px;
    overflow: auto;
  }

  .user-detail-column--account {
    padding-right: 0;
    border-right: none;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .user-detail-column--profile {
    padding-left: 0;
  }

  .profile-scroll {
    max-height: none;
    overflow: visible;
  }
}
</style>

<style>
.user-detail-dialog.el-dialog {
  --user-detail-width: min(92vw, calc(84vh * 16 / 9), 1120px);
  --user-detail-height: min(calc(var(--user-detail-width) * 9 / 16), 84vh);

  width: var(--user-detail-width) !important;
  height: var(--user-detail-height);
  max-width: none;
  margin: auto !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-detail-dialog .el-dialog__header {
  flex-shrink: 0;
  margin-right: 0;
  padding: 16px 20px 10px;
}

.user-detail-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  padding: 8px 20px 20px;
  overflow: hidden;
}

.user-detail-dialog .el-dialog__title {
  font-size: 16px;
  font-weight: 600;
}

@media (max-width: 860px) {
  .user-detail-dialog.el-dialog {
    height: min(92vh, calc(var(--user-detail-width) * 9 / 16));
  }

  .user-detail-dialog .el-dialog__body {
    overflow: auto;
  }
}
</style>
