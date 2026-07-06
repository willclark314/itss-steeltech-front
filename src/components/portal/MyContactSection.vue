<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { fetchContactList } from '@/api/contacts'
import OverflowTooltip from '@/components/biz/OverflowTooltip.vue'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'
import { ContactForm } from '@/models/biz/contact'
import type { ContactAttachment, ContactRecord, ContactStatus } from '@/models/biz/contact'
import { ProjectForm } from '@/models/biz/project'

const props = defineProps<{
  personnelId: string
  highlightedContactId?: string
}>()

const emit = defineEmits<{
  selectProject: [projectNo: string]
  clearSelection: []
}>()

const tableRef = ref()
const pageSize = 10

const searchForm = reactive({
  keyword: '',
})

const statusMap = ContactForm.STATUS_MAP
const relationTypeMap = ContactForm.RELATION_TYPE_MAP

const attachmentTooltip = reactive({
  visible: false,
  text: '',
  top: 0,
  left: 0,
})

const {
  filteredData,
  total,
  page,
  loading,
  loadPage,
  loadAroundAnchor,
} = usePaginatedListCache<ContactRecord>({
  pageSize,
  getItemKey: (item) => item.id,
  sortList: ContactForm.sortForDisplay,
})

function buildFilters() {
  return {
    keyword: searchForm.keyword,
    assignedPersonnelId: props.personnelId,
  }
}

async function loadContacts(pageNo = 1, force = false) {
  try {
    await loadPage(
      (params) =>
        fetchContactList({
          keyword: params.keyword,
          assignedPersonnelId: params.assignedPersonnelId,
          page: params.page,
          pageSize: params.pageSize,
        }),
      pageNo,
      buildFilters(),
      force,
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载联系单失败')
  }
}

function handleSearch() {
  emit('clearSelection')
  void loadContacts(1, true)
}

function handleReset() {
  searchForm.keyword = ''
  emit('clearSelection')
  void loadContacts(1, true)
}

function handleKeywordClear() {
  if (!searchForm.keyword) return
  emit('clearSelection')
  searchForm.keyword = ''
  void loadContacts(1, true)
}

function getStatusMeta(status: ContactStatus) {
  return statusMap[status]
}

function getRelationMeta(row: ContactRecord) {
  return relationTypeMap[row.relationType || 'primary']
}

function toContactRecord(row: unknown): ContactRecord {
  return row as ContactRecord
}

function getRowClassName({ row }: { row: ContactRecord }) {
  return row.id === props.highlightedContactId ? 'is-highlighted' : ''
}

function getContactFiles(row: ContactRecord): ContactAttachment[] {
  const files: ContactAttachment[] = []
  if (row.primaryPdf?.url) {
    files.push(row.primaryPdf)
  }
  for (const file of row.attachments || []) {
    if (!files.some((item) => item.id === file.id)) {
      files.push(file)
    }
  }
  return files
}

function getFileHint(file: ContactAttachment, row: ContactRecord) {
  if (row.primaryPdf?.id === file.id) {
    return file.name ? `正文：${file.name}` : '正文'
  }
  return file.name
}

function openAttachment(file: ContactAttachment) {
  if (file.url) {
    window.open(file.url, '_blank')
    return
  }
  ElMessage.warning('文件链接不可用')
}

function showAttachmentHint(event: MouseEvent, text: string) {
  const cell = (event.currentTarget as HTMLElement | null)?.closest('.attachment-cell')
  if (!cell) return

  const rect = cell.getBoundingClientRect()
  attachmentTooltip.text = text
  attachmentTooltip.top = rect.top + rect.height / 2
  attachmentTooltip.left = rect.left
  attachmentTooltip.visible = true
}

function hideAttachmentHint() {
  attachmentTooltip.visible = false
  attachmentTooltip.text = ''
}

function formatReceivedDate(value?: string) {
  const dateOnly = ContactForm.toDateOnly(value)
  return dateOnly.length >= 10 ? dateOnly.slice(5) : dateOnly
}

function formatReceivedDateFull(value?: string) {
  return ContactForm.toDateOnly(value)
}

function scrollToContact(contactId: string) {
  const index = filteredData.value.findIndex((item) => item.id === contactId)
  if (index === -1) return

  nextTick(() => {
    const rows = tableRef.value?.$el?.querySelectorAll('.el-table__body .el-table__row')
    rows?.[index]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

async function focusContact(contactId: string) {
  const exists = filteredData.value.some((item) => item.id === contactId)
  if (!exists) {
    try {
      await loadAroundAnchor(
        (params) =>
          fetchContactList({
            keyword: params.keyword,
            assignedPersonnelId: params.assignedPersonnelId,
            anchor: params.anchor,
            pageSize: params.pageSize,
          }),
        contactId,
        buildFilters(),
        true,
      )
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '定位联系单失败')
      return
    }
  }
  scrollToContact(contactId)
}

function handleProjectClick(projectNo: string) {
  emit('selectProject', projectNo)
}

function handlePageChange(pageNo: number) {
  emit('clearSelection')
  void loadContacts(pageNo)
}

defineExpose({ focusContact })

watch(
  () => props.personnelId,
  (nextId, prevId) => {
    if (!nextId || nextId === prevId) return
    searchForm.keyword = ''
    emit('clearSelection')
    void loadContacts(1, true)
  },
)

onMounted(() => {
  void loadContacts(1)
})
</script>

<template>
  <section class="my-section my-section--contact">
    <div class="my-section__header">
      <div class="my-section__header-main">
        <span class="my-section__title">我的联系单</span>
        <div class="my-section__search">
          <el-input
            v-model="searchForm.keyword"
            placeholder="单号 / 主题 / 项目号"
            clearable
            size="small"
            @keyup.enter="handleSearch"
            @clear="handleKeywordClear"
          />
          <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
          <el-button size="small" @click="handleReset">重置</el-button>
        </div>
      </div>
      <span class="my-section__total">共 {{ total }} 条</span>
    </div>

    <div class="my-section__table-wrap">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="filteredData"
        stripe
        class="biz-data-table my-contact-table"
        :row-class-name="getRowClassName"
        height="100%"
        size="small"
      >
        <el-table-column label="联系单号" min-width="120" class-name="tag-column contact-id-column">
          <template #default="{ row }">
            <OverflowTooltip :content="ContactForm.formatDisplayId(row.id, row.projectNos?.[0])">
              <el-tag :type="getRelationMeta(toContactRecord(row)).type" size="small" class="cell-tag">
                {{ ContactForm.formatDisplayId(row.id, row.projectNos?.[0]) }}
              </el-tag>
            </OverflowTooltip>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="主题" min-width="100" show-overflow-tooltip />
        <el-table-column label="项目号" min-width="90" class-name="tag-column project-no-column">
          <template #default="{ row }">
            <el-tooltip
              v-if="row.projectNos?.length"
              placement="top"
              :show-after="200"
              :enterable="true"
            >
              <template #content>
                <div class="project-no-tooltip">
                  <div
                    v-for="projectNo in row.projectNos"
                    :key="projectNo"
                    class="project-no-tooltip-item"
                    @click="handleProjectClick(projectNo)"
                  >
                    {{ ProjectForm.formatDisplayProjectNo(projectNo) }}
                  </div>
                </div>
              </template>
              <div class="project-no-tag-list">
                <el-tag
                  v-for="projectNo in row.projectNos"
                  :key="projectNo"
                  type="primary"
                  effect="plain"
                  size="small"
                  class="cell-tag cell-tag--clickable"
                  @click.stop="handleProjectClick(projectNo)"
                >
                  {{ ProjectForm.formatDisplayProjectNo(projectNo) }}
                </el-tag>
              </div>
            </el-tooltip>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column
          label="收单"
          width="50"
          align="center"
          class-name="date-column"
        >
          <template #default="{ row }">
            <el-tooltip
              v-if="toContactRecord(row).receivedDate"
              :content="formatReceivedDateFull(toContactRecord(row).receivedDate)"
              placement="top"
              :show-after="200"
            >
              <span class="received-date-cell">
                {{ formatReceivedDate(toContactRecord(row).receivedDate) }}
              </span>
            </el-tooltip>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" class-name="tag-column">
          <template #default="{ row }">
            <el-tag :type="getStatusMeta(row.status).type" size="small" class="cell-tag">
              {{ getStatusMeta(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="文件" width="55" align="center" class-name="attachment-column">
          <template #default="{ row }">
            <div
              v-if="getContactFiles(toContactRecord(row)).length"
              class="attachment-cell"
              @mouseleave="hideAttachmentHint"
            >
              <div class="attachment-icons">
                <span
                  v-for="file in getContactFiles(toContactRecord(row))"
                  :key="file.id"
                  class="pdf-icon-wrap is-clickable"
                  @mouseenter="showAttachmentHint($event, getFileHint(file, toContactRecord(row)))"
                  @click.stop="openAttachment(file)"
                >
                  <el-icon class="pdf-icon"><Document /></el-icon>
                </span>
              </div>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

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

    <div class="my-section__pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        background
        small
        @current-change="handlePageChange"
      />
    </div>
  </section>
</template>

<style scoped>
.my-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.my-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.my-section__header-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.my-section__search {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  max-width: 300px;
}

.my-section__search .el-input {
  flex: 1;
  min-width: 0;
}

.my-section__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.my-section__total {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.my-section__table-wrap {
  height: var(--my-table-height, 392px);
  overflow: hidden;
}

.my-section__table-wrap :deep(.el-table) {
  height: 100%;
}

.my-section__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
  flex-shrink: 0;
}

.attachment-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.attachment-icons {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px;
  max-width: 100%;
  overflow: hidden;
}

.pdf-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: #fff1f0;
  flex-shrink: 0;
}

.pdf-icon-wrap.is-clickable {
  cursor: pointer;
}

.pdf-icon-wrap.is-clickable:hover {
  background: #ffccc7;
}

.pdf-icon {
  font-size: 14px;
  color: #cf1322;
}

.text-muted {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

.project-no-tooltip .project-no-tooltip-item {
  cursor: pointer;
  line-height: 1.6;
  white-space: nowrap;
}

.project-no-tooltip .project-no-tooltip-item:hover {
  text-decoration: underline;
}

.received-date-cell {
  display: inline-block;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: default;
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
