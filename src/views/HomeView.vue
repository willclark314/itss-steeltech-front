<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { getUser, isAdminUser } from '@/utils/auth'

const router = useRouter()

// ── 当前用户权限 ──
const isAdminUserFlag = isAdminUser(getUser())

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

const systemModules = computed<SystemModule[]>(() => {
  const modules: SystemModule[] = [
    {
      name: '门户',
      summary: '系统入口与基础信息，便于快速了解平台概况。',
      links: [
        { path: '/home', title: '首页', description: '系统概览与功能导航' },
        { path: '/portal/about', title: '关于', description: '了解系统概况与使用说明' },
        { path: '/portal/guide', title: '说明', description: '年休与月休页面的操作说明与使用指南' },
      ],
    },
  ]

  // 仅管理员可见：业务系统
  if (isAdminUserFlag) {
    modules.push({
      name: '业务系统',
      summary: '支撑日常业务协同，管理项目与工程联系单。',
      links: [
        { path: '/business/contact', title: '联系单', description: '联系单录入、查询、附件管理与状态跟踪' },
        { path: '/business/project', title: '项目', description: '项目信息维护、检索及与联系单关联查看' },
        { path: '/business/schedule', title: '工作安排', description: '按年度计划开始与结束时间查看项目日历安排' },
      ],
    })
  }

  modules.push({
    name: '人员系统',
    summary: '钢结构技术科人员信息与休假安排管理。',
    links: isAdminUserFlag
      ? [
          { path: '/personnel/person', title: '人员', description: '人员档案查询、详情编辑及按班组/国籍/宿舍分组' },
          { path: '/personnel/role', title: '角色', description: '角色管理、关联人员与页面访问权限配置' },
          { path: '/personnel/leave', title: '年休', description: '全年休假日历、班组筛选与休假记录查看' },
          { path: '/personnel/monthly-rest', title: '月休', description: '每月周末休息排班，点击方格切换休息日' },
        ]
      : [
          { path: '/personnel/leave', title: '年休', description: '全年休假日历、班组筛选与休假记录查看' },
          { path: '/personnel/monthly-rest', title: '月休', description: '每月周末休息排班，点击方格切换休息日' },
        ],
  })

  // 仅管理员可见：系统设置
  if (isAdminUserFlag) {
    modules.push({
      name: '系统设置',
      summary: '系统级参数与全局配置，对所有用户生效。',
      links: [
        { path: '/system/settings', title: '全局配置', description: '本地工作路径、IP 与盘符等系统级参数维护' },
      ],
    })
  }

  return modules
})

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
