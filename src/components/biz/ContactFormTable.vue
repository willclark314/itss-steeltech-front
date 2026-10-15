<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ContactForm } from '@/models/biz/contact'
import { ProjectForm } from '@/models/biz/project'
import { updateContact } from '@/api/contacts'
import type { ContactAttachment, ContactRecord } from '@/models/biz/contact'
import type { ProjectLink } from '@/models/biz/contact'
import AttachmentIconsCell from '@/components/biz/AttachmentIconsCell.vue'
import OverflowTooltip from '@/components/biz/OverflowTooltip.vue'
import ProjectDateEditCell from '@/components/biz/ProjectDateEditCell.vue'

const props = withDefaults(
  defineProps<{
    data: ContactRecord[]
    loading?: boolean
    highlightedContactId?: string
    knownProjectNos?: Set<string>
    tableHeight?: string | number
  }>(),
  {
    knownProjectNos: () => new Set<string>(),
    tableHeight: 'calc(100vh - 300px)',
  },
)

const attachmentDropTargetId = defineModel<string>('attachmentDropTargetId', { default: '' })
const primaryPdfDropTargetId = defineModel<string>('primaryPdfDropTargetId', { default: '' })

const emit = defineEmits<{
  edit: [row: ContactRecord]
  append: [row: ContactRecord]
  cancel: [row: ContactRecord]
  delete: [row: ContactRecord]
  'project-no-click': [projectNo: string, row: ContactRecord]
  'attachment-drop': [row: ContactRecord, files: File[]]
  'primary-pdf-drop': [row: ContactRecord, file: File]
  'primary-pdf-invalid-drop': [row: ContactRecord]
  'received-date-updated': [contact: ContactRecord]
}>()

const tableRef = ref()
const savingReceivedDateKey = ref('')
defineExpose({ tableRef })

const relationTypeMap = ContactForm.RELATION_TYPE_MAP
const projectSourceMap = ContactForm.PROJECT_SOURCE_MAP

function getProjectLinks(row: ContactRecord): ProjectLink[] {
  return ContactForm.getProjectLinks(row)
}

function getRelationMeta(row: ContactRecord) {
  const type = row.relationType || 'primary'
  return relationTypeMap[type]
}

function getProjectTagType(link: ProjectLink) {
  return projectSourceMap[link.sourceType]?.tagType || 'primary'
}

function openAttachment(file: ContactAttachment) {
  if (file.url) {
    window.open(file.url, '_blank')
  }
}

function toContactRecord(row: unknown): ContactRecord {
  return row as ContactRecord
}

function canEditRow(row: unknown) {
  return ContactForm.wrap(toContactRecord(row)).canEdit()
}

function canCancelRow(row: unknown) {
  return ContactForm.wrap(toContactRecord(row)).canCancel()
}

function isReceivedDateSaving(contactId: string) {
  return savingReceivedDateKey.value === contactId
}

function isMissingProjectNo(projectNo: string) {
  return !props.knownProjectNos.has(projectNo)
}

function getRowClassName({ row }: { row: ContactRecord }) {
  const classes: string[] = []
  if (row.id === props.highlightedContactId) classes.push('is-highlighted')
  if ((row.sortOrder ?? 0) > 0) classes.push('is-child-row')
  if (row.relationType === 'cancel') classes.push('is-cancel-row')
  return classes.join(' ')
}

function hasFileDrag(event: DragEvent) {
  return event.dataTransfer?.types.includes('Files')
}

function handleAttachmentDragOver(event: DragEvent, row: ContactRecord) {
  if (!hasFileDrag(event)) return
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer!.dropEffect = 'copy'
  primaryPdfDropTargetId.value = ''
  attachmentDropTargetId.value = row.id
}

function handlePrimaryPdfDragOver(event: DragEvent, row: ContactRecord) {
  if (!hasFileDrag(event)) return
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer!.dropEffect = 'copy'
  attachmentDropTargetId.value = ''
  primaryPdfDropTargetId.value = row.id
}

function handlePrimaryPdfDragLeave(event: DragEvent, row: ContactRecord) {
  const current = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (related && current?.contains(related)) return
  if (primaryPdfDropTargetId.value === row.id) {
    primaryPdfDropTargetId.value = ''
  }
}

function handlePrimaryPdfDrop(event: DragEvent, row: ContactRecord) {
  event.preventDefault()
  primaryPdfDropTargetId.value = ''

  const allFiles = ContactForm.extractFilesFromDrop(event.dataTransfer!)
  if (!allFiles.length) return

  event.stopPropagation()
  const pdfFiles = ContactForm.extractPdfFilesFromDrop(event.dataTransfer!)
  if (!pdfFiles.length) {
    emit('primary-pdf-invalid-drop', row)
    return
  }
  emit('primary-pdf-drop', row, pdfFiles[0]!)
}

function handleAttachmentDragLeave(event: DragEvent, row: ContactRecord) {
  const current = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (related && current?.contains(related)) return
  if (attachmentDropTargetId.value === row.id) {
    attachmentDropTargetId.value = ''
  }
}

function handleAttachmentDrop(event: DragEvent, row: ContactRecord) {
  event.preventDefault()
  attachmentDropTargetId.value = ''

  const files = ContactForm.extractFilesFromDrop(event.dataTransfer!)
  if (!files.length) return

  event.stopPropagation()
  emit('attachment-drop', row, files)
}

async function handleReceivedDateChange(row: ContactRecord, dateOnly: string) {
  const contactId = row.id
  const savingKey = contactId
  savingReceivedDateKey.value = savingKey

  try {
    if (!dateOnly) {
      ElMessage.warning('请选择收单日期')
      return
    }

    const updated = await updateContact(contactId, { receivedDate: dateOnly })
    emit('received-date-updated', updated)
    ElMessage.success('收单时间已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存收单时间失败')
  } finally {
    if (savingReceivedDateKey.value === savingKey) {
      savingReceivedDateKey.value = ''
    }
  }
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
          <span v-if="(row.childCount ?? 0) > 0 && (row.sortOrder ?? 0) === 0" class="child-count">
            +{{ row.childCount }}
          </span>
        </div>
      </template>
    </el-table-column>
    <el-table-column prop="receivedDate" label="收单时间" width="110" align="center" header-align="center" class-name="date-column">
      <template #default="{ row }">
        <ProjectDateEditCell :model-value="ContactForm.toDateOnly(row.receivedDate)" :loading="isReceivedDateSaving(row.id)"
          @change="(value) => handleReceivedDateChange(toContactRecord(row), value)" />
      </template>
    </el-table-column>
    <el-table-column prop="title" label="联系主题" min-width="160" show-overflow-tooltip />
    <el-table-column label="项目号" width="160" class-name="tag-column project-no-column">
      <template #default="{ row }">
        <el-tooltip v-if="row.projectNos?.length" placement="top" :show-after="200" :enterable="true">
          <template #content>
            <div class="project-no-tooltip">
              <div v-for="no in row.projectNos" :key="no" class="project-no-tooltip-item" :class="{ 'is-missing': isMissingProjectNo(no) }"
                @click="emit('project-no-click', no, toContactRecord(row))">
                {{ ProjectForm.formatDisplayProjectNo(no) }}
              </div>
            </div>
          </template>
          <div class="project-no-tag-list">
            <el-tag v-for="link in getProjectLinks(toContactRecord(row))" :key="link.projectNo" :type="isMissingProjectNo(link.projectNo) ? 'warning' : getProjectTagType(link)"
              effect="plain" size="small" class="cell-tag cell-tag--clickable" @click="emit('project-no-click', link.projectNo, toContactRecord(row))">
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
        <div class="attachment-drop-zone" @dragenter="handlePrimaryPdfDragOver($event, toContactRecord(row))" @dragover="handlePrimaryPdfDragOver($event, toContactRecord(row))"
          @dragleave="handlePrimaryPdfDragLeave($event, toContactRecord(row))" @drop="handlePrimaryPdfDrop($event, toContactRecord(row))">
          <span v-if="row.primaryPdf?.url" class="pdf-icon-wrap is-clickable" @click="openAttachment(row.primaryPdf)">
            <el-icon class="pdf-icon">
              <Document />
            </el-icon>
          </span>
          <span v-else class="text-muted">-</span>
          <div v-if="primaryPdfDropTargetId === row.id" class="attachment-drop-overlay">
            <el-icon :size="20">
              <Upload />
            </el-icon>
            <span>松手上传正文</span>
          </div>
        </div>
      </template>
    </el-table-column>
    <el-table-column label="附件" width="72" class-name="attachment-column">
      <template #default="{ row }">
        <div class="attachment-drop-zone" @dragenter="handleAttachmentDragOver($event, toContactRecord(row))" @dragover="handleAttachmentDragOver($event, toContactRecord(row))"
          @dragleave="handleAttachmentDragLeave($event, toContactRecord(row))" @drop="handleAttachmentDrop($event, toContactRecord(row))">
          <AttachmentIconsCell :files="row.attachments || []" />
          <div v-if="attachmentDropTargetId === row.id" class="attachment-drop-overlay">
            <el-icon :size="20">
              <Upload />
            </el-icon>
            <span>松手追加到此行</span>
          </div>
        </div>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="200" fixed="right">
      <template #default="{ row }">
        <el-button v-if="canEditRow(row)" type="primary" link @click="emit('edit', toContactRecord(row))">
          编辑
        </el-button>
        <el-button v-if="row.relationType !== 'cancel'" type="success" link @click="emit('append', toContactRecord(row))">
          追加
        </el-button>
        <el-button v-if="canCancelRow(row)" type="warning" link @click="emit('cancel', toContactRecord(row))">
          取消
        </el-button>
        <el-button type="danger" link @click="emit('delete', toContactRecord(row))">删除</el-button>
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

.project-no-tooltip .is-missing {
  color: var(--el-color-warning-light-3);
}

.attachment-drop-zone {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  align-self: stretch;
  flex: 1;
  width: 100%;
  min-height: 100%;
  border-radius: 4px;
}

.attachment-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: color-mix(in srgb, var(--el-bg-color) 88%, transparent);
  border: 2px dashed var(--el-color-primary);
  border-radius: 4px;
  color: var(--el-color-primary);
  pointer-events: none;
}

.attachment-drop-overlay span {
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  padding: 0 4px;
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
