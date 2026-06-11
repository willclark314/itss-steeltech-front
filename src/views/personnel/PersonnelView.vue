<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchPersonnelList } from '@/api/personnel'
import { PersonnelForm } from '@/models/personnel'
import type { PersonnelGroupBy, PersonnelRecord } from '@/models/personnel'
import PersonnelDetailDrawer from '@/components/personnel/PersonnelDetailDrawer.vue'
import PersonnelTable from '@/components/personnel/PersonnelTable.vue'

const loading = ref(false)
const detailVisible = ref(false)
const currentRecord = ref<PersonnelRecord | null>(null)

const searchForm = reactive({
  keyword: '',
  status: '',
})

const statusOptions = PersonnelForm.STATUS_OPTIONS
const groupByOptions = PersonnelForm.GROUP_BY_OPTIONS

const tableData = ref<PersonnelRecord[]>([])
const filteredData = ref<PersonnelRecord[]>([])
const groupBy = ref<PersonnelGroupBy>('team')

const recordGroups = computed(() => PersonnelForm.groupRecords(filteredData.value, groupBy.value))
const isGrouped = computed(() => Boolean(groupBy.value))

async function loadPersonnel() {
  loading.value = true
  try {
    tableData.value = await fetchPersonnelList()
    filteredData.value = PersonnelForm.filter(tableData.value, searchForm)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载人员数据失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  filteredData.value = PersonnelForm.filter(tableData.value, searchForm)
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.status = ''
  filteredData.value = [...tableData.value]
}

onMounted(() => {
  void loadPersonnel()
})

function openDetail(row: PersonnelRecord) {
  currentRecord.value = row
  detailVisible.value = true
}

function handleDetailClosed() {
  currentRecord.value = null
}

function handlePersonnelUpdated(record: PersonnelRecord) {
  const index = tableData.value.findIndex((item) => item.id === record.id)
  if (index !== -1) {
    tableData.value[index] = record
  }
  currentRecord.value = record
  handleSearch()
}

function handlePersonnelDeleted(id: string) {
  tableData.value = tableData.value.filter((item) => item.id !== id)
  currentRecord.value = null
  handleSearch()
}
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <span>人员</span>
    </template>

    <el-form :inline="true" :model="searchForm" class="search-form">
      <el-form-item label="关键词">
        <el-input
          v-model="searchForm.keyword"
          placeholder="姓名 / 工号 / 国籍 / 岗位 / 电话 / 宿舍号"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="searchForm.status" placeholder="全部" style="width: 120px">
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
      <el-form-item label="分组">
        <el-select v-model="groupBy" style="width: 130px">
          <el-option
            v-for="item in groupByOptions"
            :key="item.value || 'list'"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <PersonnelTable
      v-if="!isGrouped"
      :data="filteredData"
      :loading="loading"
      :show-team="true"
      :show-nationality="true"
      :show-dormitory="true"
      @row-click="openDetail"
      @detail="openDetail"
    />

    <div v-else v-loading="loading" class="record-group-list">
      <div v-for="group in recordGroups" :key="group.key" class="record-section">
        <div class="record-section-header">
          <span class="record-section-title">{{ group.label }}</span>
          <span class="record-section-count">{{ group.members.length }} 人</span>
        </div>
        <PersonnelTable
          :data="group.members"
          :show-team="groupBy !== 'team'"
          :show-nationality="groupBy !== 'nationality'"
          :show-dormitory="groupBy !== 'dormitory'"
          @row-click="openDetail"
          @detail="openDetail"
        />
      </div>
      <el-empty v-if="!recordGroups.length" description="暂无匹配人员" />
    </div>
  </el-card>

  <PersonnelDetailDrawer
    v-model="detailVisible"
    :record="currentRecord"
    @updated="handlePersonnelUpdated"
    @deleted="handlePersonnelDeleted"
    @closed="handleDetailClosed"
  />
</template>

<style scoped>
.search-form {
  margin-bottom: 16px;
}

.record-group-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-x: auto;
}

.record-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.record-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.record-section-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
