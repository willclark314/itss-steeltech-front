<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchContactList } from '@/api/contacts'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'
import { PAGE_SIZE_OPTIONS } from '@/constants/pagination'
import { ContactForm } from '@/models/biz/contact'
import type {
  ContactGroupBy,
  ContactRecord,
} from '@/models/biz/contact'
import { BIZ_ROUTES } from '@/models/biz/navigation'
import ContactBrowseTable from '@/components/biz/ContactBrowseTable.vue'
import TagSelect from '@/components/biz/TagSelect.vue'

const route = useRoute()
const router = useRouter()

const tableRef = ref<InstanceType<typeof ContactBrowseTable>>()
const highlightedContactId = ref('')

const searchForm = reactive({
  keyword: '',
  tags: [] as string[],
})

const groupByOptions = ContactForm.GROUP_BY_OPTIONS

const {
  pageSize,
  filteredData,
  total,
  page,
  loading,
  loadPage: loadCachedPage,
  loadAll: loadCachedAll,
  loadAroundAnchor: loadCachedAroundAnchor,
  getFilters,
  getAllList,
  cacheRevision,
} = usePaginatedListCache<ContactRecord>({
  getItemKey: (item) => item.id,
  sortList: ContactForm.sortForDisplay,
})

type PaginatedFilters = { keyword?: string; tags?: string[] }

function buildListQuery(params: PaginatedFilters & { page?: number; pageSize?: number; anchor?: string; all?: boolean }) {
  return {
    keyword: params.keyword,
    tags: params.tags,
    page: params.page,
    pageSize: params.pageSize,
    anchor: params.anchor,
    all: params.all,
  }
}

async function loadPage(pageNo = 1, nextFilters?: PaginatedFilters, force = false) {
  return loadCachedPage(
    (params) => fetchContactList(buildListQuery(params)),
    pageNo,
    nextFilters,
    force,
  )
}

async function loadAroundAnchor(anchor: string, nextFilters?: PaginatedFilters, force = false) {
  return loadCachedAroundAnchor(
    (params) => fetchContactList(buildListQuery(params)),
    anchor,
    nextFilters,
    force,
  )
}

function buildViewFilters(): PaginatedFilters {
  return {
    keyword: searchForm.keyword,
    tags: searchForm.tags.length ? [...searchForm.tags] : undefined,
  }
}

async function loadAllForGrouped(nextFilters?: PaginatedFilters, force = false) {
  return loadCachedAll(
    (params) => fetchContactList(buildListQuery({ ...params, all: true })),
    nextFilters,
    force,
  )
}

async function reloadCurrentView(force = false) {
  const filters = buildViewFilters()
  if (isGrouped.value) {
    await loadAllForGrouped(filters, force)
    return
  }
  await loadPage(page.value || 1, filters, force)
}

const groupBy = ref<ContactGroupBy>('')
const isGrouped = computed(() => Boolean(groupBy.value))

const groupDisplayData = computed(() => {
  void cacheRevision.value
  const filters = getFilters()
  return isGrouped.value ? getAllList(filters) : filteredData.value
})

const recordGroups = computed(() => ContactForm.groupRecords(groupDisplayData.value, groupBy.value))

type GroupedMode = Exclude<ContactGroupBy, ''>
const activeGroupKey = ref('')
const activeGroupKeyByMode = ref<Partial<Record<GroupedMode, string>>>({})
const groupPageByKey = ref<Record<string, number>>({})
const groupPageByMode = ref<Partial<Record<GroupedMode, Record<string, number>>>>({})

const activeGroup = computed(
  () => recordGroups.value.find((group) => group.key === activeGroupKey.value) ?? null,
)

const activeGroupPageData = computed(() => {
  const group = activeGroup.value
  if (!group) return []
  return paginateGroupMembers(group.members, group.key)
})

function getGroupPage(groupKey: string) {
  return groupPageByKey.value[groupKey] || 1
}

function paginateGroupMembers(members: ContactRecord[], groupKey: string) {
  const pageNo = getGroupPage(groupKey)
  const start = (pageNo - 1) * pageSize.value
  const sorted = ContactForm.sortForDisplay(members)
  return sorted.slice(start, start + pageSize.value)
}

function handleGroupPageChange(groupKey: string, nextPage: number) {
  groupPageByKey.value = {
    ...groupPageByKey.value,
    [groupKey]: nextPage,
  }
  const mode = groupBy.value
  if (mode) {
    groupPageByMode.value[mode] = { ...groupPageByKey.value }
  }
}

function clampGroupPages() {
  if (!groupBy.value) return

  const nextPages = { ...groupPageByKey.value }
  let changed = false

  for (const group of recordGroups.value) {
    const maxPage = Math.max(1, Math.ceil(group.members.length / pageSize.value))
    const currentPage = nextPages[group.key] || 1
    if (currentPage > maxPage) {
      nextPages[group.key] = maxPage
      changed = true
    }
  }

  if (changed) {
    groupPageByKey.value = nextPages
    const mode = groupBy.value
    if (mode) {
      groupPageByMode.value[mode] = { ...nextPages }
    }
  }
}

function resolveActiveGroupKey(
  groups: ReturnType<typeof ContactForm.groupRecords>,
  mode: ContactGroupBy,
) {
  if (!mode || !groups.length) return ''
  const saved = activeGroupKeyByMode.value[mode]
  if (saved && groups.some((group) => group.key === saved)) return saved
  return groups[0]?.key ?? ''
}

function resetGroupTabState() {
  activeGroupKeyByMode.value = {}
  activeGroupKey.value = ''
  groupPageByMode.value = {}
  groupPageByKey.value = {}
}

function syncActiveGroupKey() {
  if (!groupBy.value) {
    activeGroupKey.value = ''
    return
  }
  activeGroupKey.value = resolveActiveGroupKey(recordGroups.value, groupBy.value)
}

function rememberActiveGroupKey() {
  const mode = groupBy.value
  if (mode && activeGroupKey.value) {
    activeGroupKeyByMode.value[mode] = activeGroupKey.value
  }
}

function scrollToContact(contactId: string) {
  const index = displayData.value.findIndex((item) => item.id === contactId)
  if (index === -1) return

  const rows = tableRef.value?.tableRef?.$el?.querySelectorAll('.el-table__body .el-table__row')
  rows?.[index]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

const displayData = computed(() =>
  isGrouped.value ? activeGroupPageData.value : filteredData.value,
)

async function loadContacts(force = false) {
  try {
    await reloadCurrentView(force)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
  }
}

async function handlePageChange(nextPage: number) {
  try {
    await loadPage(nextPage, getFilters())
    highlightedContactId.value = ''
    nextTick(() => tableRef.value?.tableRef?.setScrollTop(0))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
  }
}

async function handleSizeChange() {
  try {
    if (isGrouped.value) {
      clampGroupPages()
      return
    }
    await loadPage(1, getFilters())
    highlightedContactId.value = ''
    nextTick(() => tableRef.value?.tableRef?.setScrollTop(0))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
  }
}

async function handleSearch() {
  if (route.query.contactId) {
    router.replace({ path: BIZ_ROUTES.contactBrowse })
  }
  resetGroupTabState()
  await loadContacts(true)
  syncActiveGroupKey()
  clampGroupPages()
}

async function handleReset() {
  searchForm.keyword = ''
  searchForm.tags = []
  highlightedContactId.value = ''
  if (route.query.contactId) {
    router.replace({ path: BIZ_ROUTES.contactBrowse })
  }
  resetGroupTabState()
  await loadContacts(false)
  syncActiveGroupKey()
}

async function applyContactIdFromRoute() {
  const contactId = route.query.contactId

  if (typeof contactId === 'string' && contactId) {
    searchForm.keyword = ''
      highlightedContactId.value = contactId
    try {
      await loadAroundAnchor(contactId, {})
      nextTick(() => scrollToContact(contactId))
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载联系单数据失败')
    }
    return
  }

  highlightedContactId.value = ''
}

watch(
  () => route.query.contactId,
  () => {
    void applyContactIdFromRoute()
  },
)

watch(groupBy, (mode, prevMode) => {
  if (prevMode) {
    rememberActiveGroupKey()
    groupPageByMode.value[prevMode] = { ...groupPageByKey.value }
  }

  if (!mode) {
    activeGroupKey.value = ''
    groupPageByKey.value = {}
    void reloadCurrentView()
    return
  }

  const savedPages = groupPageByMode.value[mode]
  groupPageByKey.value = savedPages ? { ...savedPages } : {}
  void reloadCurrentView().then(() => {
    syncActiveGroupKey()
    clampGroupPages()
  })
})

watch(recordGroups, () => {
  if (!groupBy.value) return
  const nextKey = resolveActiveGroupKey(recordGroups.value, groupBy.value)
  if (nextKey !== activeGroupKey.value) {
    activeGroupKey.value = nextKey
  }
  clampGroupPages()
})

onMounted(async () => {
  if (route.query.contactId) {
    await applyContactIdFromRoute()
  } else {
    await loadContacts(false)
  }
})
</script>

<template>
  <el-card shadow="never" class="biz-page-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">联系单</span>
          <span class="page-tip">查询工程联系单，查看正文与附件（只读）</span>
        </div>
      </div>
    </template>

    <div class="search-toolbar">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="单号 / 主题 / 项目号"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="标签">
          <TagSelect v-model="searchForm.tags" :allow-create="false" width="200px" placeholder="全部" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
        <el-form-item label="分组">
          <el-select v-model="groupBy" style="width: 130px">
            <el-option
              v-for="item in groupByOptions"
              :key="item.value || 'list'"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <span class="search-total">共 {{ total }} 条</span>
    </div>

    <div v-if="!isGrouped" class="contact-view-body contact-list-panel">
      <div class="table-scroll">
        <ContactBrowseTable
          ref="tableRef"
          :data="displayData"
          :loading="loading"
          :highlighted-contact-id="highlightedContactId"
        />
      </div>
      <div class="table-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[...PAGE_SIZE_OPTIONS]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <div v-else v-loading="loading" class="contact-view-body record-group-panel">
      <el-tabs
        v-if="recordGroups.length"
        v-model="activeGroupKey"
        class="record-group-tabs"
      >
        <el-tab-pane
          v-for="group in recordGroups"
          :key="group.key"
          :name="group.key"
        >
          <template #label>
            <span class="record-group-tab-label">
              {{ group.label }}
              <span class="record-group-tab-count">{{ group.members.length }}</span>
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>
      <div v-if="activeGroup" class="record-group-content">
        <div class="table-scroll">
          <ContactBrowseTable
            :data="displayData"
            table-height="100%"
            :show-child-count="false"
            :highlighted-contact-id="highlightedContactId"
          />
        </div>
        <div class="table-pagination">
          <el-pagination
            :current-page="getGroupPage(activeGroup.key)"
            v-model:page-size="pageSize"
            :page-sizes="[...PAGE_SIZE_OPTIONS]"
            :total="activeGroup.members.length"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="handleSizeChange"
            @current-change="(nextPage) => handleGroupPageChange(activeGroup!.key, nextPage)"
          />
        </div>
      </div>
      <el-empty v-else-if="!loading" class="record-group-empty" description="暂无匹配联系单" />
    </div>
  </el-card>
</template>

<style scoped>
.page-tip {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--el-text-color-secondary);
}

.contact-view-body {
  --contact-pagination-height: 48px;
  --contact-table-height: calc(100vh - 300px);
  --contact-data-block-height: calc(var(--contact-table-height) + var(--contact-pagination-height));
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.contact-list-panel .table-scroll {
  height: var(--contact-table-height);
  overflow: hidden;
}

.record-group-panel {
  height: var(--contact-data-block-height);
  gap: 0;
}

.record-group-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.record-group-panel .table-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.record-group-panel .table-pagination {
  flex-shrink: 0;
  margin-top: 12px;
}

.record-group-empty {
  flex: 1;
  min-height: 0;
}

.record-group-tabs {
  flex-shrink: 0;
}

.record-group-tabs :deep(.el-tabs__header) {
  margin-bottom: 6px;
}

.record-group-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}

.record-group-tabs :deep(.el-tabs__item) {
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 26px;
}

.record-group-tabs :deep(.el-tabs__active-bar) {
  height: 2px;
}

.record-group-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.record-group-tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 14px;
  padding: 0 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
  border-radius: 7px;
}

.record-group-tabs :deep(.el-tabs__item.is-active) .record-group-tab-count {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
</style>
