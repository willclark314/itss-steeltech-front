<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchInterviewList,
  deleteInterview,
  getExportUrl,
  type DirectorInterviewRecord,
} from '@/api/directorInterview'
import { fetchPersonnelList } from '@/api/personnel'
import type { PersonnelRecord } from '@/models/personnel'
import DirectorInterviewEditDialog from '@/components/biz/DirectorInterviewEditDialog.vue'

const loading = ref(false)
const interviews = ref<DirectorInterviewRecord[]>([])
const personnelList = ref<PersonnelRecord[]>([])

const dialogVisible = ref(false)
const editingInterview = ref<DirectorInterviewRecord | null>(null)

const searchForm = reactive({ year: '', month: '', keyword: '' })

const yearOptions = computed(() => {
  const years = []
  for (let y = new Date().getFullYear(); y >= 2025; y--) {
    years.push({ label: `${y}年`, value: `${y}` })
  }
  return years
})

const monthOptions = computed(() => {
  const months = []
  for (let m = 1; m <= 12; m++) {
    months.push({ label: `${m}月`, value: `${m}`.padStart(2, '0') })
  }
  return months
})

const personnelOptions = computed(() =>
  personnelList.value.map((p) => ({ label: p.name, value: p.name })),
)

async function loadInterviews() {
  loading.value = true
  try {
    const result = await fetchInterviewList(searchForm.year, searchForm.month, searchForm.keyword)
    interviews.value = result.list
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载约谈记录失败')
  } finally {
    loading.value = false
  }
}

async function loadPersonnel() {
  try {
    personnelList.value = await fetchPersonnelList({ status: 'active' })
  } catch { /* silent */ }
}

function handleSearch() { loadInterviews() }
function handleReset() {
  searchForm.year = ''
  searchForm.month = ''
  searchForm.keyword = ''
  loadInterviews()
}

function openCreateDialog() {
  editingInterview.value = null
  dialogVisible.value = true
}

function openEditDialog(row: any) {
  editingInterview.value = row as DirectorInterviewRecord
  dialogVisible.value = true
}

async function handleDelete(row: any) {
  const rec = row as DirectorInterviewRecord
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${rec.employeeName}（${rec.interviewDate}）的约谈记录吗？`,
      '删除确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
    )
  } catch { return }
  try {
    await deleteInterview(rec.id)
    ElMessage.success('约谈记录已删除')
    await loadInterviews()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

function handleExport(row: any) {
  const rec = row as DirectorInterviewRecord
  window.open(getExportUrl(rec.id), '_blank')
}

function onSaved() { loadInterviews() }

onMounted(() => { loadInterviews(); loadPersonnel() })
</script>

<template>
  <el-card shadow="never" class="biz-page-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">主任座谈会</span>
          <span class="page-tip">记录主任与员工的一对一约谈，填写沟通交流记录表并导出</span>
        </div>
      </div>
    </template>

    <div class="search-toolbar">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="年份">
          <el-select v-model="searchForm.year" placeholder="全部" clearable style="width: 110px">
            <el-option v-for="opt in yearOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="月份">
          <el-select v-model="searchForm.month" placeholder="全部" clearable style="width: 100px">
            <el-option v-for="opt in monthOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input v-model="searchForm.keyword" placeholder="姓名/工号/主题" clearable style="width: 180px" @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
      <div style="display: flex; align-items: center; gap: 12px">
        <span class="search-total">共 {{ interviews.length }} 条</span>
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>新建约谈
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="table-scroll">
      <el-table :data="interviews" stripe style="width: 100%" :empty-text="loading ? '' : '暂无约谈记录'">
        <el-table-column prop="interviewDate" label="约谈日期" width="120" />
        <el-table-column prop="employeeName" label="员工姓名" width="100" />
        <el-table-column prop="position" label="岗位" width="100" show-overflow-tooltip />
        <el-table-column prop="interviewTopic" label="约谈主题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="division" label="部门" width="120" show-overflow-tooltip />
        <el-table-column prop="interviewer" label="约谈人" width="80" />
        <el-table-column label="图片" width="70" align="center">
          <template #default="{ row }">
            <span v-if="row.images?.length" style="font-size: 12px; color: var(--el-color-primary)">
              {{ row.images.length }} 张
            </span>
            <span v-else style="font-size: 12px; color: var(--el-text-color-placeholder)">无</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="handleExport(row)">导出</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <DirectorInterviewEditDialog
      v-model="dialogVisible"
      :interview="editingInterview"
      :personnel-options="personnelOptions"
      :personnel-list="personnelList"
      @saved="onSaved"
    />
  </el-card>
</template>

<style scoped>
.page-tip { font-size: 12px; font-weight: 400; line-height: 1.2; color: var(--el-text-color-secondary); }
</style>
