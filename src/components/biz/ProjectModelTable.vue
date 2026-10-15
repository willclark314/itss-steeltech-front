<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { ProjectModelForm, type ProjectModelRecord } from '@/models/biz/projectModel/ProjectModelForm'
import { BIZ_ROUTES, buildProjectRouteQuery } from '@/models/biz/navigation'
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    data: ProjectModelRecord[]
    loading?: boolean
    canEdit?: boolean
    tableHeight?: string | number
  }>(),
  {
    canEdit: true,
    tableHeight: 'calc(100vh - 300px)',
  },
)

const emit = defineEmits<{
  edit: [row: ProjectModelRecord]
  delete: [row: ProjectModelRecord]
}>()

const router = useRouter()

function goToProject(projectNo: string) {
  if (!projectNo) return
  router.push({
    path: BIZ_ROUTES.project,
    query: buildProjectRouteQuery(projectNo),
  })
}
</script>

<template>
  <el-table
    v-loading="loading"
    :data="data"
    stripe
    class="biz-data-table"
    :height="tableHeight"
    style="min-width: 980px"
  >
    <el-table-column label="项目号" width="130" class-name="text-column">
      <template #default="{ row }">
        <el-button link type="primary" @click="goToProject(row.projectNo)">
          {{ row.projectNo }}
        </el-button>
      </template>
    </el-table-column>
    <el-table-column prop="projectName" label="项目名称" min-width="220" show-overflow-tooltip />
    <el-table-column label="模型类型" width="110" class-name="tag-column">
      <template #default="{ row }">
        <el-tag :type="row.modelType === 'jiagong' ? 'warning' : 'success'" size="small">
          {{ ProjectModelForm.modelTypeLabel(row.modelType) }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="name" label="模型名称" min-width="180" show-overflow-tooltip />
    <el-table-column label="状态" width="100" class-name="tag-column">
      <template #default="{ row }">
        <el-tag :type="ProjectModelForm.statusTagType(row.status)" size="small">
          {{ ProjectModelForm.statusLabel(row.status) }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="模型重量(t)" width="110" align="right">
      <template #default="{ row }">
        {{ ProjectModelForm.formatWeight(row.modelWeightTons) }}
      </template>
    </el-table-column>
    <el-table-column prop="modelPath" label="模型路径" min-width="200" show-overflow-tooltip />
    <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
    <el-table-column v-if="canEdit" label="操作" width="140" fixed="right">
      <template #default="{ row }">
        <el-button link type="primary" @click="emit('edit', row as ProjectModelRecord)">编辑</el-button>
        <el-button link type="danger" @click="emit('delete', row as ProjectModelRecord)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
