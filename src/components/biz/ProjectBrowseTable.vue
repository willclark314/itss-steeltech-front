<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import LocalWorkPathCell from '@/components/biz/LocalWorkPathCell.vue'
import TagCell from '@/components/biz/TagCell.vue'
import ProjectPersonnelCell from '@/components/biz/ProjectPersonnelCell.vue'
import { ProjectForm } from '@/models/biz/project'
import { ContactForm } from '@/models/biz/contact'
import { BIZ_ROUTES, buildContactRouteQuery } from '@/models/biz/navigation'
import type { ProjectContactLink, ProjectNatureCode, ProjectRecord } from '@/models/biz/project'

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

const router = useRouter()

function getFlowStatusItems(row: ProjectRecord) {
  return ProjectForm.getFlowStatusItems(row)
}

function toProjectRecord(row: unknown): ProjectRecord {
  return row as ProjectRecord
}

function getNatureMeta(nature: ProjectNatureCode) {
  return ProjectForm.getNatureMeta(nature)
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

function goToContactBrowse(contactFormId: string) {
  router.push({
    path: BIZ_ROUTES.contactBrowse,
    query: buildContactRouteQuery(contactFormId),
  })
}

function handleContactTagClick(link: ProjectContactLink) {
  goToContactBrowse(link.contactFormId)
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
    <el-table-column label="联系单编号" width="220" class-name="tag-column contact-form-column">
      <template #default="{ row }">
        <template v-if="getContactLinks(toProjectRecord(row)).length">
          <el-tooltip
            :content="getContactLinkSummary(getContactLinks(toProjectRecord(row)), toProjectRecord(row))"
            placement="top"
            :show-after="200"
            :disabled="getContactLinkSummary(getContactLinks(toProjectRecord(row)), toProjectRecord(row)).length < 16"
          >
            <div class="contact-form-tag-list">
              <el-tag
                v-for="link in getContactLinks(toProjectRecord(row))"
                :key="`${link.projectNo}:${link.contactFormId}`"
                type="success"
                size="small"
                class="cell-tag cell-tag--clickable"
                @click.stop="handleContactTagClick(link)"
              >
                {{ getContactLinkLabel(link, toProjectRecord(row)) }}
              </el-tag>
            </div>
          </el-tooltip>
        </template>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>
    <el-table-column label="项目号" width="130" class-name="text-column">
      <template #default="{ row }">
        {{ ProjectForm.getDisplayProjectNo(toProjectRecord(row)) }}
      </template>
    </el-table-column>
    <el-table-column prop="name" label="项目名称" min-width="180" show-overflow-tooltip />
    <el-table-column label="标签" width="140" class-name="tag-column">
      <template #default="{ row }">
        <TagCell :tags="toProjectRecord(row).tags" />
      </template>
    </el-table-column>
    <el-table-column v-if="showNature" label="项目性质" width="130" class-name="tag-column nature-column">
      <template #default="{ row }">
        <div class="nature-cell" :class="{ 'is-empty': !toProjectRecord(row).natures.length }">
          <el-tooltip
            v-if="toProjectRecord(row).natures.length"
            placement="top"
            :show-after="200"
          >
            <template #content>
              <div class="nature-tooltip">
                <div v-for="nature in toProjectRecord(row).natures" :key="nature">
                  {{ getNatureMeta(nature)!.label }}
                </div>
              </div>
            </template>
            <div class="nature-tag-list">
              <el-tag
                v-for="nature in toProjectRecord(row).natures"
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
        </div>
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
    <el-table-column label="流程状态" min-width="150" class-name="tag-column">
      <template #default="{ row }">
        <div class="flow-status-tag-list">
          <el-tag
            v-for="item in getFlowStatusItems(toProjectRecord(row))"
            :key="item.label"
            :type="item.type"
            size="small"
            class="cell-tag"
          >
            {{ item.label }}
          </el-tag>
        </div>
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
        <LocalWorkPathCell :project="toProjectRecord(row)" readonly />
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.nature-cell {
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--biz-table-row-height, 35px);
}

.nature-cell.is-empty {
  padding-left: 2px;
}

.nature-tag-list {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}
</style>
