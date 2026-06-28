<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UserMenu from '@/components/UserMenu.vue'
import LayoutTabs from '@/components/LayoutTabs.vue'
import { getUser, isAdminUser } from '@/utils/auth'

const route = useRoute()
const router = useRouter()

const isCollapsed = ref(false)
const MENU_ICON_WIDTH = 20
const MENU_SIDE_PADDING = 16
const collapsedAsideWidth = MENU_ICON_WIDTH + MENU_SIDE_PADDING * 2
const asideWidth = computed(() => (isCollapsed.value ? `${collapsedAsideWidth}px` : '220px'))

type SystemId = 'production' | 'business' | 'personnel' | 'system' | 'development'

interface MenuItem {
  path: string
  title: string
  icon: string
}

const isDev = import.meta.env.DEV

// ── 当前用户权限 ──
const isAdminUserFlag = isAdminUser(getUser())

const systems = computed(() => {
  const list: { id: SystemId; name: string }[] = [
    { id: 'production', name: '门户' },
    { id: 'personnel', name: '人员系统' },
  ]
  // 仅管理员可见：业务系统、系统设置、开发
  if (isAdminUserFlag) {
    list.splice(1, 0, { id: 'business', name: '业务系统' })
    list.push({ id: 'system', name: '系统设置' })
    if (isDev) {
      list.push({ id: 'development', name: '开发' })
    }
  }
  return list
})

function resolveSystemFromPath(path: string): SystemId {
  if (path.startsWith('/dev')) return 'development'
  if (path.startsWith('/system')) return 'system'
  if (path.startsWith('/business')) return 'business'
  if (path.startsWith('/personnel')) return 'personnel'
  if (path.startsWith('/portal') || path === '/home') return 'production'
  return 'production'
}

const activeSystem = ref(resolveSystemFromPath(route.path))

const menuItemsBySystem = computed<Record<SystemId, MenuItem[]>>(() => ({
  production: [
    { path: '/home', title: '首页', icon: 'House' },
    { path: '/portal/about', title: '关于', icon: 'InfoFilled' },
  ],
  business: [
    { path: '/business/contact', title: '联系单', icon: 'Message' },
    { path: '/business/project', title: '项目', icon: 'Briefcase' },
    { path: '/business/schedule', title: '工作安排', icon: 'Calendar' },
  ],
  personnel: isAdminUserFlag
    ? [
        { path: '/personnel/person', title: '人员', icon: 'Avatar' },
        { path: '/personnel/role', title: '角色', icon: 'Key' },
        { path: '/personnel/leave', title: '休假', icon: 'Calendar' },
        { path: '/personnel/monthly-rest', title: '月休计划', icon: 'Document' },
      ]
    : [
        { path: '/personnel/leave', title: '休假', icon: 'Calendar' },
        { path: '/personnel/monthly-rest', title: '月休计划', icon: 'Document' },
      ],
  system: [
    { path: '/system/settings', title: '全局配置', icon: 'Setting' },
  ],
  development: isDev
    ? [
        { path: '/dev/page1', title: '浏览器储存', icon: 'Document' },
        { path: '/dev/page3', title: '开发页面3', icon: 'Folder' },
        { path: '/dev/login', title: '登录页面', icon: 'User' },
        { path: '/dev/error', title: '错误页面', icon: 'Warning' },
      ]
    : [],
}))

const menuItems = computed(() => menuItemsBySystem.value[activeSystem.value])

const activeMenu = computed(() => route.path)

watch(
  () => route.path,
  (path) => {
    activeSystem.value = resolveSystemFromPath(path)
  },
)

function selectSystem(systemId: SystemId) {
  activeSystem.value = systemId
}

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

function goHome() {
  router.push('/home')
}
</script>

<template>
  <div class="layout-root">
    <div class="layout-top">
      <div
        class="logo"
        :class="{ 'is-collapsed': isCollapsed }"
        :style="{ width: asideWidth }"
      >
        <div class="logo-brand" @click="goHome">
          <img src="/logo-icon.svg" alt="ITSS" class="logo-icon" />
          <span v-if="!isCollapsed" class="logo-text">Steel Tech</span>
        </div>
        <el-button class="collapse-btn" link @click.stop="toggleSidebar">
          <el-icon :size="isCollapsed ? 14 : 16">
            <Expand v-if="isCollapsed" />
            <Fold v-else />
          </el-icon>
        </el-button>
      </div>
      <div class="system-bar">
        <div class="system-list">
          <button
            v-for="system in systems"
            :key="system.id"
            type="button"
            class="system-item"
            :class="{ 'is-active': activeSystem === system.id }"
            @click="selectSystem(system.id)"
          >
            {{ system.name }}
          </button>
        </div>
        <UserMenu />
      </div>
    </div>

    <el-container class="layout-container">
      <el-aside :width="asideWidth" class="layout-aside">
        <el-menu
          :key="`${activeSystem}-${activeMenu}`"
          class="side-menu"
          :default-active="activeMenu"
          router
          :collapse="isCollapsed"
          :collapse-transition="false"
          background-color="#001529"
          text-color="#ffffffa6"
          active-text-color="#fff"
        >
          <el-menu-item
            v-for="item in menuItems"
            :key="item.path"
            :index="item.path"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-container class="layout-body">
        <div class="layout-tabs-bar">
          <LayoutTabs />
        </div>
        <el-main class="layout-main">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<style scoped>
.layout-root {
  --layout-top-height: 48px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout-top {
  display: flex;
  height: var(--layout-top-height);
  flex-shrink: 0;
}

.system-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
  height: var(--layout-top-height);
  padding: 0 12px;
  background: #002140;
  border-bottom: 1px solid #ffffff1a;
}

.system-list {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
  overflow-x: auto;
}

.system-item {
  height: var(--layout-top-height);
  padding: 0 12px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #ffffffa6;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s, background-color 0.2s, border-color 0.2s;
}

.system-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}

.system-item.is-active {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border-bottom-color: #1890ff;
}

.layout-container {
  flex: 1;
  min-height: 0;
}

.layout-aside {
  background-color: #001529;
  overflow: hidden;
  transition: width 0.25s ease;
  flex-shrink: 0;
}

.layout-aside :deep(.el-menu) {
  border-right: none;
  --el-menu-item-height: 40px;
  --el-menu-sub-item-height: 40px;
  --el-menu-base-level-padding: 16px;
  --el-menu-icon-width: 20px;
}

.layout-aside :deep(.el-menu--collapse) {
  width: 100% !important;
}

.layout-aside :deep(.el-menu-item) {
  position: relative;
  font-size: 13px;
  margin: 4px 8px;
  border-radius: 4px;
  transition: color 0.2s, background-color 0.2s;
}

.layout-aside :deep(.el-menu-item .el-icon) {
  font-size: 16px;
}

.layout-aside :deep(.el-menu-item:hover) {
  color: #fff !important;
  background-color: rgba(255, 255, 255, 0.08) !important;
}

.layout-aside :deep(.el-menu-item.is-active) {
  color: #fff !important;
  background-color: #1890ff !important;
}

.layout-aside :deep(.el-menu-item.is-active::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: 0 2px 2px 0;
  background-color: #fff;
}

.layout-aside :deep(.el-menu--collapse .el-menu-item) {
  margin: 4px 0;
  padding: 0 !important;
  justify-content: center;
}

.layout-aside :deep(.el-menu--collapse .el-menu-item .el-menu-tooltip__trigger) {
  width: 100%;
  padding: 0 var(--el-menu-base-level-padding) !important;
  justify-content: center;
  box-sizing: border-box;
}

.layout-aside :deep(.el-menu--collapse .el-menu-item .el-icon) {
  margin: 0;
}

.layout-aside :deep(.el-menu--collapse .el-menu-item.is-active::before) {
  display: none;
}

.logo {
  height: var(--layout-top-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 0 6px 0 10px;
  background-color: #001529;
  color: #fff;
  border-bottom: 1px solid #ffffff1a;
  overflow: hidden;
  flex-shrink: 0;
  transition: width 0.25s ease;
  box-sizing: border-box;
}

.logo-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  cursor: pointer;
}

.logo-brand:hover {
  opacity: 0.9;
}

.logo.is-collapsed {
  justify-content: center;
  gap: 2px;
  padding: 0 4px;
}

.logo.is-collapsed .logo-brand {
  flex: 0;
}

.logo-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  transition: width 0.25s ease, height 0.25s ease;
}

.logo.is-collapsed .logo-icon {
  width: 20px;
  height: 20px;
}

.logo-text {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.layout-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.layout-tabs-bar {
  flex-shrink: 0;
  background: var(--app-tabs-bar-bg);
  border-bottom: 1px solid var(--app-tabs-bar-border);
  box-shadow: var(--app-tabs-bar-shadow);
}

.layout-main {
  flex: 1;
  min-height: 0;
  background: var(--app-content-bg);
  --el-main-padding: 0;
  padding: 20px 20px 10px;
}

.collapse-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  color: #ffffffa6;
}

.logo.is-collapsed .collapse-btn {
  width: 20px;
  height: 20px;
}

.collapse-btn:hover {
  color: #fff;
}
</style>
