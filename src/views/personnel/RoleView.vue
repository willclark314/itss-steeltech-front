<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchPersonnelList } from '@/api/personnel'
import { deleteRole, fetchPermissionList, fetchRoleList } from '@/api/roles'
import RoleFormDialog from '@/components/personnel/RoleFormDialog.vue'
import { RoleForm } from '@/models/personnel'
import type { PermissionRecord, PersonnelRecord, RoleRecord, RoleStatus } from '@/models/personnel'

const loading = ref(false)
const dialogVisible = ref(false)
const editingRole = ref<RoleRecord | null>(null)

const searchForm = reactive({
  keyword: '',
  status: '',
})

const statusOptions = RoleForm.STATUS_OPTIONS
const statusMap = RoleForm.STATUS_MAP

const tableData = ref<RoleRecord[]>([])
const filteredData = ref<RoleRecord[]>([])
const permissionOptions = ref<PermissionRecord[]>(RoleForm.PERMISSION_CATALOG)
const personnelOptions = ref<PersonnelRecord[]>([])

async function loadRoles() {
  loading.value = true
  try {
    tableData.value = await fetchRoleList()
    filteredData.value = RoleForm.filter(tableData.value, searchForm)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载角色数据失败')
  } finally {
    loading.value = false
  }
}

async function loadPermissionOptions() {
  try {
    permissionOptions.value = await fetchPermissionList()
  } catch {
    permissionOptions.value = RoleForm.PERMISSION_CATALOG
  }
}

async function loadPersonnelOptions() {
  try {
    personnelOptions.value = await fetchPersonnelList()
  } catch {
    personnelOptions.value = []
  }
}

onMounted(() => {
  void loadPermissionOptions()
  void loadPersonnelOptions()
  void loadRoles()
})

function handleSearch() {
  filteredData.value = RoleForm.filter(tableData.value, searchForm)
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.status = ''
  filteredData.value = [...tableData.value]
}

function getStatusMeta(status: RoleStatus) {
  return statusMap[status]
}

function openCreateDialog() {
  editingRole.value = null
  dialogVisible.value = true
}

function openEditDialog(row: RoleRecord) {
  editingRole.value = row
  dialogVisible.value = true
}

function handleDialogClosed() {
  editingRole.value = null
}

function replaceRoleInTable(updated: RoleRecord) {
  const index = tableData.value.findIndex((item) => item.id === updated.id)
  if (index !== -1) {
    tableData.value[index] = updated
  }
}

function handleRoleCreated(created: RoleRecord) {
  tableData.value.unshift(created)
  handleSearch()
}

function handleRoleUpdated(updated: RoleRecord) {
  replaceRoleInTable(updated)
  handleSearch()
}

async function handleDelete(row: RoleRecord) {
  try {
    await ElMessageBox.confirm(`确定删除角色「${row.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    await deleteRole(row.id)
    tableData.value = tableData.value.filter((item) => item.id !== row.id)
    handleSearch()
    ElMessage.success('角色已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除角色失败')
  }
}
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>角色</span>
        <el-button type="primary" @click="openCreateDialog">新建角色</el-button>
      </div>
    </template>

    <el-form :inline="true" :model="searchForm" class="search-form">
      <el-form-item label="关键词">
        <el-input
          v-model="searchForm.keyword"
          placeholder="角色名称 / 编码 / 人员 / 页面"
          clearable
          style="width: 260px"
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
    </el-form>

    <el-table v-loading="loading" :data="filteredData" stripe class="role-table">
      <el-table-column prop="name" label="角色名称" min-width="140" />
      <el-table-column prop="code" label="角色编码" width="120" />
      <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
      <el-table-column label="关联人员" min-width="180">
        <template #default="{ row }">
          <div v-if="row.assignedPersonnel?.length" class="tag-list">
            <el-tag
              v-for="person in row.assignedPersonnel"
              :key="person.id"
              size="small"
              type="info"
              :title="`${person.name} · ${person.team}`"
            >
              {{ person.name }}
            </el-tag>
          </div>
          <span v-else class="text-muted">未关联</span>
        </template>
      </el-table-column>
      <el-table-column label="页面权限" min-width="260">
        <template #default="{ row }">
          <div v-if="row.permissions?.length" class="tag-list">
            <el-tag
              v-for="permission in row.permissions"
              :key="permission.id"
              size="small"
              :title="permission.code"
            >
              {{ RoleForm.formatPermissionLabel(permission) }}
            </el-tag>
          </div>
          <span v-else class="text-muted">未配置</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="getStatusMeta(row.status).type" size="small">
            {{ getStatusMeta(row.status).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="openEditDialog(row as RoleRecord)">编辑</el-button>
          <el-button type="danger" link @click="handleDelete(row as RoleRecord)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <RoleFormDialog
    v-model="dialogVisible"
    :role="editingRole"
    :permission-options="permissionOptions"
    :personnel-options="personnelOptions"
    @created="handleRoleCreated"
    @updated="handleRoleUpdated"
    @closed="handleDialogClosed"
  />
</template>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.search-form {
  margin-bottom: 16px;
}

.text-muted {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

:deep(.role-table .el-table__body .el-table__row) {
  height: 48px;
}

:deep(.role-table .el-table__body .el-table__cell) {
  padding: 6px 0;
  vertical-align: middle;
}
</style>
