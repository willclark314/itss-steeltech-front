<template>
  <el-card shadow="never" class="guide-card">
    <template #header>
      <span>说明</span>
    </template>

    <p class="guide-intro">
      按<strong>系统</strong>与<strong>页面</strong>两级查阅各功能的使用方法。左侧选择系统与页面，右侧查看对应说明。
    </p>

    <div class="guide-layout">
      <aside class="guide-nav">
        <el-menu
          :default-active="activePageKey"
          class="guide-menu"
          @select="handlePageSelect"
        >
          <el-sub-menu
            v-for="system in guideSystems"
            :key="system.key"
            :index="system.key"
          >
            <template #title>
              <span>{{ system.name }}</span>
            </template>
            <el-menu-item
              v-for="page in system.pages"
              :key="page.key"
              :index="page.key"
            >
              {{ page.title }}
            </el-menu-item>
          </el-sub-menu>
        </el-menu>
      </aside>

      <main class="guide-content">
        <div v-if="activePage" class="guide-content-header">
          <div class="guide-breadcrumb">
            <span class="breadcrumb-system">{{ activeSystem?.name }}</span>
            <el-icon class="breadcrumb-sep"><ArrowRight /></el-icon>
            <span class="breadcrumb-page">{{ activePage.title }}</span>
          </div>
          <p v-if="activePage.summary" class="guide-page-summary">
            {{ activePage.summary }}
          </p>
        </div>

        <!-- 人员系统 · 年休 -->
        <template v-if="activePageKey === 'personnel-leave'">
          <section class="guide-section">
            <h3 class="section-title">页面用途</h3>
            <p>
              年休页面以全年日历（4×3 网格，12 个月）展示人员的休假安排。系统根据每人「工作天数 → 休假天数」的周期策略自动推算计划年休，也可手工新建或调整请假记录。
            </p>
          </section>

          <section class="guide-section">
            <h3 class="section-title">基本操作</h3>
            <ul class="guide-list">
              <li>使用顶部 <strong>← →</strong> 按钮切换查看年份。</li>
              <li>鼠标悬停在有休假的日期格上，可查看休假人员、类型与日期范围。</li>
              <li>当天日期以<strong>蓝色加粗</strong>数字标记。</li>
            </ul>
          </section>

          <section class="guide-section">
            <h3 class="section-title">日历标记说明</h3>
            <el-descriptions :column="1" border label-width="140px">
              <el-descriptions-item label="绿色勾标">
                已保存的年休（计划轮休）记录
              </el-descriptions-item>
              <el-descriptions-item label="橙色勾标">
                已保存的请假、延长休假或提前休假记录
              </el-descriptions-item>
              <el-descriptions-item label="彩色背景">
                休假日期；管理员视图下不同人员以不同颜色区分，多人同日显示渐变色
              </el-descriptions-item>
            </el-descriptions>
          </section>

          <section class="guide-section">
            <h3 class="section-title">休假类型</h3>
            <el-descriptions :column="1" border label-width="140px">
              <el-descriptions-item label="年休">按周期自动推算的计划轮休</el-descriptions-item>
              <el-descriptions-item label="请假">手工申请的特殊休假</el-descriptions-item>
              <el-descriptions-item label="延长休假">在计划年休基础上延长</el-descriptions-item>
              <el-descriptions-item label="提前休假">未满工作天数即申请休假</el-descriptions-item>
            </el-descriptions>
          </section>

          <section class="guide-section">
            <h3 class="section-title">普通员工操作</h3>
            <ul class="guide-list">
              <li>页面仅显示<strong>本人</strong>的休假日历。</li>
              <li>点击工具栏<strong>新建请假</strong>，填写起止日期后提交请假申请。</li>
              <li>点击工具栏<strong>休假策略</strong>，可设置工作天数（如 135 或 150）和每次休假天数（默认 19 天，含园区出发与到达）。保存实际休假后，系统会自动调整周期。</li>
              <li>点击日历上有休假的日期格，可查看或修改休假记录；右键可删除已保存记录。</li>
              <li>系统推算但尚未保存的休假段，点击后选择「修改并保存」即可落库。</li>
            </ul>
          </section>

          <section class="guide-section">
            <h3 class="section-title">管理员操作</h3>
            <ul class="guide-list">
              <li>工具栏按<strong>设计组 / 细化组</strong>分组，可展开成员列表，点击人员姓名切换显示或隐藏其休假。</li>
              <li>鼠标悬停人员姓名，日历中该人员所有休假日期会高亮显示。</li>
              <li>在人员姓名上<strong>右键</strong>，可「仅显示」该人、新建请假、编辑休假策略，或一键全部显示/关闭。</li>
              <li>点击月份标题可<strong>锁定筛选</strong>该月，再次点击取消；悬停月份标题可临时高亮该月休假。</li>
              <li>点击日历日期格可编辑休假；多人同日休假时弹出选择列表。</li>
            </ul>
          </section>
        </template>

        <!-- 人员系统 · 月休 -->
        <template v-else-if="activePageKey === 'personnel-monthly-rest'">
          <section class="guide-section">
            <h3 class="section-title">页面用途</h3>
            <p>
              月休页面用于安排每人每月的<strong>周末休息日</strong>。每位员工在周六、周日中选择休息日期，同一周内只能选周六或周日其一。系统会提示各班组周末是否有人值班。
            </p>
          </section>

          <section class="guide-section">
            <h3 class="section-title">基本操作</h3>
            <ul class="guide-list">
              <li>使用顶部 <strong>← →</strong> 按钮切换查看月份。</li>
              <li>在表格中<strong>点击周末方格</strong>（周六或周日列）切换是否为休息日，仅周末日期可选。</li>
              <li>同一周内若已选周六，再选周日会自动取消周六（反之亦然）。</li>
              <li>首次进入某月、尚无保存记录时，系统默认为<strong>全部周日休息</strong>。</li>
              <li>表格右侧「休息天数」列显示当月已选休息日的总数。</li>
            </ul>
          </section>

          <section class="guide-section">
            <h3 class="section-title">颜色含义</h3>
            <el-descriptions :column="1" border label-width="140px">
              <el-descriptions-item label="绿色">
                休息日，尚未保存到数据库（含默认周日、本地修改未保存）
              </el-descriptions-item>
              <el-descriptions-item label="蓝色">
                员工已保存，当月尚未定稿
              </el-descriptions-item>
              <el-descriptions-item label="紫色">
                已定稿（管理员保存计划后），员工不可再修改
              </el-descriptions-item>
            </el-descriptions>
          </section>

          <section class="guide-section">
            <h3 class="section-title">普通员工操作</h3>
            <ul class="guide-list">
              <li>只能编辑<strong>本人</strong>所在行的周末方格。</li>
              <li>调整完毕后，点击本人行末的<strong>保存</strong>按钮提交当月月休计划。</li>
              <li>当月计划被管理员定稿后，本人行变为只读，无法再修改。</li>
            </ul>
          </section>

          <section class="guide-section">
            <h3 class="section-title">管理员操作</h3>
            <ul class="guide-list">
              <li>可通过班组标签筛选显示设计组或细化组人员。</li>
              <li>可查看所有人员的月休安排；定稿后仍可继续调整并重新定稿。</li>
              <li>点击<strong>导出 Excel</strong> 下载当月月休计划表。</li>
              <li>确认全员安排无误后，点击<strong>保存计划</strong>定稿锁定当月计划，定稿后普通员工不可再修改。</li>
              <li>若某班组在某个周末全员休息，页面顶部会显示<strong>值班警告</strong>，请安排至少一人值班。</li>
            </ul>
          </section>
        </template>

        <div v-if="activePage" class="guide-footer">
          <span>前往</span>
          <span class="footer-path">{{ activeSystem?.name }} · {{ activePage.title }}</span>
          <el-link type="primary" @click="goTo(activePage.path)">打开页面</el-link>
        </div>
      </main>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

interface GuidePage {
  key: string
  title: string
  path: string
  summary: string
}

interface GuideSystem {
  key: string
  name: string
  pages: GuidePage[]
}

const guideSystems: GuideSystem[] = [
  {
    key: 'personnel',
    name: '人员系统',
    pages: [
      {
        key: 'personnel-leave',
        title: '年休',
        path: '/personnel/leave',
        summary: '管理回国轮休与请假安排，以全年日历查看和编辑休假记录。',
      },
      {
        key: 'personnel-monthly-rest',
        title: '月休',
        path: '/personnel/monthly-rest',
        summary: '安排每月周末休息与值班，点击方格切换休息日。',
      },
    ],
  },
]

const router = useRouter()
const activePageKey = ref(guideSystems[0]?.pages[0]?.key ?? '')

const activePage = computed(() => {
  for (const system of guideSystems) {
    const page = system.pages.find((item) => item.key === activePageKey.value)
    if (page) return page
  }
  return null
})

const activeSystem = computed(() => {
  return guideSystems.find((system) =>
    system.pages.some((page) => page.key === activePageKey.value),
  ) ?? null
})

function handlePageSelect(pageKey: string) {
  activePageKey.value = pageKey
}

function goTo(path: string) {
  void router.push(path)
}
</script>

<style scoped>
.guide-card {
  max-width: 100%;
}

.guide-intro {
  margin: 0 0 16px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.guide-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.guide-nav {
  flex: 0 0 200px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-fill-color-blank);
}

.guide-menu {
  border-right: none;
}

.guide-menu :deep(.el-sub-menu__title) {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.guide-content {
  flex: 1;
  min-width: 0;
}

.guide-content-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.guide-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 13px;
}

.breadcrumb-system {
  color: var(--el-text-color-secondary);
}

.breadcrumb-sep {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.breadcrumb-page {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.guide-page-summary {
  margin: 0;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.guide-section {
  margin-bottom: 24px;
}

.section-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.guide-section p {
  margin: 0;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.guide-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.guide-footer {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 14px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.footer-path {
  color: var(--el-text-color-regular);
}
</style>
