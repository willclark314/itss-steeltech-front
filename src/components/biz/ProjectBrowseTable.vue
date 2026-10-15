<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import LocalWorkPathCell from '@/components/biz/LocalWorkPathCell.vue'
import ProjectPersonnelCell from '@/components/biz/ProjectPersonnelCell.vue'
import ProjectPersonnelColumnHeader from '@/components/biz/ProjectPersonnelColumnHeader.vue'
import ProjectFlowStatusColumnHeader from '@/components/biz/ProjectFlowStatusColumnHeader.vue'
import ProjectNatureColumnHeader from '@/components/biz/ProjectNatureColumnHeader.vue'
import { ProjectForm } from '@/models/biz/project'
import { ContactForm } from '@/models/biz/contact'
import { resolveContactLinkPath, buildContactRouteQuery } from '@/models/biz/navigation'
import type { ProjectContactLink, ProjectNatureCode, ProjectRecord } from '@/models/biz/project'
import type { PersonnelRecord } from '@/models/personnel'

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

const assignedPersonnelId = defineModel<string>('assignedPersonnelId', { default: '' })
const flowStatusFilter = defineModel<string[]>('flowStatusFilter', { default: () => [] })
const natureFilter = defineModel<string[]>('natureFilter', { default: () => [] })

const tableRef = ref()
defineExpose({ tableRef })

const emit = defineEmits<{
  columnFilterChange: []
}>()

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
    path: resolveContactLinkPath(router.currentRoute.value.path),
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
        <span
          class="project-no-text"
          :class="{ 'is-urgent': ProjectForm.hasUrgentContact(toProjectRecord(row)) }"
        >
          {{ ProjectForm.getDisplayProjectNo(toProjectRecord(row)) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column prop="name" label="项目名称" min-width="180" show-overflow-tooltip />
    <el-table-column v-if="showNature" width="130" class-name="tag-column nature-column">
      <template #header>
        <ProjectNatureColumnHeader v-model="natureFilter" @change="emit('columnFilterChange')" />
      </template>
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
      width="120"
      class-name="tag-column personnel-column"
    >
      <template #header>
        <ProjectPersonnelColumnHeader
          v-model:assigned-personnel-id="assignedPersonnelId"
          :personnel-options="personnelOptions || []"
        />
      </template>
      <template #default="{ row }">
        <ProjectPersonnelCell :personnel="row.assignedPersonnel || []" />
      </template>
    </el-table-column>
    <el-table-column min-width="150" class-name="tag-column">
      <template #header>
        <ProjectFlowStatusColumnHeader v-model="flowStatusFilter" @change="emit('columnFilterChange')" />
      </template>
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
      width="116"
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
