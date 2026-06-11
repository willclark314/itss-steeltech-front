<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import type { TabsPaneContext } from 'element-plus'

interface TabItem {
  path: string
  title: string
  affix?: boolean
}

const HOME_PATH = '/home'

const route = useRoute()
const router = useRouter()

const tabsRef = ref()
const activeTab = ref(HOME_PATH)
const openedTabs = ref<TabItem[]>([
  { path: HOME_PATH, title: '首页', affix: true },
])

let draggedTabIndex: number | null = null
let dragHandlersBound = false

function addTab(tab: TabItem) {
  const exists = openedTabs.value.some((item) => item.path === tab.path)
  if (!exists) {
    openedTabs.value.push(tab)
  }
}

function syncTabFromRoute(currentRoute: RouteLocationNormalizedLoaded) {
  const { path, meta } = currentRoute
  if (!meta?.title || meta.public) return

  addTab({
    path,
    title: meta.title,
    affix: path === HOME_PATH,
  })
  activeTab.value = path
}

watch(
  () => route.path,
  () => syncTabFromRoute(route),
  { immediate: true },
)

function handleTabClick(pane: TabsPaneContext) {
  const path = String(pane.paneName)
  if (path !== route.path) {
    router.push(path)
  }
}

function handleTabRemove(path: string | number) {
  const tabPath = String(path)
  if (tabPath === HOME_PATH) return

  const index = openedTabs.value.findIndex((item) => item.path === tabPath)
  if (index === -1) return

  openedTabs.value.splice(index, 1)

  if (route.path === tabPath) {
    const nextTab = openedTabs.value[index] || openedTabs.value[index - 1]
    router.push(nextTab.path)
  }
}

function getFirstMovableIndex() {
  const affixCount = openedTabs.value.filter((tab) => tab.affix).length
  return affixCount
}

function reorderTabs(fromIndex: number, toIndex: number) {
  const firstMovableIndex = getFirstMovableIndex()
  if (
    fromIndex < firstMovableIndex ||
    toIndex < firstMovableIndex ||
    fromIndex === toIndex
  ) {
    return
  }

  const tabs = [...openedTabs.value]
  const [movedTab] = tabs.splice(fromIndex, 1)
  tabs.splice(toIndex, 0, movedTab)
  openedTabs.value = tabs
}

function clearDragState() {
  draggedTabIndex = null
  const items = tabsRef.value?.$el?.querySelectorAll('.el-tabs__item') ?? []
  items.forEach((item: Element) => {
    item.classList.remove('is-dragging', 'is-drag-over')
  })
}

function handleDragStart(event: DragEvent, index: number) {
  const tab = openedTabs.value[index]
  if (!tab || tab.affix) {
    event.preventDefault()
    return
  }

  draggedTabIndex = index
  event.dataTransfer!.effectAllowed = 'move'
  event.dataTransfer!.setData('text/plain', tab.path)
  ;(event.currentTarget as HTMLElement).classList.add('is-dragging')
}

function handleDragOver(event: DragEvent, index: number) {
  const tab = openedTabs.value[index]
  if (!tab || tab.affix || draggedTabIndex === null) return

  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
}

function handleDragEnter(event: DragEvent, index: number) {
  const tab = openedTabs.value[index]
  if (!tab || tab.affix || index === draggedTabIndex) return

  ;(event.currentTarget as HTMLElement).classList.add('is-drag-over')
}

function handleDragLeave(event: DragEvent) {
  ;(event.currentTarget as HTMLElement).classList.remove('is-drag-over')
}

function handleDrop(event: DragEvent, index: number) {
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).classList.remove('is-drag-over')

  if (draggedTabIndex === null) return

  reorderTabs(draggedTabIndex, index)
  clearDragState()
  nextTick(setupTabDrag)
}

function handleDragEnd(event: DragEvent) {
  ;(event.currentTarget as HTMLElement).classList.remove('is-dragging')
  clearDragState()
}

function setupTabDrag() {
  const root = tabsRef.value?.$el
  if (!root) return

  const items = root.querySelectorAll('.el-tabs__nav .el-tabs__item')
  items.forEach((item: HTMLElement, index: number) => {
    const tab = openedTabs.value[index]
    const isDraggable = tab && !tab.affix

    item.setAttribute('draggable', isDraggable ? 'true' : 'false')
    item.classList.toggle('is-draggable', isDraggable)

    item.ondragstart = isDraggable ? (event: DragEvent) => handleDragStart(event, index) : null
    item.ondragover = (event: DragEvent) => handleDragOver(event, index)
    item.ondragenter = (event: DragEvent) => handleDragEnter(event, index)
    item.ondragleave = (event: DragEvent) => handleDragLeave(event)
    item.ondrop = (event: DragEvent) => handleDrop(event, index)
    item.ondragend = isDraggable ? handleDragEnd : null
  })

  dragHandlersBound = true
}

function teardownTabDrag() {
  const root = tabsRef.value?.$el
  if (!root) return

  const items = root.querySelectorAll('.el-tabs__nav .el-tabs__item')
  items.forEach((item: HTMLElement) => {
    item.removeAttribute('draggable')
    item.classList.remove('is-draggable', 'is-dragging', 'is-drag-over')
    item.ondragstart = null
    item.ondragover = null
    item.ondragenter = null
    item.ondragleave = null
    item.ondrop = null
    item.ondragend = null
  })

  dragHandlersBound = false
  clearDragState()
}

watch(
  openedTabs,
  () => {
    nextTick(() => {
      if (dragHandlersBound) teardownTabDrag()
      setupTabDrag()
    })
  },
  { deep: true },
)

watch(activeTab, () => {
  nextTick(setupTabDrag)
})

onMounted(() => {
  nextTick(setupTabDrag)
})

onBeforeUnmount(() => {
  teardownTabDrag()
})
</script>

<template>
  <el-tabs
    ref="tabsRef"
    v-model="activeTab"
    type="card"
    class="layout-tabs"
    @tab-click="handleTabClick"
    @tab-remove="handleTabRemove"
  >
    <el-tab-pane
      v-for="tab in openedTabs"
      :key="tab.path"
      :label="tab.title"
      :name="tab.path"
      :closable="!tab.affix"
    />
  </el-tabs>
</template>

<style scoped>
.layout-tabs {
  --layout-tabs-height: 36px;
}

.layout-tabs :deep(.el-tabs__header) {
  margin: 0;
  border-bottom: none;
}

.layout-tabs :deep(.el-tabs__nav-wrap) {
  padding: 4px 12px 0;
}

.layout-tabs :deep(.el-tabs__item) {
  height: var(--layout-tabs-height);
  line-height: var(--layout-tabs-height);
  font-size: 13px;
  padding: 0 14px;
}

.layout-tabs :deep(.el-tabs__item .is-icon-close),
.layout-tabs :deep(.el-tabs__item .el-icon-close) {
  cursor: pointer;
}

.layout-tabs :deep(.el-tabs__item.is-dragging) {
  opacity: 0.55;
}

.layout-tabs :deep(.el-tabs__item.is-drag-over) {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.layout-tabs :deep(.el-tabs__content) {
  display: none;
}
</style>
