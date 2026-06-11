<script setup lang="ts">
import { ref } from 'vue'

interface StorageRow {
  storage: string
  key: string
  label: string
  description: string
  value: string
  isJson: boolean
}

const EMPTY_VALUE = '(无数据)'

const LOCAL_STORAGE_ITEMS = [
  {
    key: 'itss_token',
    label: '登录 Token',
    description: '登录成功后写入，退出登录时清除；API 请求会携带 Authorization 头',
  },
  {
    key: 'itss_user',
    label: '用户信息',
    description: '当前登录用户的 JSON 数据',
    isJson: true,
  },
  {
    key: 'itss_theme',
    label: '主题偏好',
    description: '浅色 (light) 或深色 (dark) 主题',
  },
]

const tableData = ref<StorageRow[]>([])
const loading = ref(false)

function formatValue(raw: string | null, isJson = false) {
  if (raw == null || raw === '') return EMPTY_VALUE

  if (isJson) {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      return raw
    }
  }

  return raw
}

function buildLocalStorageRows(): StorageRow[] {
  return LOCAL_STORAGE_ITEMS.map(({ key, label, description, isJson }) => ({
    storage: 'localStorage',
    key,
    label,
    description,
    value: formatValue(localStorage.getItem(key), isJson),
    isJson: isJson ?? false,
  }))
}

function buildSessionStorageRows(): StorageRow[] {
  const keys = [...Array(sessionStorage.length)]
    .map((_, index) => sessionStorage.key(index))
    .filter((key): key is string => key != null)

  if (keys.length === 0) {
    return [
      {
        storage: 'sessionStorage',
        key: '-',
        label: '会话存储',
        description: '本系统暂未使用 sessionStorage',
        value: EMPTY_VALUE,
        isJson: false,
      },
    ]
  }

  return keys.map((key) => ({
    storage: 'sessionStorage',
    key,
    label: '会话存储',
    description: 'sessionStorage 中的键值',
    value: formatValue(sessionStorage.getItem(key)),
    isJson: false,
  }))
}

function buildCookieRows(): StorageRow[] {
  const raw = document.cookie.trim()

  if (!raw) {
    return [
      {
        storage: 'Cookie',
        key: '-',
        label: 'Cookie',
        description: '本系统暂未使用 Cookie',
        value: EMPTY_VALUE,
        isJson: false,
      },
    ]
  }

  return raw.split(';').map((part) => {
    const [key, ...rest] = part.trim().split('=')
    return {
      storage: 'Cookie',
      key: key.trim(),
      label: 'Cookie',
      description: '浏览器 Cookie',
      value: rest.join('=') || EMPTY_VALUE,
      isJson: false,
    }
  })
}

async function buildIndexedDBRows(): Promise<StorageRow[]> {
  if (!window.indexedDB?.databases) {
    return [
      {
        storage: 'IndexedDB',
        key: '-',
        label: 'IndexedDB',
        description: '本系统暂未使用 IndexedDB（或当前浏览器不支持枚举）',
        value: EMPTY_VALUE,
        isJson: false,
      },
    ]
  }

  const databases = await indexedDB.databases()

  if (databases.length === 0) {
    return [
      {
        storage: 'IndexedDB',
        key: '-',
        label: 'IndexedDB',
        description: '本系统暂未使用 IndexedDB',
        value: EMPTY_VALUE,
        isJson: false,
      },
    ]
  }

  return databases.map((db) => ({
    storage: 'IndexedDB',
    key: db.name ?? '-',
    label: 'IndexedDB 数据库',
    description: `数据库版本 ${db.version ?? '-'}`,
    value: `name: ${db.name ?? '-'}, version: ${db.version ?? '-'}`,
    isJson: false,
  }))
}

async function loadStorageData() {
  loading.value = true
  try {
    tableData.value = [
      ...buildLocalStorageRows(),
      ...buildSessionStorageRows(),
      ...buildCookieRows(),
      ...(await buildIndexedDBRows()),
    ]
  } finally {
    loading.value = false
  }
}

function refresh() {
  loadStorageData()
}

loadStorageData()
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>浏览器储存</span>
        <el-button type="primary" link :loading="loading" @click="refresh">刷新</el-button>
      </div>
    </template>

    <el-space direction="vertical" alignment="start" :size="16" fill>
      <p>
        本页面展示系统在浏览器中持久化或会话相关的数据，包括
        <code>localStorage</code>、<code>sessionStorage</code>、<code>Cookie</code> 与
        <code>IndexedDB</code>。未使用的存储类型也会列出，并显示为「无数据」。
      </p>

      <el-table v-loading="loading" :data="tableData" border stripe style="width: 100%">
        <el-table-column prop="storage" label="存储类型" width="140" />
        <el-table-column prop="key" label="键名" width="140" />
        <el-table-column prop="label" label="说明" width="120" />
        <el-table-column prop="description" label="用途" min-width="220" show-overflow-tooltip />
        <el-table-column prop="value" label="当前值" min-width="260">
          <template #default="{ row }">
            <pre v-if="row.isJson && row.value !== EMPTY_VALUE" class="value-pre">{{ row.value }}</pre>
            <span v-else :class="{ 'empty-value': row.value === EMPTY_VALUE }">{{ row.value }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-space>
  </el-card>
</template>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.value-pre {
  margin: 0;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

.empty-value {
  color: var(--el-text-color-placeholder);
}
</style>
