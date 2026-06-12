<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import LocalWorkPathCell from '@/components/biz/LocalWorkPathCell.vue'
import ProjectPersonnelCell from '@/components/biz/ProjectPersonnelCell.vue'
import { ProjectForm } from '@/models/biz/project'
import { BIZ_ROUTES, buildContactRouteQuery } from '@/models/biz/navigation'
import type { ProjectNatureCode, ProjectRecord, ProjectStatus } from '@/models/biz/project'

const props = withDefaults(
  defineProps<{
    data: ProjectRecord[]
    loading?: boolean
    showNature?: boolean
    showPersonnel?: boolean
    highlightedProjectNo?: string
    tableHeight?: string | number
  }>(),
  {
    showNature: true,
    showPersonnel: true,
    tableHeight: 'calc(100vh - 300px)',
  },
)

const tableRef = ref()
defineExpose({ tableRef })

const emit = defineEmits<{
  edit: [row: ProjectRecord]
  pathUpdated: [projectNo: string, localWorkPath: string]
}>()

const router = useRouter()
const statusMap = ProjectForm.STATUS_MAP

function getStatusMeta(status: ProjectStatus) {
  return statusMap[status]
}

function getNatureMeta(nature: ProjectNatureCode) {
  return ProjectForm.getNatureMeta(nature)
}

function toProjectRecord(row: unknown): ProjectRecord {
  return row as ProjectRecord
}

function getRowClassName({ row }: { row: ProjectRecord }) {
  return row.projectNo === props.highlightedProjectNo ? 'is-highlighted' : ''
}

function goToContactForm(contactId: string) {
  router.push({
    path: BIZ_ROUTES.contact,
    query: buildContactRouteQuery(contactId),
  })
}

function formatContactFormSummary(ids: string[]) {
  return ids.join('、')
}
</script>

<template>
  <el-table
    ref="tableRef"
    v-loading="loading"
    :data="data"
    stripe
    class="biz-data-table"
    :row-class-name="getRowClassName"
    :height="tableHeight"
    style="min-width: 1000px"
  >
    <el-table-column label="联系单编号" width="148" class-name="tag-column contact-form-column">
      <template #default="{ row }">
        <el-tooltip
          v-if="row.contactFormIds?.length"
          :content="formatContactFormSummary(row.contactFormIds)"
          placement="top"
          :show-after="200"
          :disabled="formatContactFormSummary(row.contactFormIds).length < 16"
        >
          <div class="contact-form-tag-list">
            <el-tag
              type="success"
              size="small"
              class="cell-tag cell-tag--clickable"
              @click="goToContactForm(row.contactFormIds[0])"
            >
              {{ formatContactFormSummary(row.contactFormIds) }}
            </el-tag>
          </div>
        </el-tooltip>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>
    <el-table-column prop="projectNo" label="项目号" width="130" class-name="text-column" />
    <el-table-column prop="name" label="项目名称" min-width="180" show-overflow-tooltip />
    <el-table-column v-if="showNature" label="项目性质" width="130" class-name="tag-column">
      <template #default="{ row }">
        <el-tooltip v-if="row.natures?.length" placement="top" :show-after="200">
          <template #content>
            <div class="nature-tooltip">
              <div v-for="nature in row.natures" :key="nature">
                {{ getNatureMeta(nature)!.label }}
              </div>
            </div>
          </template>
          <div class="nature-tag-list">
            <el-tag
              v-for="nature in row.natures"
              :key="nature"
              :type="getNatureMeta(nature)!.type"
              size="small"
              class="cell-tag"
            >
              {{ getNatureMeta(nature)!.label }}
            </el-tag>
          </div>
        </el-tooltip>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>
    <el-table-column
      v-if="showPersonnel"
      label="分配人员"
      min-width="160"
      class-name="tag-column personnel-column"
    >
      <template #default="{ row }">
        <ProjectPersonnelCell :personnel="row.assignedPersonnel || []" />
      </template>
    </el-table-column>
    <el-table-column prop="status" label="状态" width="100" class-name="tag-column">
      <template #default="{ row }">
        <el-tag :type="getStatusMeta(row.status).type" size="small" class="cell-tag">
          {{ getStatusMeta(row.status).label }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column
      prop="receivedDate"
      label="收单时间"
      width="110"
      align="center"
      header-align="center"
      class-name="date-column"
    />
    <el-table-column
      label="本地路径"
      width="88"
      align="center"
      fixed="right"
      class-name="local-path-column"
    >
      <template #default="{ row }">
        <LocalWorkPathCell
          :project="toProjectRecord(row)"
          @path-updated="(projectNo, localWorkPath) => emit('pathUpdated', projectNo, localWorkPath)"
        />
      </template>
    </el-table-column>
    <el-table-column label="操作" width="80" fixed="right">
      <template #default="{ row }">
        <el-button type="primary" link @click="emit('edit', toProjectRecord(row))">编辑</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
