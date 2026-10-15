<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChangeOrder } from '@/models/biz/changeOrder'
import { ProjectForm } from '@/models/biz/project'
import { resolveProjectBrowsePath, buildProjectRouteQuery } from '@/models/biz/navigation'
import type { ChangeOrderRecord } from '@/models/biz/changeOrder'
import AttachmentIconsCell from '@/components/biz/AttachmentIconsCell.vue'
import OverflowTooltip from '@/components/biz/OverflowTooltip.vue'

const props = withDefaults(
  defineProps<{
    data: ChangeOrderRecord[]
    loading?: boolean
    highlightedId?: string
    tableHeight?: string | number
  }>(),
  { tableHeight: 'calc(100vh - 300px)' },
)

const primaryPdfDropTargetId = defineModel<string>('primaryPdfDropTargetId', { default: '' })

const emit = defineEmits<{
  edit: [row: ChangeOrderRecord]
  'primary-pdf-drop': [row: ChangeOrderRecord, files: File[]]
}>()

const tableRef = ref()
defineExpose({ tableRef })
const router = useRouter()

function goToProject(projectNo: string, projectNos: string[] = []) {
  router.push({
    path: resolveProjectBrowsePath(router.currentRoute.value.path),
    query: buildProjectRouteQuery(projectNo, projectNos),
  })
}
function handleProjectNoClick(projectNo: string, row: ChangeOrderRecord) { goToProject(projectNo, row.projectNos) }
function toChangeOrderRecord(row: unknown): ChangeOrderRecord { return row as ChangeOrderRecord }
function getRowClassName({ row }: { row: ChangeOrderRecord }) {
  if (String(row.id) === props.highlightedId) return 'is-highlighted'
  return ''
}
function hasFileDrag(event: DragEvent) { return event.dataTransfer?.types.includes('Files') }
function primaryFilesOf(row: ChangeOrderRecord) {
  return ChangeOrder.getCurrentPrimaryPdfs(row)
}

function handlePrimaryPdfDragOver(event: DragEvent, row: ChangeOrderRecord) {
  if (!hasFileDrag(event)) return
  event.preventDefault(); event.stopPropagation(); event.dataTransfer!.dropEffect = 'copy'
  primaryPdfDropTargetId.value = String(row.id)
}
function handlePrimaryPdfDragLeave(event: DragEvent, row: ChangeOrderRecord) {
  const current = event.currentTarget as HTMLElement | null; const related = event.relatedTarget as Node | null
  if (related && current?.contains(related)) return
  if (primaryPdfDropTargetId.value === String(row.id)) primaryPdfDropTargetId.value = ''
}
function handlePrimaryPdfDrop(event: DragEvent, row: ChangeOrderRecord) {
  event.preventDefault(); primaryPdfDropTargetId.value = ''
  const files = ChangeOrder.extractFilesFromDrop(event.dataTransfer!)
  if (!files.length) return
  event.stopPropagation()
  emit('primary-pdf-drop', row, files)
}
</script>

<template>
  <el-table ref="tableRef" v-loading="loading" :data="data" stripe class="biz-data-table" :row-class-name="getRowClassName" :height="tableHeight">
    <el-table-column label="变更单号" width="200" class-name="tag-column">
      <template #default="{ row }">
        <div class="contact-id-cell">
          <OverflowTooltip :content="ChangeOrder.formatDisplayId(toChangeOrderRecord(row))">
            <el-tag type="primary" size="small" class="cell-tag">{{ ChangeOrder.formatDisplayId(toChangeOrderRecord(row)) }}</el-tag>
          </OverflowTooltip>
        </div>
      </template>
    </el-table-column>
    <el-table-column prop="receivedDate" label="收单日期" width="110" align="center" header-align="center" class-name="date-column" />
    <el-table-column prop="title" label="变更主题" min-width="160" show-overflow-tooltip />
    <el-table-column label="项目号" width="160" class-name="tag-column project-no-column">
      <template #default="{ row }">
        <el-tooltip v-if="row.projectNos?.length" placement="top" :show-after="200" :enterable="true">
          <template #content>
            <div class="project-no-tooltip">
              <div v-for="no in row.projectNos" :key="no" class="project-no-tooltip-item" @click="handleProjectNoClick(no, toChangeOrderRecord(row))">{{ ProjectForm.formatDisplayProjectNo(no) }}</div>
            </div>
          </template>
          <div class="project-no-tag-list">
            <el-tag v-for="no in row.projectNos" :key="no" type="primary" effect="plain" size="small" class="cell-tag cell-tag--clickable"
              @click="handleProjectNoClick(no, toChangeOrderRecord(row))">{{ ProjectForm.formatDisplayProjectNo(no) }}</el-tag>
          </div>
        </el-tooltip>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>
    <el-table-column label="正文" width="88" class-name="attachment-column">
      <template #default="{ row }">
        <div class="attachment-drop-zone" @dragenter="handlePrimaryPdfDragOver($event, toChangeOrderRecord(row))"
          @dragover="handlePrimaryPdfDragOver($event, toChangeOrderRecord(row))"
          @dragleave="handlePrimaryPdfDragLeave($event, toChangeOrderRecord(row))"
          @drop="handlePrimaryPdfDrop($event, toChangeOrderRecord(row))">
          <AttachmentIconsCell :files="primaryFilesOf(toChangeOrderRecord(row))" />
          <div v-if="primaryPdfDropTargetId === String(row.id)" class="attachment-drop-overlay"><el-icon :size="20"><Upload /></el-icon><span>松手追加正文</span></div>
        </div>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="80" fixed="right">
      <template #default="{ row }">
        <el-button type="primary" link @click="emit('edit', toChangeOrderRecord(row))">编辑</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.project-no-tooltip .project-no-tooltip-item { cursor: pointer; }
.project-no-tooltip .project-no-tooltip-item:hover { text-decoration: underline; }
.attachment-drop-zone { position: relative; display: flex; align-items: center; justify-content: flex-start; align-self: stretch; flex: 1; width: 100%; min-height: 100%; border-radius: 4px; }
.attachment-drop-overlay { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: color-mix(in srgb, var(--el-bg-color) 88%, transparent); border: 2px dashed var(--el-color-primary); border-radius: 4px; color: var(--el-color-primary); pointer-events: none; }
.attachment-drop-overlay span { font-size: 11px; line-height: 1.2; text-align: center; padding: 0 4px; }
</style>
