import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { getToken, getUser, isAdminUser } from '@/utils/auth'
import { canViewPage } from '@/utils/permission'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    public?: boolean
    /** 页面权限键，对应 {pageKey}:view */
    pageKey?: string
    /** 开发预览页，仅管理员可访问 */
    devOnly?: boolean
  }
}

const isDev = import.meta.env.DEV

const mainChildren: RouteRecordRaw[] = [
  {
    path: 'home',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '首页', pageKey: 'home' },
  },
  {
    path: 'portal/about',
    name: 'About',
    component: () => import('@/views/portal/AboutView.vue'),
    meta: { title: '关于', pageKey: 'about' },
  },
  {
    path: 'portal/guide',
    name: 'PortalGuide',
    component: () => import('@/views/portal/GuideView.vue'),
    meta: { title: '说明', pageKey: 'guide' },
  },
  {
    path: 'portal/contact',
    redirect: '/business/contact-browse',
  },
  {
    path: 'portal/my',
    name: 'MyWorkspace',
    component: () => import('@/views/portal/MyView.vue'),
    meta: { title: '我的', pageKey: 'my' },
  },
  {
    path: 'business/my',
    redirect: '/portal/my',
  },
  {
    path: 'business/contact-browse',
    name: 'ContactBrowse',
    component: () => import('@/views/biz/ContactBrowseView.vue'),
    meta: { title: '联系单', pageKey: 'contact-browse' },
  },
  {
    path: 'business/contact',
    name: 'ContactForm',
    component: () => import('@/views/biz/ContactFormView.vue'),
    meta: { title: '联系单管理', pageKey: 'contact' },
  },
  {
    path: 'business/change-order',
    name: 'ChangeOrder',
    component: () => import('@/views/biz/ChangeOrderView.vue'),
    meta: { title: '变更单管理', pageKey: 'change-order' },
  },
  {
    path: 'business/project-browse',
    name: 'ProjectBrowse',
    component: () => import('@/views/biz/ProjectBrowseView.vue'),
    meta: { title: '项目', pageKey: 'project-browse' },
  },
  {
    path: 'business/project',
    name: 'Project',
    component: () => import('@/views/biz/ProjectView.vue'),
    meta: { title: '项目管理', pageKey: 'project' },
  },
  {
    path: 'business/project-model',
    name: 'ProjectModel',
    component: () => import('@/views/biz/ProjectModelView.vue'),
    meta: { title: '项目模型管理', pageKey: 'project-model' },
  },
  {
    path: 'business/schedule',
    name: 'ProjectSchedule',
    component: () => import('@/views/biz/ScheduleView.vue'),
    meta: { title: '工作安排', pageKey: 'schedule' },
  },
  {
    path: 'business/design-team-schedule',
    name: 'DesignTeamSchedule',
    component: () => import('@/views/biz/DesignTeamScheduleView.vue'),
    meta: { title: '设计组排班', pageKey: 'design-team-schedule' },
  },
  {
    path: 'business/design-drawing-issue-plan',
    name: 'DesignDrawingIssuePlan',
    component: () => import('@/views/biz/DesignDrawingIssuePlanView.vue'),
    meta: { title: '设计发图计划', pageKey: 'design-drawing-issue-plan' },
  },
  {
    path: 'business/detail-team-schedule',
    name: 'DetailTeamSchedule',
    component: () => import('@/views/biz/DetailTeamScheduleView.vue'),
    meta: { title: '细化组排班', pageKey: 'detail-team-schedule' },
  },
  {
    path: 'business/drawing-issue-plan',
    name: 'DrawingIssuePlan',
    component: () => import('@/views/biz/DrawingIssuePlanView.vue'),
    meta: { title: '细化发图计划', pageKey: 'drawing-issue-plan' },
  },
  {
    path: 'business/weekly-meeting',
    name: 'WeeklyMeeting',
    component: () => import('@/views/biz/WeeklyMeetingView.vue'),
    meta: { title: '周例会', pageKey: 'weekly-meeting' },
  },
  {
    path: 'business/director-interview',
    name: 'DirectorInterview',
    component: () => import('@/views/biz/DirectorInterviewView.vue'),
    meta: { title: '主任座谈会', pageKey: 'director-interview' },
  },
  {
    path: 'business/monthly-training',
    name: 'MonthlyTraining',
    component: () => import('@/views/biz/MonthlyTrainingView.vue'),
    meta: { title: '月度培训', pageKey: 'monthly-training' },
  },
  {
    path: 'business/settlement-record',
    name: 'SettlementRecord',
    component: () => import('@/views/biz/SettlementRecordView.vue'),
    meta: { title: '项目结算', pageKey: 'settlement-record' },
  },
  {
    path: 'production/sample',
    name: 'ProductionSample',
    component: () => import('@/views/production/ProductionSampleView.vue'),
    meta: { title: '示例页面', pageKey: 'production-sample' },
  },
  {
    path: 'production/change-order-browse',
    name: 'ChangeOrderBrowse',
    component: () => import('@/views/biz/ChangeOrderBrowseView.vue'),
    meta: { title: '变更单', pageKey: 'change-order-browse' },
  },
  {
    path: 'production/contact',
    name: 'ProductionContactRegister',
    component: () => import('@/views/production/ProductionContactRegisterView.vue'),
    meta: { title: '联系单登记', pageKey: 'production-contact' },
  },
  {
    path: 'production/project-browse',
    name: 'ProductionProjectOverview',
    component: () => import('@/views/production/ProductionProjectOverviewView.vue'),
    meta: { title: '项目概况', pageKey: 'production-project-browse' },
  },
  {
    path: 'personnel/person',
    name: 'Personnel',
    component: () => import('@/views/personnel/PersonnelView.vue'),
    meta: { title: '人员', pageKey: 'person' },
  },
  {
    path: 'personnel/leave',
    name: 'PersonnelLeave',
    component: () => import('@/views/personnel/LeaveView.vue'),
    meta: { title: '年休', pageKey: 'leave' },
  },
  {
    path: 'personnel/monthly-rest',
    name: 'PersonnelMonthlyRest',
    component: () => import('@/views/personnel/MonthlyRestView.vue'),
    meta: { title: '月休', pageKey: 'monthly-rest' },
  },
  {
    path: 'personnel/role',
    name: 'PersonnelRole',
    component: () => import('@/views/personnel/RoleView.vue'),
    meta: { title: '角色', pageKey: 'role' },
  },
  {
    path: 'system/settings',
    name: 'SystemSettings',
    component: () => import('@/views/system/SystemSettingsView.vue'),
    meta: { title: '全局配置', pageKey: 'system-settings' },
  },
  {
    path: 'system/page-config',
    name: 'PageConfig',
    component: () => import('@/views/system/PageConfigView.vue'),
    meta: { title: '页面配置', pageKey: 'page-config' },
  },
]

if (isDev) {
  mainChildren.push(
    {
      path: 'dev/page1',
      name: 'DevPage1',
      component: () => import('@/views/dev/ExplorerData.vue'),
      meta: { title: '浏览器储存', pageKey: 'dev-page1', devOnly: true },
    },
    {
      path: 'dev/page3',
      name: 'DevPage3',
      component: () => import('@/views/dev/DevPage3View.vue'),
      meta: { title: '开发页面3', pageKey: 'dev-page3', devOnly: true },
    },
    {
      path: 'dev/login',
      name: 'DevLogin',
      component: () => import('@/views/dev/DevLoginPreview.vue'),
      meta: { title: '登录页面', pageKey: 'dev-login', devOnly: true },
    },
    {
      path: 'dev/error',
      name: 'DevError',
      component: () => import('@/views/dev/DevErrorPreview.vue'),
      meta: { title: '错误页面', pageKey: 'dev-error', devOnly: true },
    },
  )
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/error',
    name: 'Error',
    component: () => import('@/views/ErrorView.vue'),
    meta: { title: '页面未找到', public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/home',
    children: mainChildren,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/error',
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title} - ITSS Steeltech`
    : 'ITSS Steeltech'

  const token = getToken()

  if (to.meta.public) {
    if (token && to.path === '/login') {
      return '/home'
    }
    return true
  }

  if (!token) {
    if (to.path === '/login') return true
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.meta.devOnly && !isAdminUser(getUser())) {
    return '/home'
  }

  const pageKey = to.meta.pageKey
  if (pageKey && !to.meta.devOnly && !canViewPage(pageKey)) {
    if (to.path === '/home') {
      return true
    }
    return '/home'
  }

  return true
})

export default router
