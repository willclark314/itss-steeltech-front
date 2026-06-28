import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { getToken, getUser, isAdminUser } from '@/utils/auth'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    public?: boolean
    /** 仅管理员可访问 */
    adminOnly?: boolean
  }
}

const isDev = import.meta.env.DEV

const mainChildren: RouteRecordRaw[] = [
  {
    path: 'home',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '首页' },
  },
  {
    path: 'portal/about',
    name: 'About',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: '关于' },
  },
  {
    path: 'business/contact',
    name: 'ContactForm',
    component: () => import('@/views/biz/ContactFormView.vue'),
    meta: { title: '联系单', adminOnly: true },
  },
  {
    path: 'business/project',
    name: 'Project',
    component: () => import('@/views/biz/ProjectView.vue'),
    meta: { title: '项目', adminOnly: true },
  },
  {
    path: 'business/schedule',
    name: 'ProjectSchedule',
    component: () => import('@/views/biz/ScheduleView.vue'),
    meta: { title: '工作安排', adminOnly: true },
  },
  {
    path: 'personnel/person',
    name: 'Personnel',
    component: () => import('@/views/personnel/PersonnelView.vue'),
    meta: { title: '人员', adminOnly: true },
  },
  {
    path: 'personnel/leave',
    name: 'PersonnelLeave',
    component: () => import('@/views/personnel/LeaveView.vue'),
    meta: { title: '休假' },
  },
  {
    path: 'personnel/monthly-rest',
    name: 'PersonnelMonthlyRest',
    component: () => import('@/views/personnel/MonthlyRestView.vue'),
    meta: { title: '月休计划' },
  },
  {
    path: 'personnel/role',
    name: 'PersonnelRole',
    component: () => import('@/views/personnel/RoleView.vue'),
    meta: { title: '角色', adminOnly: true },
  },
  {
    path: 'system/settings',
    name: 'SystemSettings',
    component: () => import('@/views/system/SystemSettingsView.vue'),
    meta: { title: '全局配置', adminOnly: true },
  },
]

if (isDev) {
  mainChildren.push(
    {
      path: 'dev/page1',
      name: 'DevPage1',
      component: () => import('@/views/dev/ExplorerData.vue'),
      meta: { title: '浏览器储存', adminOnly: true },
    },
    {
      path: 'dev/page3',
      name: 'DevPage3',
      component: () => import('@/views/dev/DevPage3View.vue'),
      meta: { title: '开发页面3', adminOnly: true },
    },
    {
      path: 'dev/login',
      name: 'DevLogin',
      component: () => import('@/views/dev/DevLoginPreview.vue'),
      meta: { title: '登录页面', adminOnly: true },
    },
    {
      path: 'dev/error',
      name: 'DevError',
      component: () => import('@/views/dev/DevErrorPreview.vue'),
      meta: { title: '错误页面', adminOnly: true },
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

  // 仅管理员可访问的路由
  if (to.meta.adminOnly && !isAdminUser(getUser())) {
    return '/home'
  }

  return true
})

export default router
