<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ContactForm } from '@/models/biz/contact'
import { ProjectForm } from '@/models/biz/project'
import { BIZ_ROUTES, buildProjectRouteQuery } from '@/models/biz/navigation'
import type { ContactAttachment, ContactRecord } from '@/models/biz/contact'
import AttachmentIconsCell from '@/components/biz/AttachmentIconsCell.vue'
import OverflowTooltip from '@/components/biz/OverflowTooltip.vue'

const props = withDefaults(
  defineProps<{
    data: ContactRecord[]
    loading?: boolean
    highlightedContactId?: string
    showChildCount?: boolean
    tableHeight?: string | number
  }>(),
  {
    showChildCount: true,
    tableHeight: 'calc(100vh - 300px)',
  },
)

const tableRef = ref()
defineExpose({ tableRef })

const router = useRouter()

const relationTypeMap = ContactForm.RELATION_TYPE_MAP
const projectSourceMap = ContactForm.PROJECT_SOURCE_MAP

function getProjectLinks(row: ContactRecord) {
  return ContactForm.getProjectLinks(row)
}

function getRelationMeta(row: ContactRecord) {
  const type = row.relationType || 'primary'
  return relationTypeMap[type]
}

function getProjectTagType(link: { sourceType: string }) {
  return projectSourceMap[link.sourceType as keyof typeof projectSourceMap]?.tagType || 'primary'
}

function goToProject(projectNo: string, projectNos: string[] = []) {
  router.push({
    path: BIZ_ROUTES.projectBrowse,
    query: buildProjectRouteQuery(projectNo, projectNos),
  })
}

function handleProjectNoClick(projectNo: string, row: ContactRecord) {
  goToProject(projectNo, row.projectNos)
}

function openAttachment(file: ContactAttachment) {
  if (file.url) {
    window.open(file.url, '_blank')
  }
}

function toContactRecord(row: unknown): ContactRecord {
  return row as ContactRecord
}

function getRowClassName({ row }: { row: ContactRecord }) {
  const classes: string[] = []
  if (row.id === props.highlightedContactId) classes.push('is-highlighted')
  if ((row.sortOrder ?? 0) > 0) classes.push('is-child-row')
  if (row.relationType === 'cancel') classes.push('is-cancel-row')
  return classes.join(' ')
}
</script>

<template>
  <el-table ref="tableRef" v-loading="loading" :data="data" stripe class="biz-data-table" :row-class-name="getRowClassName" :height="tableHeight">
    <el-table-column label="联系单号" width="220" class-name="tag-column contact-id-column">
      <template #default="{ row }">
        <div class="contact-id-cell" :class="{ 'is-child': (row.sortOrder ?? 0) > 0 }">
          <OverflowTooltip :content="ContactForm.formatDisplayId(row.id, row.projectNos?.[0])">
            <el-tag :type="getRelationMeta(toContactRecord(row)).type" size="small" class="cell-tag">
              {{ ContactForm.formatDisplayId(row.id, row.projectNos?.[0]) }}
            </el-tag>
          </OverflowTooltip>
          <el-tag v-if="getRelationMeta(toContactRecord(row)).label !== '主单'" size="small" class="cell-tag relation-tag" :type="getRelationMeta(toContactRecord(row)).type">
            {{ getRelationMeta(toContactRecord(row)).label }}
          </el-tag>
          <span v-if="showChildCount && (row.childCount ?? 0) > 0 && (row.sortOrder ?? 0) === 0" class="child-count">
            +{{ row.childCount }}
          </span>
        </div>
      </template>
    </el-table-column>
    <el-table-column prop="receivedDate" label="收单时间" width="110" align="center" header-align="center" class-name="date-column" />

    <el-table-column prop="title" label="联系主题" min-width="160" show-overflow-tooltip />
    <el-table-column label="项目号" width="250" class-name="tag-column project-no-column">
      <template #default="{ row }">
        <el-tooltip v-if="row.projectNos?.length" placement="top" :show-after="200" :enterable="true">
          <template #content>
            <div class="project-no-tooltip">
              <div v-for="no in row.projectNos" :key="no" class="project-no-tooltip-item" @click="handleProjectNoClick(no, toContactRecord(row))">
                {{ ProjectForm.formatDisplayProjectNo(no) }}
              </div>
            </div>
          </template>
          <div class="project-no-tag-list">
            <el-tag v-for="link in getProjectLinks(toContactRecord(row))" :key="link.projectNo" :type="getProjectTagType(link)" effect="plain" size="small"
              class="cell-tag cell-tag--clickable" @click="handleProjectNoClick(link.projectNo, toContactRecord(row))">
              {{ ProjectForm.formatDisplayProjectNo(link.projectNo) }}
            </el-tag>
          </div>
        </el-tooltip>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>
    <el-table-column prop="urgency" label="紧急程度" width="100" class-name="tag-column">
      <template #default="{ row }">
        <el-tag :type="row.urgency === '紧急' ? 'danger' : 'info'" size="small" class="cell-tag">
          {{ row.urgency }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="正文" width="72" align="center" class-name="attachment-column">
      <template #default="{ row }">
        <span v-if="row.primaryPdf?.url" class="pdf-icon-wrap is-clickable" @click="openAttachment(row.primaryPdf)">
          <el-icon class="pdf-icon">
            <Document />
          </el-icon>
        </span>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>
    <el-table-column label="附件" width="88" class-name="attachment-column">
      <template #default="{ row }">
        <AttachmentIconsCell :files="row.attachments || []" />
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.relation-tag {
  transform: scale(0.92);
}

.child-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:deep(.is-child-row > td) {
  background: color-mix(in srgb, var(--el-fill-color-light) 70%, transparent) !important;
}

:deep(.is-cancel-row > td) {
  background: color-mix(in srgb, var(--el-color-danger-light-9) 55%, transparent) !important;
}

.project-no-tooltip .project-no-tooltip-item {
  cursor: pointer;
}

.project-no-tooltip .project-no-tooltip-item:hover {
  text-decoration: underline;
}

.pdf-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: #fff1f0;
}

.pdf-icon-wrap.is-clickable {
  cursor: pointer;
}

.pdf-icon-wrap.is-clickable:hover {
  background: #ffccc7;
}

.pdf-icon {
  font-size: 16px;
  color: #cf1322;
}
</style>
