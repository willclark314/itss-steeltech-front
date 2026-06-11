<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { fetchSystemConfig, updateSystemConfig } from '@/api/system'
import { SystemConfigForm } from '@/models/biz/SystemConfigForm'

const loading = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const form = reactive(SystemConfigForm.createEmpty())
const formRules = SystemConfigForm.FORM_RULES

const sampleFullPath = computed(() => SystemConfigForm.buildSampleFullPath(form.localWorkPath))

async function loadConfig() {
  loading.value = true
  try {
    const response = await fetchSystemConfig()
    Object.assign(form, SystemConfigForm.fromResponse(response))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载系统配置失败')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const response = await updateSystemConfig(SystemConfigForm.toPayload(form))
    Object.assign(form, SystemConfigForm.fromResponse(response))
    ElMessage.success('系统配置已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存系统配置失败')
  } finally {
    saving.value = false
  }
}

function handleReset() {
  void loadConfig()
}

onMounted(() => {
  void loadConfig()
})
</script>

<template>
  <div v-loading="loading" class="system-config-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>全局配置</span>
          <span class="card-subtitle">系统级设置，对所有用户生效</span>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="page-alert"
        title="此处配置的是系统全局参数。用户个人信息与密码请在右上角用户菜单中维护。"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="120px"
        class="config-form"
        @submit.prevent
      >
        <div class="section-title">本地工作路径</div>
        <p class="section-desc">
          用于将项目中的相对路径拼接为 UNC 完整路径，供本地文件夹打开与路径检测使用。
        </p>

        <el-form-item label="文件服务器 IP" prop="localWorkPath.ip">
          <el-input
            v-model="form.localWorkPath.ip"
            placeholder="如 10.10.1.175"
            maxlength="15"
            style="max-width: 320px"
          />
        </el-form-item>

        <el-form-item label="默认盘符" prop="localWorkPath.drive">
          <el-input
            v-model="form.localWorkPath.drive"
            placeholder="如 F"
            maxlength="1"
            style="max-width: 120px"
          />
          <span class="field-hint">单个字母，不含冒号</span>
        </el-form-item>

        <el-form-item label="路径示例">
          <code class="path-preview">{{ sampleFullPath }}</code>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">
            保存配置
          </el-button>
          <el-button :disabled="loading || saving" @click="handleReset">
            重新加载
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.system-config-page {
  max-width: 760px;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.page-alert {
  margin-bottom: 20px;
}

.section-title {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.section-desc {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.config-form {
  max-width: 640px;
}

.field-hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.path-preview {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}
</style>
