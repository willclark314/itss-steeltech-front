<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ContactForm } from '@/models/biz/contact'
import { ProjectForm } from '@/models/biz/project'
import { BIZ_ROUTES, buildProjectRouteQuery } from '@/models/biz/navigation'
import type { ContactAttachment, ContactRecord, ContactStatus } from '@/models/biz/contact'
import OverflowTooltip from '@/components/biz/OverflowTooltip.vue'
import TagCell from '@/components/biz/TagCell.vue'

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

const statusMap = ContactForm.STATUS_MAP
const relationTypeMap = ContactForm.RELATION_TYPE_MAP
const projectSourceMap = ContactForm.PROJECT_SOURCE_MAP

const attachmentTooltip = reactive({
  visible: false,
  text: '',
  top: 0,
  left: 0,
})

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

function showAttachmentHint(event: MouseEvent, name: string) {
  const cell = (event.currentTarget as HTMLElement | null)?.closest('.attachment-cell')
  if (!cell) return

  const rect = cell.getBoundingClientRect()
  attachmentTooltip.text = name
  attachmentTooltip.top = rect.top + rect.height / 2
  attachmentTooltip.left = rect.left
  attachmentTooltip.visible = true
}

function hideAttachmentHint() {
  attachmentTooltip.visible = false
  attachmentTooltip.text = ''
}

function toContactRecord(row: unknown): ContactRecord {
  return row as ContactRecord
}

function getStatusMeta(status: ContactStatus) {
  return statusMap[status]
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
  <el-table
    ref="tableRef"
    v-loading="loading"
    :data="data"
    stripe
    class="biz-data-table"
    :row-class-name="getRowClassName"
    :height="tableHeight"
  >
    <el-table-column label="联系单号" width="220" class-name="tag-column contact-id-column">
      <template #default="{ row }">
        <div class="contact-id-cell" :class="{ 'is-child': (row.sortOrder ?? 0) > 0 }">
          <OverflowTooltip :content="ContactForm.formatDisplayId(row.id, row.projectNos?.[0])">
            <el-tag :type="getRelationMeta(toContactRecord(row)).type" size="small" class="cell-tag">
              {{ ContactForm.formatDisplayId(row.id, row.projectNos?.[0]) }}
            </el-tag>
          </OverflowTooltip>
          <el-tag
            v-if="getRelationMeta(toContactRecord(row)).label !== '主单'"
            size="small"
            class="cell-tag relation-tag"
            :type="getRelationMeta(toContactRecord(row)).type"
          >
            {{ getRelationMeta(toContactRecord(row)).label }}
          </el-tag>
          <span
            v-if="showChildCount && (row.childCount ?? 0) > 0 && (row.sortOrder ?? 0) === 0"
            class="child-count"
          >
            +{{ row.childCount }}
          </span>
        </div>
      </template>
    </el-table-column>
    <el-table-column prop="title" label="联系主题" min-width="160" show-overflow-tooltip />
    <el-table-column label="标签" width="140" class-name="tag-column">
      <template #default="{ row }">
        <TagCell :tags="toContactRecord(row).tags" />
      </template>
    </el-table-column>
    <el-table-column label="项目号" min-width="160" class-name="tag-column project-no-column">
      <template #default="{ row }">
        <el-tooltip v-if="row.projectNos?.length" placement="top" :show-after="200" :enterable="true">
          <template #content>
            <div class="project-no-tooltip">
              <div
                v-for="no in row.projectNos"
                :key="no"
                class="project-no-tooltip-item"
                @click="handleProjectNoClick(no, toContactRecord(row))"
              >
                {{ ProjectForm.formatDisplayProjectNo(no) }}
              </div>
            </div>
          </template>
          <div class="project-no-tag-list">
            <el-tag
              v-for="link in getProjectLinks(toContactRecord(row))"
              :key="link.projectNo"
              :type="getProjectTagType(link)"
              effect="plain"
              size="small"
              class="cell-tag cell-tag--clickable"
              @click="handleProjectNoClick(link.projectNo, toContactRecord(row))"
            >
              {{ ProjectForm.formatDisplayProjectNo(link.projectNo) }}
            </el-tag>
          </div>
        </el-tooltip>
        <span v-else class="text-muted">-</span>
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
    <el-table-column prop="urgency" label="紧急程度" width="100" class-name="tag-column">
      <template #default="{ row }">
        <el-tag
          :type="row.urgency === '紧急' ? 'danger' : 'info'"
          size="small"
          class="cell-tag"
        >
          {{ row.urgency }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="status" label="状态" width="100" class-name="tag-column">
      <template #default="{ row }">
        <el-tag :type="getStatusMeta(row.status).type" size="small" class="cell-tag">
          {{ getStatusMeta(row.status).label }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="正文" width="72" align="center" class-name="attachment-column">
      <template #default="{ row }">
        <span
          v-if="row.primaryPdf?.url"
          class="pdf-icon-wrap is-clickable"
          @click="openAttachment(row.primaryPdf)"
        >
          <el-icon class="pdf-icon"><Document /></el-icon>
        </span>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>
    <el-table-column label="附件" min-width="88" class-name="attachment-column">
      <template #default="{ row }">
        <div v-if="row.attachments?.length" class="attachment-cell" @mouseleave="hideAttachmentHint">
          <div class="attachment-icons">
            <span
              v-for="file in row.attachments"
              :key="file.id"
              class="pdf-icon-wrap"
              :class="{ 'is-clickable': !!file.url }"
              @mouseenter="showAttachmentHint($event, file.name)"
              @click="openAttachment(file)"
            >
              <el-icon class="pdf-icon"><Document /></el-icon>
            </span>
          </div>
        </div>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>
    <el-table-column
      label="创建时间"
      width="110"
      align="center"
      header-align="center"
      class-name="date-column"
    >
      <template #default="{ row }">
        {{ ContactForm.toDateOnly(row.createdAt) }}
      </template>
    </el-table-column>
  </el-table>

  <Teleport to="body">
    <transition name="el-fade-in-linear">
      <div
        v-if="attachmentTooltip.visible"
        class="attachment-tooltip-float"
        :style="{
          top: `${attachmentTooltip.top}px`,
          left: `${attachmentTooltip.left}px`,
        }"
      >
        {{ attachmentTooltip.text }}
      </div>
    </transition>
  </Teleport>
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

.attachment-cell {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.attachment-icons {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  max-width: 100%;
  overflow: hidden;
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

<style>
.attachment-tooltip-float {
  position: fixed;
  z-index: 3000;
  transform: translate(calc(-100% - 8px), -50%);
  padding: 6px 12px;
  background: var(--el-text-color-primary);
  color: var(--el-bg-color);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  border-radius: var(--el-border-radius-base);
  white-space: nowrap;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid var(--el-border-color-darker);
  box-shadow: var(--el-box-shadow-dark);
  pointer-events: none;
}

.attachment-tooltip-float::after {
  content: '';
  position: absolute;
  right: -5px;
  top: 50%;
  transform: translateY(-50%);
  border: 5px solid transparent;
  border-left-color: var(--el-text-color-primary);
}
</style>
