<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import {
  fetchHostDrives,
  fetchLocalIps,
  fetchSystemConfig,
  updateSystemConfig,
  type HostDriveInfo,
} from '@/api/system'
import {
  fetchDbMigrateStatus,
  previewDbMigrate,
  runDbMigrate,
  verifyDbMigrate,
  type DbMigrateResult,
  type DbMigrateStatus,
  type DbSyncMode,
} from '@/api/dbMigrate'
import { BusinessSystemConfig } from '@/models/biz'
import { SystemConfigForm } from '@/models/biz/SystemConfigForm'
import { canEditPage } from '@/utils/permission'

const canEdit = computed(() => canEditPage('system-settings'))
const loading = ref(false)
const saving = ref(false)
const drivesLoading = ref(false)
const drivesDialogVisible = ref(false)
const drivesDialogIp = ref('')
const drivesDialogIsLocal = ref(false)
const drivesList = ref<HostDriveInfo[]>([])
const formRef = ref<FormInstance>()
const form = reactive(SystemConfigForm.createEmpty())
const formRules = SystemConfigForm.FORM_RULES
const localIpOptions = ref<string[]>([])
const ipSelectWrapRef = ref<HTMLElement>()
const maxVisibleIpTags = ref(99)
let ipTagsResizeObserver: ResizeObserver | null = null

const migrateStatus = ref<DbMigrateStatus | null>(null)
const migrateTargetUrl = ref('')
const migrateMode = ref<DbSyncMode>('upsert')
const migrateBackupFirst = ref(true)
const migrateBusy = ref(false)
const migrateResult = ref<DbMigrateResult | null>(null)

type DriveRowLike = {
  name?: string
  label?: string
  type?: HostDriveInfo['type'] | string
  totalBytes?: number
  freeBytes?: number
}

const designPatternPreview = computed(() =>
  SystemConfigForm.buildPatternPreview(form.localWorkPath, 'design'),
)
const detailJiagongdanPatternPreview = computed(() =>
  SystemConfigForm.buildPatternPreview(form.localWorkPath, 'detailJiagongdan'),
)
const detailPatternPreview = computed(() =>
  SystemConfigForm.buildPatternPreview(form.localWorkPath, 'detail'),
)
const designFullPathPreview = computed(() =>
  SystemConfigForm.buildSampleFullPath(form.localWorkPath, form.localWorkPath.pathPatterns.design),
)
const detailJiagongdanFullPathPreview = computed(() =>
  SystemConfigForm.buildSampleFullPath(
    form.localWorkPath,
    form.localWorkPath.pathPatterns.detailJiagongdan,
  ),
)
const detailFullPathPreview = computed(() =>
  SystemConfigForm.buildSampleFullPath(form.localWorkPath, form.localWorkPath.pathPatterns.detail),
)

const designArchiveTemplateFullPathPreview = computed(() =>
  SystemConfigForm.buildSampleFullPath(
    form.localWorkPath,
    form.localWorkPath.archiveTemplatePaths.design,
  ),
)
const detailJiagongdanArchiveTemplateFullPathPreview = computed(() =>
  SystemConfigForm.buildSampleFullPath(
    form.localWorkPath,
    form.localWorkPath.archiveTemplatePaths.detailJiagongdan,
  ),
)
const detailArchiveTemplateFullPathPreview = computed(() =>
  SystemConfigForm.buildSampleFullPath(
    form.localWorkPath,
    form.localWorkPath.archiveTemplatePaths.detail,
  ),
)

const ipSelectOptions = computed(() =>
  form.localWorkPath.ips.map((ip) => ({
    value: ip,
    label: localIpOptions.value.includes(ip) ? `${ip}（本机）` : ip,
  })),
)

function normalizeSelectedIps(rawIps: string[]) {
  const normalized = BusinessSystemConfig.normalizeIpList(rawIps)
  if (normalized.length !== rawIps.length) {
    ElMessage.warning('已忽略格式不正确的 IP')
  }
  form.localWorkPath.ips = normalized
  if (!form.localWorkPath.ips.includes(form.localWorkPath.ip)) {
    form.localWorkPath.ip = form.localWorkPath.ips[0]
  }
}

function handleIpsChange(nextIps: string[]) {
  normalizeSelectedIps(nextIps)
}

function handleActiveIpChange(nextIp: string) {
  const ip = String(nextIp).trim()
  if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return
  if (!form.localWorkPath.ips.includes(ip)) {
    normalizeSelectedIps([...form.localWorkPath.ips, ip])
  }
}

function estimateIpTagWidth(ip: string) {
  const label = localIpOptions.value.includes(ip) ? `${ip}（本机）` : ip
  return Math.min(220, Math.max(96, label.length * 8 + 36))
}

function refreshMaxVisibleIpTags() {
  const container = ipSelectWrapRef.value
  if (!container) return

  const width = container.clientWidth
  const collapseReserve = 44
  const ips = form.localWorkPath.ips

  if (!ips.length) {
    maxVisibleIpTags.value = 99
    return
  }

  let used = 0
  let fit = 0

  for (let index = 0; index < ips.length; index += 1) {
    const tagWidth = estimateIpTagWidth(ips[index])
    const remaining = ips.length - (index + 1)
    const extra = remaining > 0 ? collapseReserve : 0

    if (used + tagWidth + extra > width && fit > 0) break

    used += tagWidth + 4
    fit += 1
  }

  maxVisibleIpTags.value = Math.max(1, fit || ips.length)
}

function setupIpTagsResizeObserver() {
  if (!ipSelectWrapRef.value) return

  ipTagsResizeObserver?.disconnect()
  ipTagsResizeObserver = new ResizeObserver(() => refreshMaxVisibleIpTags())
  ipTagsResizeObserver.observe(ipSelectWrapRef.value)
  refreshMaxVisibleIpTags()
}

async function loadLocalIpOptions() {
  try {
    const response = await fetchLocalIps()
    localIpOptions.value = response.ips
    SystemConfigForm.mergeLocalIpOptions(form.localWorkPath, response.ips)
  } catch {
    localIpOptions.value = []
  }
}

async function loadConfig() {
  loading.value = true
  try {
    const response = await fetchSystemConfig()
    Object.assign(form, SystemConfigForm.fromResponse(response))
    SystemConfigForm.mergeLocalIpOptions(form.localWorkPath, localIpOptions.value)
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
    SystemConfigForm.mergeLocalIpOptions(form.localWorkPath, localIpOptions.value)
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

function formatBytes(value?: number) {
  if (value == null || value < 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const digits = size >= 100 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(digits)} ${units[unitIndex]}`
}

function formatDriveSpace(row: DriveRowLike) {
  if (row.freeBytes == null || row.totalBytes == null) return '-'
  return `${formatBytes(row.freeBytes)} 可用 / ${formatBytes(row.totalBytes)}`
}

function driveFreePercent(row: DriveRowLike) {
  if (row.freeBytes == null || !row.totalBytes) return 0
  return Math.min(100, Math.round((row.freeBytes / row.totalBytes) * 100))
}

async function handleViewDrives() {
  const ip = form.localWorkPath.ip.trim()
  if (!ip) {
    ElMessage.warning('请先选择 IP')
    return
  }

  drivesLoading.value = true
  drivesDialogVisible.value = true
  drivesDialogIp.value = ip
  drivesList.value = []

  try {
    const result = await fetchHostDrives(ip)
    drivesDialogIp.value = result.ip
    drivesDialogIsLocal.value = result.isLocal
    drivesList.value = result.drives
    if (!result.drives.length) {
      ElMessage.info('未检测到可访问的驱动或共享')
    }
  } catch (error) {
    drivesDialogVisible.value = false
    ElMessage.error(error instanceof Error ? error.message : '获取驱动列表失败')
  } finally {
    drivesLoading.value = false
  }
}

async function loadMigrateStatus() {
  try {
    migrateStatus.value = await fetchDbMigrateStatus()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载数据库状态失败')
  }
}

function requireMigrateTargetUrl(): string | null {
  const url = migrateTargetUrl.value.trim()
  if (!url) {
    ElMessage.warning('请填写目标库 DATABASE_URL')
    return null
  }
  return url
}

async function handleMigratePreview() {
  const targetUrl = requireMigrateTargetUrl()
  if (!targetUrl) return
  migrateBusy.value = true
  migrateResult.value = null
  try {
    migrateResult.value = await previewDbMigrate(targetUrl)
    ElMessage.success('预览完成（未写入目标库）')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '预览失败')
  } finally {
    migrateBusy.value = false
  }
}

async function handleMigrateRun() {
  const targetUrl = requireMigrateTargetUrl()
  if (!targetUrl) return
  migrateBusy.value = true
  migrateResult.value = null
  try {
    migrateResult.value = await runDbMigrate({
      targetUrl,
      mode: migrateMode.value,
      backupFirst: migrateBackupFirst.value,
    })
    if (migrateResult.value.ok) {
      ElMessage.success('迁移完成，请按下方指引修改 DATABASE_URL 并重启后端')
    } else {
      ElMessage.warning('迁移结束但存在错误或校验未通过，请查看结果')
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '迁移失败')
  } finally {
    migrateBusy.value = false
  }
}

async function handleMigrateVerify() {
  const targetUrl = requireMigrateTargetUrl()
  if (!targetUrl) return
  migrateBusy.value = true
  migrateResult.value = null
  try {
    migrateResult.value = await verifyDbMigrate(targetUrl)
    if (migrateResult.value.ok) {
      ElMessage.success('行数校验通过')
    } else {
      ElMessage.warning('行数校验未通过，请查看差异')
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '校验失败')
  } finally {
    migrateBusy.value = false
  }
}

watch(
  () => form.localWorkPath.ip,
  (nextIp) => {
    handleActiveIpChange(nextIp)
  },
)

watch(
  () => [...form.localWorkPath.ips, ...localIpOptions.value],
  () => {
    void nextTick(() => refreshMaxVisibleIpTags())
  },
)

onMounted(async () => {
  await loadLocalIpOptions()
  await loadConfig()
  await loadMigrateStatus()
  await nextTick()
  setupIpTagsResizeObserver()
})

onUnmounted(() => {
  ipTagsResizeObserver?.disconnect()
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
        label-width="140px"
        class="config-form"
        @submit.prevent
      >
        <div class="section-title">本地工作路径</div>
        <p class="section-desc">
          用于将项目中的相对路径拼接为 UNC 完整路径，供本地文件夹打开与路径检测使用。
        </p>

        <el-form-item label="IP 候选列表" prop="localWorkPath.ips">
          <div ref="ipSelectWrapRef" class="ip-candidate-wrap">
            <el-select
              v-model="form.localWorkPath.ips"
              multiple
              filterable
              allow-create
              default-first-option
              collapse-tags
              :max-collapse-tags="maxVisibleIpTags"
              collapse-tags-tooltip
              class="ip-candidate-select"
              placeholder="选择或输入 IP，可多选"
              @change="handleIpsChange"
            >
              <el-option
                v-for="item in ipSelectOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>
          <span class="field-hint block-hint">
            默认保留 {{ BusinessSystemConfig.DEFAULT_SERVER_IP }}，并自动加入本机 IP
          </span>
        </el-form-item>

        <el-form-item label="当前使用 IP" prop="localWorkPath.ip">
          <div class="ip-action-row">
            <el-select
              v-model="form.localWorkPath.ip"
              filterable
              allow-create
              default-first-option
              placeholder="选择当前使用的 IP"
              style="width: 100%; max-width: 320px"
              @change="handleActiveIpChange"
            >
              <el-option
                v-for="item in ipSelectOptions"
                :key="`active-${item.value}`"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-button
              :disabled="!form.localWorkPath.ip"
              :loading="drivesLoading"
              @click="handleViewDrives"
            >
              查看驱动
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="路径智能匹配">
          <el-switch
            v-model="form.localWorkPath.suggestPathOnMismatch"
            active-text="开启"
            inactive-text="关闭"
          />
          <span class="field-hint block-hint">
            项目管理页检查本地路径时，若路径不存在或与项目号不匹配，将自动搜索候选路径并提示是否更新
          </span>
        </el-form-item>

        <div class="section-title">路径组合规则</div>
        <p class="section-desc">
          创建项目本地路径时按规则拼接相对路径。可用变量：
          <code>{year}</code>、<code>{year2}</code>、<code>{projectNo}</code>、
          <code>{projectNoDigits}</code>、<code>{projectName}</code>、
          <code>{projectFolder}</code>、<code>{date}</code>
        </p>

        <el-form-item label="设计组规则">
          <el-input
            v-model="form.localWorkPath.pathPatterns.design"
            type="textarea"
            :rows="2"
            placeholder="如 e\【项目归档】设计组\【{year}年】\{projectFolder}"
          />
          <div class="pattern-preview-block">
            <span class="pattern-preview-label">相对路径示例</span>
            <code class="path-preview">{{ designPatternPreview }}</code>
            <span class="pattern-preview-label">完整路径示例</span>
            <code class="path-preview">{{ designFullPathPreview }}</code>
          </div>
        </el-form-item>

        <el-form-item label="深化组加工单规则">
          <el-input
            v-model="form.localWorkPath.pathPatterns.detailJiagongdan"
            type="textarea"
            :rows="2"
            placeholder="如 f\1【项目归档】深化组\【{year}】加工单归档（甲供）\{projectFolder}"
          />
          <div class="pattern-preview-block">
            <span class="pattern-preview-label">相对路径示例</span>
            <code class="path-preview">{{ detailJiagongdanPatternPreview }}</code>
            <span class="pattern-preview-label">完整路径示例</span>
            <code class="path-preview">{{ detailJiagongdanFullPathPreview }}</code>
          </div>
        </el-form-item>

        <el-form-item label="深化组规则">
          <el-input
            v-model="form.localWorkPath.pathPatterns.detail"
            type="textarea"
            :rows="2"
            placeholder="如 f\1【项目归档】深化组\【{year}】深化组归档\{projectFolder}"
          />
          <div class="pattern-preview-block">
            <span class="pattern-preview-label">相对路径示例</span>
            <code class="path-preview">{{ detailPatternPreview }}</code>
            <span class="pattern-preview-label">完整路径示例</span>
            <code class="path-preview">{{ detailFullPathPreview }}</code>
          </div>
        </el-form-item>

        <div class="section-title">归档模板路径</div>
        <p class="section-desc">
          创建项目归档路径时，从此处配置的模板目录复制文件与文件夹结构到目标路径。
        </p>

        <el-form-item label="设计归档模板">
          <el-input
            v-model="form.localWorkPath.archiveTemplatePaths.design"
            type="textarea"
            :rows="2"
            placeholder="如 e\【项目归档】设计组\模板\设计归档模板"
          />
          <div class="pattern-preview-block">
            <span class="pattern-preview-label">完整路径示例</span>
            <code class="path-preview">{{ designArchiveTemplateFullPathPreview || '（未配置）' }}</code>
          </div>
        </el-form-item>

        <el-form-item label="细化加工单模板">
          <el-input
            v-model="form.localWorkPath.archiveTemplatePaths.detailJiagongdan"
            type="textarea"
            :rows="2"
            placeholder="如 f\1【项目归档】深化组\模板\加工单归档模板"
          />
          <div class="pattern-preview-block">
            <span class="pattern-preview-label">完整路径示例</span>
            <code class="path-preview">{{ detailJiagongdanArchiveTemplateFullPathPreview || '（未配置）' }}</code>
          </div>
        </el-form-item>

        <el-form-item label="细化归档模板">
          <el-input
            v-model="form.localWorkPath.archiveTemplatePaths.detail"
            type="textarea"
            :rows="2"
            placeholder="如 f\1【项目归档】深化组\模板\深化组归档模板"
          />
          <div class="pattern-preview-block">
            <span class="pattern-preview-label">完整路径示例</span>
            <code class="path-preview">{{ detailArchiveTemplateFullPathPreview || '（未配置）' }}</code>
          </div>
        </el-form-item>

        <el-form-item v-if="canEdit">
          <el-button type="primary" :loading="saving" @click="handleSave">
            保存配置
          </el-button>
          <el-button :disabled="loading || saving" @click="handleReset">
            重新加载
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="migrate-card">
      <template #header>
        <div class="card-header">
          <span>数据库迁移</span>
          <span class="card-subtitle">SQLite ↔ MySQL 全量迁移（改配置后需重启）</span>
        </div>
      </template>

      <el-alert
        type="warning"
        :closable="false"
        show-icon
        class="page-alert"
        title="迁移只会把数据写入目标库，不会热切换当前连接。完成后请修改服务器 DATABASE_URL 并重启后端。"
      />

      <div class="migrate-status" v-loading="!migrateStatus && migrateBusy">
        <p class="section-desc">
          当前后端：
          <strong>{{ migrateStatus?.current_backend || '—' }}</strong>
          <span class="field-hint">{{ migrateStatus?.current_url_masked || '' }}</span>
        </p>
        <p v-if="migrateStatus?.suggested_target_backend" class="section-desc">
          建议目标：{{ migrateStatus.suggested_target_backend }}
        </p>
      </div>

      <el-form label-width="140px" class="config-form" @submit.prevent>
        <el-form-item label="目标 DATABASE_URL">
          <el-input
            v-model="migrateTargetUrl"
            type="textarea"
            :rows="2"
            :disabled="!canEdit || migrateBusy"
            placeholder="如 mysql+pymysql://user:pass@127.0.0.1:3306/itss_steeltech 或 sqlite:///D:/data/steeltech.db"
          />
        </el-form-item>

        <el-form-item label="写入模式">
          <el-radio-group v-model="migrateMode" :disabled="!canEdit || migrateBusy">
            <el-radio value="upsert">upsert（按主键合并）</el-radio>
            <el-radio value="replace">replace（先清空目标表）</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="迁移前备份">
          <el-switch v-model="migrateBackupFirst" :disabled="!canEdit || migrateBusy" />
          <span class="field-hint">执行迁移时先备份当前库</span>
        </el-form-item>

        <el-form-item v-if="canEdit">
          <el-button :loading="migrateBusy" @click="handleMigratePreview">预览</el-button>
          <el-button type="primary" :loading="migrateBusy" @click="handleMigrateRun">
            执行迁移
          </el-button>
          <el-button :loading="migrateBusy" @click="handleMigrateVerify">仅校验</el-button>
        </el-form-item>
      </el-form>

      <div v-if="migrateResult" class="migrate-result">
        <div class="section-title">最近一次结果</div>
        <p class="section-desc">
          状态：
          <strong>{{ migrateResult.ok === false ? '未通过 / 有错误' : migrateResult.ok ? '成功' : '已返回' }}</strong>
          <template v-if="migrateResult.sync">
            · 表 {{ migrateResult.sync.tables }} · 行 {{ migrateResult.sync.rows }} · 错误
            {{ migrateResult.sync.errors }}
          </template>
        </p>

        <ul
          v-if="migrateResult.switch_instructions?.steps?.length"
          class="migrate-steps"
        >
          <li v-for="(step, index) in migrateResult.switch_instructions.steps" :key="index">
            {{ step }}
          </li>
        </ul>

        <div
          v-if="migrateResult.verify && migrateResult.verify.mismatches.length"
          class="migrate-diff"
        >
          <p class="section-desc">行数差异：</p>
          <ul>
            <li
              v-for="item in migrateResult.verify.mismatches"
              :key="item.table"
            >
              {{ item.table }}：源 {{ item.source_count }} / 目标 {{ item.target_count }}
            </li>
          </ul>
        </div>

        <details v-if="migrateResult.logs?.length" class="migrate-logs">
          <summary>日志（{{ migrateResult.logs.length }}）</summary>
          <pre>{{ migrateResult.logs.join('\n') }}</pre>
        </details>
      </div>
    </el-card>

    <el-dialog
      v-model="drivesDialogVisible"
      :title="`可用驱动 - ${drivesDialogIp}`"
      width="620px"
      destroy-on-close
    >
      <p class="dialog-desc">
        {{
          drivesDialogIsLocal
            ? '本机逻辑驱动器，可查看剩余空间'
            : '远程共享或管理盘'
        }}
      </p>
      <el-table
        v-loading="drivesLoading"
        :data="drivesList"
        empty-text="未检测到可访问驱动"
      >
        <el-table-column prop="label" label="名称" min-width="88" />
        <el-table-column prop="type" label="类型" width="96">
          <template #default="{ row }">
            {{ row.type === 'local' ? '本地盘符' : '网络共享' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="drivesDialogIsLocal"
          label="剩余空间"
          min-width="220"
        >
          <template #default="{ row }">
            <div v-if="row.freeBytes != null && row.totalBytes" class="drive-space">
              <el-progress
                :percentage="driveFreePercent(row)"
                :stroke-width="8"
                :show-text="false"
                status="success"
              />
              <span class="drive-space-text">{{ formatDriveSpace(row) }}</span>
            </div>
            <span v-else class="drive-space-empty">-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<style scoped>
.system-config-page {
  max-width: 760px;
}

.migrate-card {
  margin-top: 16px;
}

.migrate-steps {
  margin: 0 0 12px;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.migrate-diff ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.6;
}

.migrate-logs {
  margin-top: 12px;
  font-size: 12px;
}

.migrate-logs pre {
  margin: 8px 0 0;
  max-height: 240px;
  overflow: auto;
  padding: 8px 10px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  white-space: pre-wrap;
  word-break: break-all;
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

.block-hint {
  display: block;
  margin-top: 6px;
  margin-left: 0;
}

.ip-candidate-wrap {
  width: 100%;
  max-width: 520px;
}

.ip-candidate-select {
  width: 100%;
}

.ip-action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 520px;
}

.path-preview {
  display: block;
  padding: 6px 10px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}

.pattern-preview-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  width: 100%;
}

.pattern-preview-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dialog-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.drive-space {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drive-space-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.4;
}

.drive-space-empty {
  color: var(--el-text-color-placeholder);
}
</style>
