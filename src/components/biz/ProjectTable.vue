<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { updateProject } from '@/api/projects'
import LocalWorkPathCell from '@/components/biz/LocalWorkPathCell.vue'
import ProjectDateEditCell from '@/components/biz/ProjectDateEditCell.vue'
import ProjectNatureCell from '@/components/biz/ProjectNatureCell.vue'
import ProjectPersonnelEditCell from '@/components/biz/ProjectPersonnelEditCell.vue'
import ProjectFlowStatusEditCell from '@/components/biz/ProjectFlowStatusEditCell.vue'
import { ProjectForm, DetailWorkflowForm } from '@/models/biz/project'
import { ContactForm } from '@/models/biz/contact'
import { BIZ_ROUTES, buildContactRouteQuery } from '@/models/biz/navigation'
import type { PersonnelRecord } from '@/models/personnel'
import type { ProjectContactLink, ProjectRecord } from '@/models/biz/project'

const props = withDefaults(
  defineProps<{
    data: ProjectRecord[]
    loading?: boolean
    showNature?: boolean
    showPersonnel?: boolean
    personnelOptions?: PersonnelRecord[]
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

type ProjectDateField = 'actualStartDate' | 'actualEndDate'

const savingDateKey = ref('')

const emit = defineEmits<{
  edit: [row: ProjectRecord]
  delete: [row: ProjectRecord]
  natureUpdated: [record: ProjectRecord]
  personnelUpdated: [record: ProjectRecord]
  statusUpdated: [record: ProjectRecord]
  dateUpdated: [record: ProjectRecord]
  pathUpdated: [projectNo: string, localWorkPath: string, designWorkPath: string, detailWorkPath: string]
}>()

const router = useRouter()

function toProjectRecord(row: unknown): ProjectRecord {
  return row as ProjectRecord
}

function getRowClassName({ row }: { row: ProjectRecord }) {
  if (!props.highlightedProjectNo) return ''
  return (
    ProjectForm.getDisplayProjectNo(row) ===
    ProjectForm.parseBaseProjectNo(props.highlightedProjectNo)
  )
    ? 'is-highlighted'
    : ''
}

function getContactLinks(row: ProjectRecord): ProjectContactLink[] {
  return ProjectForm.getContactLinks(row)
}

function getContactLinkLabel(link: ProjectContactLink, row: ProjectRecord) {
  return ContactForm.formatDisplayId(link.contactFormId, ProjectForm.getDisplayProjectNo(row))
}

function getContactLinkSummary(links: ProjectContactLink[], row: ProjectRecord) {
  return links.map((link) => getContactLinkLabel(link, row)).join('、')
}

function goToContactForm(contactFormId: string) {
  router.push({
    path: BIZ_ROUTES.contact,
    query: buildContactRouteQuery(contactFormId),
  })
}

function handleContactTagClick(link: ProjectContactLink) {
  goToContactForm(link.contactFormId)
}

function isModelWeightApplicable(row: ProjectRecord) {
  return DetailWorkflowForm.needsDetailWorkflow(row.natures) && Boolean(row.detailWorkflow)
}

function getModelWeightDisplay(row: ProjectRecord) {
  return DetailWorkflowForm.formatModelWeightDisplay(row.detailWorkflow?.modelWeightTons)
}

function getModelWeightTooltip(row: ProjectRecord) {
  return DetailWorkflowForm.getModelWeightAuditTooltip(row.detailWorkflow)
}

function isDateSaving(projectNo: string, field: ProjectDateField) {
  return savingDateKey.value === `${projectNo}:${field}`
}

async function handleDateChange(row: ProjectRecord, field: ProjectDateField, value: string) {
  const savingKey = `${row.projectNo}:${field}`
  savingDateKey.value = savingKey
  try {
    const updated = await updateProject(row.projectNo, { [field]: value })
    emit('dateUpdated', updated)
    ElMessage.success('日期已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存日期失败')
  } finally {
    if (savingDateKey.value === savingKey) {
      savingDateKey.value = ''
    }
  }
}
</script>

<template>
  <el-table ref="tableRef" v-loading="loading" :data="data" stripe class="biz-data-table" :row-class-name="getRowClassName" :height="tableHeight" style="min-width: 1000px">
    <el-table-column label="联系单编号" width="220" class-name="tag-column contact-form-column">
      <template #default="{ row }">
        <template v-if="getContactLinks(toProjectRecord(row)).length">
          <el-tooltip :content="getContactLinkSummary(getContactLinks(toProjectRecord(row)), toProjectRecord(row))" placement="top" :show-after="200"
            :disabled="getContactLinkSummary(getContactLinks(toProjectRecord(row)), toProjectRecord(row)).length < 16">
            <div class="contact-form-tag-list">
              <el-tag v-for="link in getContactLinks(toProjectRecord(row))" :key="`${link.projectNo}:${link.contactFormId}`" type="success" size="small"
                class="cell-tag cell-tag--clickable" @click.stop="handleContactTagClick(link)">
                {{ getContactLinkLabel(link, toProjectRecord(row)) }}
              </el-tag>
            </div>
          </el-tooltip>
        </template>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>
    <el-table-column prop="receivedDate" label="收单时间" width="100" align="center" header-align="center" class-name="date-column" />
    <el-table-column label="项目号" width="110" class-name="text-column">
      <template #default="{ row }">
        {{ ProjectForm.getDisplayProjectNo(toProjectRecord(row)) }}
      </template>
    </el-table-column>
    <el-table-column prop="name" label="项目名称" min-width="180" show-overflow-tooltip />

    <el-table-column v-if="showNature" label="项目性质" width="100" class-name="tag-column nature-column">
      <template #default="{ row }">
        <ProjectNatureCell :project="toProjectRecord(row)" @updated="(record) => emit('natureUpdated', record)" />
      </template>
    </el-table-column>
    <el-table-column
      v-if="showPersonnel"
      label="分配人员"
      min-width="120"
      align="left"
      header-align="left"
      class-name="tag-column personnel-column"
    >
      <template #default="{ row }">
        <ProjectPersonnelEditCell
          :project="toProjectRecord(row)"
          :personnel-options="personnelOptions || []"
          @updated="(record) => emit('personnelUpdated', record)"
        />
      </template>
    </el-table-column>
    <el-table-column label="流程状态" min-width="150" class-name="tag-column flow-status-column">
      <template #default="{ row }">
        <ProjectFlowStatusEditCell
          :project="toProjectRecord(row)"
          @updated="(record) => emit('statusUpdated', record)"
        />
      </template>
    </el-table-column>
    <el-table-column label="实际开始" width="100" align="center" header-align="center" class-name="date-column">
      <template #default="{ row }">
        <ProjectDateEditCell :model-value="toProjectRecord(row).actualStartDate" :loading="isDateSaving(toProjectRecord(row).projectNo, 'actualStartDate')"
          @change="(value) => handleDateChange(toProjectRecord(row), 'actualStartDate', value)" />
      </template>
    </el-table-column>
    <el-table-column label="实际完成" width="100" align="center" header-align="center" class-name="date-column">
      <template #default="{ row }">
        <ProjectDateEditCell :model-value="toProjectRecord(row).actualEndDate" :loading="isDateSaving(toProjectRecord(row).projectNo, 'actualEndDate')"
          @change="(value) => handleDateChange(toProjectRecord(row), 'actualEndDate', value)" />
      </template>
    </el-table-column>
    <el-table-column label="模型重(吨)" width="96" align="center" header-align="center" class-name="model-weight-column">
      <template #default="{ row }">
        <template v-if="isModelWeightApplicable(toProjectRecord(row))">
          <el-tooltip :content="getModelWeightTooltip(toProjectRecord(row))" placement="top" :show-after="200" :disabled="!getModelWeightTooltip(toProjectRecord(row))">
            <span class="model-weight-text" :class="{ 'text-muted': getModelWeightDisplay(toProjectRecord(row)) === '-' }">
              {{ getModelWeightDisplay(toProjectRecord(row)) }}
            </span>
          </el-tooltip>
        </template>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>

    <el-table-column label="本地路径" width="88" align="center" fixed="right" class-name="local-path-column">
      <template #default="{ row }">
        <LocalWorkPathCell :project="toProjectRecord(row)"
          @path-updated="(projectNo, localWorkPath, designWorkPath, detailWorkPath) => emit('pathUpdated', projectNo, localWorkPath, designWorkPath, detailWorkPath)" />
      </template>
    </el-table-column>
    <el-table-column label="操作" width="120" fixed="right">
      <template #default="{ row }">
        <el-button type="primary" link @click="emit('edit', toProjectRecord(row))">编辑</el-button>
        <el-button type="danger" link @click="emit('delete', toProjectRecord(row))">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.model-weight-text {
  display: inline-block;
  font-size: 13px;
  line-height: var(--biz-table-row-height, 35px);
}
</style>
