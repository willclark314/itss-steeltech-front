<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  APP_PAGES,
  DEV_APP_PAGES,
  type AppPageDefinition,
} from '@/models/navigation/appNavigation'
import { getUser, isAdminUser } from '@/utils/auth'
import {
  buildOrderedAccessiblePages,
  getModuleOrder,
  getNavigationOrderRef,
  loadNavigationOrder,
} from '@/utils/navigationOrder'
import { filterAccessiblePages } from '@/utils/permission'

const router = useRouter()
const isDev = import.meta.env.DEV
const currentUser = computed(() => getUser())
const navigationOrder = getNavigationOrderRef()

const accessiblePages = computed<AppPageDefinition[]>(() => {
  const pages = filterAccessiblePages(APP_PAGES, currentUser.value)
  const devPages =
    isDev && isAdminUser(currentUser.value) ? DEV_APP_PAGES : []
  void navigationOrder.value
  return buildOrderedAccessiblePages(pages, devPages)
})

interface SystemModule {
  name: string
  summary: string
  links: Array<{
    path: string
    title: string
    description: string
  }>
}

const MODULE_SUMMARY: Record<string, string> = {
  门户: '系统入口与基础信息，便于快速了解平台概况。',
  钢构技术系统: '支撑钢构技术日常协同，管理项目与工程联系单。',
  生产计划系统: '生产计划相关功能入口，后续将逐步扩展业务页面。',
  人员系统: '钢结构技术科人员信息与休假安排管理。',
  系统设置: '系统级参数与全局配置，对所有用户生效。',
  开发: '开发调试与界面预览页面。',
}

const systemModules = computed<SystemModule[]>(() => {
  void navigationOrder.value
  const moduleNames = [
    ...getModuleOrder(),
    ...(isDev && isAdminUser(currentUser.value) ? ['开发'] : []),
  ]

  return moduleNames
    .map((name) => {
      const links = accessiblePages.value
        .filter((page) => page.module === name)
        .map((page) => ({
          path: page.path,
          title: page.pageName,
          description: page.description ?? '',
        }))
      if (!links.length) return null
      return {
        name,
        summary: MODULE_SUMMARY[name] ?? '',
        links,
      }
    })
    .filter((module): module is SystemModule => module !== null)
})

function goTo(path: string) {
  void router.push(path)
}

onMounted(() => {
  void loadNavigationOrder()
})
</script>

<template>
  <div class="home-page">
    <section class="intro-panel">
      <div class="intro-panel__accent" />
      <div class="intro-panel__body">
        <h2 class="intro-panel__title">欢迎使用 ITSS Steeltech</h2>
        <p class="intro-panel__text">
          面向钢结构技术业务的综合管理平台。可通过顶部系统切换进入各模块，或点击下方功能入口快速跳转。
        </p>
      </div>
    </section>

    <div class="module-list">
      <section v-for="module in systemModules" :key="module.name" class="module-panel">
        <header class="module-panel__header">
          <span class="module-panel__name">{{ module.name }}</span>
          <span class="module-panel__summary">{{ module.summary }}</span>
        </header>

        <div class="feature-map">
          <button
            v-for="link in module.links"
            :key="link.path"
            type="button"
            class="feature-link"
            @click="goTo(link.path)"
          >
            <span class="feature-link__main">
              <span class="feature-link__title">{{ link.title }}</span>
              <span class="feature-link__desc">{{ link.description }}</span>
            </span>
            <el-icon class="feature-link__arrow"><ArrowRight /></el-icon>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  --home-accent: #1890ff;
  --home-panel-bg: var(--el-bg-color);
  --home-panel-border: var(--el-border-color-lighter);
  --home-header-bg: var(--el-fill-color-lighter);
  --home-accent-soft: rgba(24, 144, 255, 0.06);
  --home-accent-hover: rgba(24, 144, 255, 0.04);
  --home-shadow: 0 1px 4px rgba(0, 21, 41, 0.06);

  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.intro-panel {
  flex-shrink: 0;
  display: flex;
  overflow: hidden;
  background: var(--home-panel-bg);
  border: 1px solid var(--home-panel-border);
  border-radius: 4px;
  box-shadow: var(--home-shadow);
}

.intro-panel__accent {
  flex-shrink: 0;
  width: 4px;
  background: var(--home-accent);
}

.intro-panel__body {
  flex: 1;
  min-width: 0;
  padding: 12px 16px;
  background: linear-gradient(90deg, var(--home-accent-soft), transparent 280px);
}

.intro-panel__title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.intro-panel__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

.module-list {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 12px;
  overflow: hidden;
}

.module-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--home-panel-bg);
  border: 1px solid var(--home-panel-border);
  border-radius: 4px;
  box-shadow: var(--home-shadow);
}

.module-panel__header {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  background: var(--home-header-bg);
  border-bottom: 1px solid var(--home-panel-border);
}

.module-panel__name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.module-panel__name::before {
  content: '';
  width: 3px;
  height: 12px;
  border-radius: 2px;
  background: var(--home-accent);
}

.module-panel__summary {
  padding-left: 11px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feature-map {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  padding: 10px 14px 12px;
  align-content: start;
  overflow: hidden;
}

.feature-link {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  background: var(--home-panel-bg);
  border: 1px solid var(--home-panel-border);
  border-radius: 4px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s,
    box-shadow 0.2s;
}

.feature-link:hover {
  background: var(--home-accent-hover);
  border-color: rgba(24, 144, 255, 0.35);
  box-shadow: var(--home-shadow);
}

.feature-link__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.feature-link__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  transition: color 0.2s;
}

.feature-link:hover .feature-link__title {
  color: var(--home-accent);
}

.feature-link__desc {
  font-size: 12px;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feature-link__arrow {
  flex-shrink: 0;
  margin-top: 1px;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  transition:
    color 0.2s,
    transform 0.2s;
}

.feature-link:hover .feature-link__arrow {
  color: var(--home-accent);
  transform: translateX(2px);
}

@media (max-height: 760px) {
  .home-page {
    gap: 8px;
  }

  .intro-panel__body {
    padding: 10px 14px;
  }

  .intro-panel__title {
    font-size: 15px;
  }

  .intro-panel__text {
    font-size: 12px;
  }

  .module-list {
    gap: 8px;
  }

  .module-panel__header {
    padding: 8px 12px;
  }

  .feature-map {
    gap: 6px;
    padding: 8px 12px 10px;
  }

  .feature-link {
    padding: 6px 8px;
  }

  .feature-link__desc {
    -webkit-line-clamp: 1;
  }
}

html.dark .home-page {
  --home-accent-soft: rgba(24, 144, 255, 0.12);
  --home-accent-hover: rgba(24, 144, 255, 0.08);
  --home-shadow: none;
}
</style>
