import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { getToken } from '@/utils/auth'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    public?: boolean
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
    meta: { title: '联系单' },
  },
  {
    path: 'business/project',
    name: 'Project',
    component: () => import('@/views/biz/ProjectView.vue'),
    meta: { title: '项目' },
  },
  {
    path: 'business/schedule',
    name: 'ProjectSchedule',
    component: () => import('@/views/biz/ScheduleView.vue'),
    meta: { title: '工作安排' },
  },
  {
    path: 'personnel/person',
    name: 'Personnel',
    component: () => import('@/views/personnel/PersonnelView.vue'),
    meta: { title: '人员' },
  },
  {
    path: 'personnel/leave',
    name: 'PersonnelLeave',
    component: () => import('@/views/personnel/LeaveView.vue'),
    meta: { title: '休假' },
  },
  {
    path: 'personnel/role',
    name: 'PersonnelRole',
    component: () => import('@/views/personnel/RoleView.vue'),
    meta: { title: '角色' },
  },
]

if (isDev) {
  mainChildren.push(
    {
      path: 'dev/page1',
      name: 'DevPage1',
      component: () => import('@/views/dev/ExplorerData.vue'),
      meta: { title: '浏览器储存' },
    },
    {
      path: 'dev/page2',
      name: 'DevPage2',
      component: () => import('@/views/dev/DevPage2View.vue'),
      meta: { title: '全局配置' },
    },
    {
      path: 'dev/page3',
      name: 'DevPage3',
      component: () => import('@/views/dev/DevPage3View.vue'),
      meta: { title: '开发页面3' },
    },
    {
      path: 'dev/login',
      name: 'DevLogin',
      component: () => import('@/views/dev/DevLoginPreview.vue'),
      meta: { title: '登录页面' },
    },
    {
      path: 'dev/error',
      name: 'DevError',
      component: () => import('@/views/dev/DevErrorPreview.vue'),
      meta: { title: '错误页面' },
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
    if (token && to.path === '/login' && !isDev) {
      return '/home'
    }
    return true
  }

  if (!token) {
    return '/login'
  }

  return true
})

export default router
