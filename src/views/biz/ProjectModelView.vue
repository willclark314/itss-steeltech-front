<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createProjectModel,
  deleteProjectModel,
  fetchProjectModelList,
  updateProjectModel,
} from '@/api/projectModels'
import ProjectModelTable from '@/components/biz/ProjectModelTable.vue'
import ProjectModelEditDialog from '@/components/biz/ProjectModelEditDialog.vue'
import {
  ProjectModelForm,
  type ProjectModelFormState,
  type ProjectModelRecord,
  type ProjectModelStatus,
  type ProjectModelType,
} from '@/models/biz/projectModel/ProjectModelForm'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'
import { PAGE_SIZE_OPTIONS } from '@/constants/pagination'
import { canEditPage } from '@/utils/permission'

const canEdit = computed(() => canEditPage('project-model'))
const dialogVisible = ref(false)
const editingRecord = ref<ProjectModelRecord | null>(null)
const editDialogRef = ref<InstanceType<typeof ProjectModelEditDialog>>()

const searchForm = reactive({
  keyword: '',
  modelType: '' as ProjectModelType | '',
  status: '' as ProjectModelStatus | '',
})

const {
  pageSize,
  filteredData,
  total,
  page,
  loading,
  loadPage: loadCachedPage,
  clearFilterCache,
  patchItem,
} = usePaginatedListCache<ProjectModelRecord>({
  getItemKey: (item) => item.id,
  sortList: ProjectModelForm.sortForDisplay,
})

type PaginatedFilters = {
  keyword?: string
  modelType?: ProjectModelType | ''
  status?: ProjectModelStatus | ''
}

function buildListQuery(params: PaginatedFilters & { page?: number; pageSize?: number }) {
  return {
    keyword: params.keyword,
    modelType: params.modelType,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  }
}

async function loadPage(pageNo = 1, nextFilters?: PaginatedFilters, force = false) {
  return loadCachedPage(
    (params) =>
      fetchProjectModelList(
        buildListQuery(params as PaginatedFilters & { page?: number; pageSize?: number }),
      ),
    pageNo,
    nextFilters,
    force,
  )
}

function handleSearch() {
  clearFilterCache()
  void loadPage(1, {
    keyword: searchForm.keyword.trim() || undefined,
    modelType: searchForm.modelType || undefined,
    status: searchForm.status || undefined,
  }, true)
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.modelType = ''
  searchForm.status = ''
  handleSearch()
}

function handlePageChange(pageNo: number) {
  void loadPage(pageNo)
}

function handleSizeChange() {
  void loadPage(1, undefined, true)
}

function openCreateDialog() {
  editingRecord.value = null
  dialogVisible.value = true
}

function openEditDialog(row: ProjectModelRecord) {
  editingRecord.value = row
  dialogVisible.value = true
}

async function handleSave(form: ProjectModelFormState) {
  editDialogRef.value?.setSubmitting(true)
  try {
    if (editingRecord.value) {
      const updated = await updateProjectModel(editingRecord.value.id, form)
      patchItem(updated.id, () => updated)
      ElMessage.success('项目模型已更新')
    } else {
      await createProjectModel(form)
      ElMessage.success('项目模型已创建')
      handleSearch()
    }
    dialogVisible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    editDialogRef.value?.setSubmitting(false)
  }
}

async function handleDelete(row: ProjectModelRecord) {
  try {
    await ElMessageBox.confirm(
      `确定删除项目「${row.projectNo}」下的模型「${row.name}」吗？`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await deleteProjectModel(row.id)
    ElMessage.success('已删除')
    handleSearch()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}

onMounted(() => {
  handleSearch()
})
</script>

<template>
  <el-card shadow="never" class="biz-page-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">项目模型管理</span>
          <span class="card-subtitle">管理细化项目及甲供模型，一个项目可关联多个模型</span>
        </div>
        <el-button v-if="canEdit" type="primary" @click="openCreateDialog">新建模型</el-button>
      </div>
    </template>

    <div class="search-toolbar">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="项目号 / 项目名称 / 模型名称"
            clearable
            style="width: 240px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="模型类型">
          <el-select v-model="searchForm.modelType" placeholder="全部" style="width: 140px">
            <el-option
              v-for="item in ProjectModelForm.MODEL_TYPE_OPTIONS"
              :key="item.value || 'all'"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" style="width: 120px">
            <el-option
              v-for="item in ProjectModelForm.STATUS_OPTIONS"
              :key="item.value || 'all'"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
      <span class="search-total">共 {{ total }} 条</span>
    </div>

    <div class="project-view-body">
      <div class="table-scroll">
        <ProjectModelTable
          :data="filteredData"
          :loading="loading"
          :can-edit="canEdit"
          @edit="openEditDialog"
          @delete="handleDelete"
        />
      </div>
      <div class="table-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[...PAGE_SIZE_OPTIONS]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </el-card>

  <ProjectModelEditDialog
    ref="editDialogRef"
    v-model:visible="dialogVisible"
    :record="editingRecord"
    @save="handleSave"
  />
</template>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-header__title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-subtitle {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-weight: normal;
}

.search-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.search-total {
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  line-height: 32px;
}

.project-view-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-scroll {
  overflow: auto;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
