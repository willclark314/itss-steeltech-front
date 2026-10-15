<template>
  <el-card shadow="never">
    <template #header>
      <span>开发页面 3 — 文件夹打开 Demo</span>
    </template>

    <p style="margin-bottom: 16px; color: #909399;">
      通过后端调用系统资源管理器打开本地或 UNC 网络共享文件夹。
    </p>

    <!-- 预设路径 -->
    <el-divider content-position="left">常用路径（一键打开）</el-divider>
    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
      <el-button
        v-for="item in presetPaths"
        :key="item.path"
        type="primary"
        plain
        :loading="loadingPath === item.path"
        @click="handleOpen(item.path)"
      >
        {{ item.label }}
      </el-button>
    </div>

    <!-- 自定义路径 -->
    <el-divider content-position="left">自定义路径</el-divider>
    <div style="display: flex; gap: 8px; align-items: flex-start;">
      <el-input
        v-model="customPath"
        placeholder="输入本地或网络路径，如 \\10.10.1.175\e\..."
        clearable
        style="flex: 1;"
        @keyup.enter="handleOpen(customPath)"
      />
      <el-button
        type="primary"
        :loading="loadingPath === customPath"
        :disabled="!customPath.trim()"
        @click="handleOpen(customPath)"
      >
        打开文件夹
      </el-button>
    </div>

    <!-- 打开记录 -->
    <template v-if="history.length">
      <el-divider content-position="left">打开记录</el-divider>
      <el-table :data="history" size="small" stripe style="width: 100%;">
        <el-table-column prop="path" label="路径" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">
              {{ row.success ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="time" label="时间" width="160" />
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="handleOpen(row.path)">
              再开
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { openFolder } from '@/api/fileSystem'

interface HistoryItem {
  path: string
  success: boolean
  time: string
}

const customPath = ref('')
const loadingPath = ref('')
const history = ref<HistoryItem[]>([])

const presetPaths = [
  {
    label: '📁 月度培训 — 2026年6月',
    path: '\\\\10.10.1.175\\e\\4-管理\\7.月度制度培训\\【2026年度】\\2026年6月',
  },
  {
    label: '📁 月度培训 — 2026年5月',
    path: '\\\\10.10.1.175\\e\\4-管理\\7.月度制度培训\\【2026年度】\\2026年5月',
  },
  {
    label: '📁 月度培训 — 2026年4月',
    path: '\\\\10.10.1.175\\e\\4-管理\\7.月度制度培训\\【2026年度】\\2026年4月',
  },
  {
    label: '📁 月度培训 — 2026年1月',
    path: '\\\\10.10.1.175\\e\\4-管理\\7.月度制度培训\\【2026年度】\\2026年1月',
  },
  {
    label: '📁 项目文件夹',
    path: 'C:\\Users\\willc\\Documents\\github\\itss-steeltech',
  },
]

function formatTime(): string {
  return new Date().toLocaleString('zh-CN')
}

async function handleOpen(folderPath: string) {
  const trimmed = folderPath.trim()
  if (!trimmed) {
    ElMessage.warning('请输入文件夹路径')
    return
  }

  loadingPath.value = trimmed

  try {
    await openFolder(trimmed)
    ElMessage.success(`已打开: ${trimmed}`)
    history.value.unshift({ path: trimmed, success: true, time: formatTime() })
  } catch (err: any) {
    ElMessage.error(err.message || '打开失败')
    history.value.unshift({ path: trimmed, success: false, time: formatTime() })
  } finally {
    loadingPath.value = ''
  }
}
</script>
