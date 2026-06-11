<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

interface FeatureLink {
  path: string
  title: string
  description: string
}

interface SystemModule {
  name: string
  summary: string
  links: FeatureLink[]
}

const systemModules: SystemModule[] = [
  {
    name: '门户',
    summary: '系统入口与基础信息，便于快速了解平台概况。',
    links: [
      {
        path: '/home',
        title: '首页',
        description: '系统概览与功能导航',
      },
      {
        path: '/portal/about',
        title: '关于',
        description: '了解系统概况与使用说明',
      },
    ],
  },
  {
    name: '业务系统',
    summary: '支撑日常业务协同，管理项目与工程联系单。',
    links: [
      {
        path: '/business/contact',
        title: '联系单',
        description: '联系单录入、查询、附件管理与状态跟踪',
      },
      {
        path: '/business/project',
        title: '项目',
        description: '项目信息维护、检索及与联系单关联查看',
      },
      {
        path: '/business/schedule',
        title: '工作安排',
        description: '按年度计划开始与结束时间查看项目日历安排',
      },
    ],
  },
  {
    name: '人员系统',
    summary: '钢结构技术科人员信息与休假安排管理。',
    links: [
      {
        path: '/personnel/person',
        title: '人员',
        description: '人员档案查询、详情编辑及按班组/国籍/宿舍分组',
      },
      {
        path: '/personnel/role',
        title: '角色',
        description: '角色管理、关联人员与页面访问权限配置',
      },
      {
        path: '/personnel/leave',
        title: '休假',
        description: '全年休假日历、班组筛选与休假记录查看',
      },
    ],
  },
]

function goTo(path: string) {
  void router.push(path)
}
</script>

<template>
  <div class="home-page">
    <section class="intro-panel">
      <div class="intro-panel__accent" />
      <div class="intro-panel__body">
        <h2 class="intro-panel__title">欢迎使用 ITSS Steeltech</h2>
        <p class="intro-panel__text">
          ITSS Steeltech 是面向钢结构技术业务的综合管理平台，涵盖业务协同与人员管理。
          您可通过顶部系统切换进入不同模块，或点击下方功能地图快速跳转。
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

  display: flex;
  flex-direction: column;
  gap: 16px;
}

.intro-panel {
  position: relative;
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
  padding: 20px 24px;
  background: linear-gradient(90deg, var(--home-accent-soft), transparent 320px);
}

.intro-panel__title {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.intro-panel__text {
  margin: 0;
  max-width: 720px;
  line-height: 1.75;
  color: var(--el-text-color-regular);
}

.module-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.module-panel {
  background: var(--home-panel-bg);
  border: 1px solid var(--home-panel-border);
  border-radius: 4px;
  box-shadow: var(--home-shadow);
}

.module-panel__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 20px;
  background: var(--home-header-bg);
  border-bottom: 1px solid var(--home-panel-border);
}

.module-panel__name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.module-panel__name::before {
  content: '';
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--home-accent);
}

.module-panel__summary {
  padding-left: 11px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.feature-map {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  padding: 16px 20px 20px;
}

.feature-link {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
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
  gap: 6px;
  min-width: 0;
}

.feature-link__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  transition: color 0.2s;
}

.feature-link:hover .feature-link__title {
  color: var(--home-accent);
}

.feature-link__desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.feature-link__arrow {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  transition:
    color 0.2s,
    transform 0.2s;
}

.feature-link:hover .feature-link__arrow {
  color: var(--home-accent);
  transform: translateX(2px);
}

html.dark .home-page {
  --home-accent-soft: rgba(24, 144, 255, 0.12);
  --home-accent-hover: rgba(24, 144, 255, 0.08);
  --home-shadow: none;
}
</style>
