<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  APP_PAGES,
  APP_SYSTEMS,
  type AppSystemId,
} from '@/models/navigation/appNavigation'
import {
  ALWAYS_VISIBLE_PAGES,
  applySystemOrder,
  getDefaultNavigationOrder,
  getPagesForSystem,
  loadNavigationOrder,
  saveNavigationOrder,
  setPagesForSystem,
  type NavigationOrderConfig,
} from '@/utils/navigationOrder'
import { canEditPage } from '@/utils/permission'

interface SortableItem {
  key: string
  label: string
  visible: boolean
  locked: boolean
}

const canEdit = computed(() => canEditPage('page-config'))
const loading = ref(false)
const saving = ref(false)
const activeSystemTab = ref<AppSystemId>('portal')
const form = reactive<NavigationOrderConfig>(getDefaultNavigationOrder())

const hiddenPageSet = computed(() => new Set(form.hiddenPages))

const systemItems = computed(() =>
  form.systems.flatMap((systemId) => {
    const system = APP_SYSTEMS.find((item) => item.id === systemId)
    if (!system) return []
    return [{ key: system.id, label: system.name, visible: true, locked: false }]
  }),
)

const pageSections = computed(() =>
  form.systems
    .map((systemId) => {
      const system = APP_SYSTEMS.find((item) => item.id === systemId)
      if (!system) return null
      const pageKeys = getPagesForSystem(form.pages, systemId)
      const items = pageKeys
        .map((pageKey) => {
          const page = APP_PAGES.find((item) => item.pageKey === pageKey)
          if (!page) return null
          const locked = ALWAYS_VISIBLE_PAGES.has(page.pageKey)
          return {
            key: page.pageKey,
            label: page.pageName,
            visible: locked || !hiddenPageSet.value.has(page.pageKey),
            locked,
          }
        })
        .filter((item): item is SortableItem => item !== null)
      return {
        systemId,
        title: system.name,
        items,
      }
    })
    .filter((section): section is NonNullable<typeof section> => section !== null),
)

watch(
  () => form.systems,
  (systems) => {
    if (!systems.includes(activeSystemTab.value)) {
      activeSystemTab.value = systems[0] ?? 'portal'
    }
  },
  { immediate: true },
)

function moveItem(items: SortableItem[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length) {
    return
  }
  const nextItems = [...items]
  const [moved] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, moved)
  return nextItems
}

function handleMoveSystem(index: number, direction: -1 | 1) {
  const nextItems = moveItem(systemItems.value, index, index + direction)
  if (!nextItems) return
  const nextConfig = applySystemOrder(form, nextItems.map((item) => item.key as AppSystemId))
  form.systems = [...nextConfig.systems]
  form.pages = [...nextConfig.pages]
  form.hiddenPages = [...nextConfig.hiddenPages]
}

function handleMovePage(systemId: AppSystemId, index: number, direction: -1 | 1) {
  const section = pageSections.value.find((item) => item.systemId === systemId)
  if (!section) return
  const nextItems = moveItem(section.items, index, index + direction)
  if (!nextItems) return
  form.pages = setPagesForSystem(
    form.pages,
    systemId,
    nextItems.map((item) => item.key),
  )
}

function handlePageVisibilityChange(pageKey: string, visible: boolean) {
  if (ALWAYS_VISIBLE_PAGES.has(pageKey)) return
  if (visible) {
    form.hiddenPages = form.hiddenPages.filter((key) => key !== pageKey)
    return
  }
  if (!form.hiddenPages.includes(pageKey)) {
    form.hiddenPages = [...form.hiddenPages, pageKey]
  }
}

function handleSystemDragStart(event: DragEvent, index: number) {
  event.dataTransfer?.setData('text/plain', `system:${index}`)
  event.dataTransfer!.effectAllowed = 'move'
}

function handlePageDragStart(event: DragEvent, systemId: AppSystemId, index: number) {
  event.dataTransfer?.setData('text/plain', `page:${systemId}:${index}`)
  event.dataTransfer!.effectAllowed = 'move'
}

function handleSystemDrop(event: DragEvent, toIndex: number) {
  event.preventDefault()
  const raw = event.dataTransfer?.getData('text/plain') ?? ''
  if (!raw.startsWith('system:')) return
  const fromIndex = Number(raw.slice('system:'.length))
  if (Number.isNaN(fromIndex)) return
  const nextItems = moveItem(systemItems.value, fromIndex, toIndex)
  if (!nextItems) return
  const nextConfig = applySystemOrder(form, nextItems.map((item) => item.key as AppSystemId))
  form.systems = [...nextConfig.systems]
  form.pages = [...nextConfig.pages]
  form.hiddenPages = [...nextConfig.hiddenPages]
}

function handlePageDrop(event: DragEvent, systemId: AppSystemId, toIndex: number) {
  event.preventDefault()
  const raw = event.dataTransfer?.getData('text/plain') ?? ''
  const prefix = `page:${systemId}:`
  if (!raw.startsWith(prefix)) return
  const fromIndex = Number(raw.slice(prefix.length))
  if (Number.isNaN(fromIndex)) return
  const section = pageSections.value.find((item) => item.systemId === systemId)
  if (!section) return
  const nextItems = moveItem(section.items, fromIndex, toIndex)
  if (!nextItems) return
  form.pages = setPagesForSystem(
    form.pages,
    systemId,
    nextItems.map((item) => item.key),
  )
}

function allowDrop(event: DragEvent) {
  event.preventDefault()
}

async function loadConfig() {
  loading.value = true
  try {
    const config = await loadNavigationOrder(true)
    form.systems = [...config.systems]
    form.pages = [...config.pages]
    form.hiddenPages = [...config.hiddenPages]
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载页面配置失败')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    const saved = await saveNavigationOrder({
      systems: [...form.systems],
      pages: [...form.pages],
      hiddenPages: [...form.hiddenPages],
    })
    form.systems = [...saved.systems]
    form.pages = [...saved.pages]
    form.hiddenPages = [...saved.hiddenPages]
    ElMessage.success('页面配置已保存，导航展示将对所有用户生效')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存页面配置失败')
  } finally {
    saving.value = false
  }
}

function handleReset() {
  const defaults = getDefaultNavigationOrder()
  form.systems = [...defaults.systems]
  form.pages = [...defaults.pages]
  form.hiddenPages = [...defaults.hiddenPages]
}

onMounted(() => {
  void loadConfig()
})
</script>

<template>
  <div v-loading="loading" class="page-config-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>页面配置</span>
          <span class="card-subtitle">调整顶部系统与各系统侧栏菜单的显示顺序，以及页面是否展示</span>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="page-alert"
        title="此处配置对所有登录用户生效。可调整顺序，并用「展示」开关控制页面是否出现在导航中。"
      />

      <section class="config-section">
        <div class="section-title">顶部系统顺序</div>
        <p class="section-desc">
          模拟主界面顶部系统切换栏，从左到右排列。可拖拽或使用左右按钮调整顺序。
        </p>
        <div class="system-sort-bar">
          <div
            v-for="(item, index) in systemItems"
            :key="item.key"
            class="system-sort-item"
            :class="{ 'is-drag-disabled': !canEdit }"
            :draggable="canEdit"
            @dragstart="handleSystemDragStart($event, index)"
            @dragover="allowDrop"
            @drop="handleSystemDrop($event, index)"
          >
            <span class="system-sort-item__label">
              <el-icon class="drag-handle"><Rank /></el-icon>
              {{ item.label }}
            </span>
            <span v-if="canEdit" class="system-sort-item__actions">
              <el-button
                link
                :disabled="index === 0"
                @click="handleMoveSystem(index, -1)"
              >
                左移
              </el-button>
              <el-button
                link
                :disabled="index === systemItems.length - 1"
                @click="handleMoveSystem(index, 1)"
              >
                右移
              </el-button>
            </span>
          </div>
        </div>
      </section>

      <section class="config-section">
        <div class="section-title">侧栏页面顺序与展示</div>
        <p class="section-desc">
          切换下方标签页，分别配置各系统左侧菜单项的上下排列顺序，以及是否在导航中展示。
        </p>
        <el-tabs v-model="activeSystemTab" class="page-sort-tabs">
          <el-tab-pane
            v-for="section in pageSections"
            :key="section.systemId"
            :label="section.title"
            :name="section.systemId"
          >
            <ul class="sort-list">
              <li
                v-for="(item, index) in section.items"
                :key="item.key"
                class="sort-item"
                :class="{
                  'is-drag-disabled': !canEdit,
                  'is-hidden': !item.visible,
                }"
                :draggable="canEdit"
                @dragstart="handlePageDragStart($event, section.systemId, index)"
                @dragover="allowDrop"
                @drop="handlePageDrop($event, section.systemId, index)"
              >
                <span class="sort-item__label">
                  <el-icon class="drag-handle"><Rank /></el-icon>
                  {{ item.label }}
                </span>
                <span class="sort-item__actions">
                  <span class="visibility-control" @click.stop @mousedown.stop>
                    <span class="visibility-label">展示</span>
                    <el-switch
                      :model-value="item.visible"
                      :disabled="!canEdit || item.locked"
                      size="small"
                      @change="(value) => handlePageVisibilityChange(item.key, Boolean(value))"
                    />
                  </span>
                  <template v-if="canEdit">
                    <el-button
                      link
                      :disabled="index === 0"
                      @click="handleMovePage(section.systemId, index, -1)"
                    >
                      上移
                    </el-button>
                    <el-button
                      link
                      :disabled="index === section.items.length - 1"
                      @click="handleMovePage(section.systemId, index, 1)"
                    >
                      下移
                    </el-button>
                  </template>
                </span>
              </li>
            </ul>
          </el-tab-pane>
        </el-tabs>
      </section>

      <div v-if="canEdit" class="form-actions">
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存配置
        </el-button>
        <el-button :disabled="loading || saving" @click="handleReset">
          恢复默认
        </el-button>
        <el-button :disabled="loading || saving" @click="loadConfig">
          重新加载
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.page-config-page {
  max-width: 820px;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.page-alert {
  margin-bottom: 20px;
}

.config-section + .config-section {
  margin-top: 28px;
}

.section-title {
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.section-desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.system-sort-bar {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  overflow-x: auto;
}

.system-sort-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 108px;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  cursor: grab;
  user-select: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.system-sort-item:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.system-sort-item.is-drag-disabled {
  cursor: default;
}

.system-sort-item__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.system-sort-item__actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.page-sort-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}

.sort-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.sort-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 0 12px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: grab;
  user-select: none;
}

.sort-item.is-drag-disabled {
  cursor: default;
}

.sort-item.is-hidden {
  background: var(--el-fill-color-light);
}

.sort-item.is-hidden .sort-item__label {
  color: var(--el-text-color-secondary);
}

.sort-item:last-child {
  border-bottom: none;
}

.sort-item__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.drag-handle {
  color: var(--el-text-color-secondary);
}

.sort-item__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.visibility-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 4px;
}

.visibility-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}
</style>
