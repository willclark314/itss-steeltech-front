export type AppSystemId =
  | 'portal'
  | 'business'
  | 'production'
  | 'personnel'
  | 'system'
  | 'development'

export interface AppPageDefinition {
  pageKey: string
  pageName: string
  module: string
  systemId: AppSystemId
  path: string
  icon: string
  description?: string
}

export interface AppSystemDefinition {
  id: AppSystemId
  name: string
}

/** 与后端 permission_catalog 保持一致的页面导航定义 */
export const APP_SYSTEMS: AppSystemDefinition[] = [
  { id: 'portal', name: '门户' },
  { id: 'business', name: '钢构技术系统' },
  { id: 'production', name: '生产计划系统' },
  { id: 'personnel', name: '人员系统' },
  { id: 'system', name: '系统设置' },
]

export const APP_PAGES: AppPageDefinition[] = [
  {
    pageKey: 'home',
    pageName: '首页',
    module: '门户',
    systemId: 'portal',
    path: '/home',
    icon: 'House',
    description: '系统概览与功能导航',
  },
  {
    pageKey: 'my',
    pageName: '我的',
    module: '门户',
    systemId: 'portal',
    path: '/portal/my',
    icon: 'User',
    description: '查看分配给自己的项目及关联联系单',
  },
  {
    pageKey: 'about',
    pageName: '关于',
    module: '门户',
    systemId: 'portal',
    path: '/portal/about',
    icon: 'InfoFilled',
    description: '了解系统概况与使用说明',
  },
  {
    pageKey: 'guide',
    pageName: '说明',
    module: '门户',
    systemId: 'portal',
    path: '/portal/guide',
    icon: 'QuestionFilled',
    description: '年休与月休页面的操作说明与使用指南',
  },
  {
    pageKey: 'contact-browse',
    pageName: '联系单',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/contact-browse',
    icon: 'Message',
    description: '查询工程联系单，按状态或紧急程度分组查看',
  },
  {
    pageKey: 'contact',
    pageName: '联系单管理',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/contact',
    icon: 'EditPen',
    description: '联系单录入、查询、附件管理与状态跟踪',
  },
  {
    pageKey: 'change-order',
    pageName: '变更单管理',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/change-order',
    icon: 'DocumentChecked',
    description: '变更单录入、查询、PDF 附件上传与项目关联',
  },
  {
    pageKey: 'project-browse',
    pageName: '项目',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/project-browse',
    icon: 'Briefcase',
    description: '查询项目信息',
  },
  {
    pageKey: 'project',
    pageName: '项目管理',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/project',
    icon: 'Folder',
    description: '项目信息维护、检索及与联系单关联查看',
  },
  {
    pageKey: 'project-model',
    pageName: '项目模型管理',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/project-model',
    icon: 'Box',
    description: '管理细化项目与甲供模型，一个项目可关联多个模型',
  },
  {
    pageKey: 'schedule',
    pageName: '工作安排',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/schedule',
    icon: 'Calendar',
    description: '按年度计划开始与结束时间查看项目日历安排',
  },
  {
    pageKey: 'design-team-schedule',
    pageName: '设计组排班',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/design-team-schedule',
    icon: 'Grid',
    description: '查看未完成设计项目，管理设计组人员项目分配',
  },
  {
    pageKey: 'design-drawing-issue-plan',
    pageName: '设计发图计划',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/design-drawing-issue-plan',
    icon: 'Document',
    description: '按月维护设计/排瓦/排楼承板图纸发出计划与实际时间',
  },
  {
    pageKey: 'detail-team-schedule',
    pageName: '细化组排班',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/detail-team-schedule',
    icon: 'Grid',
    description: '查看未完成细化项目，管理细化组人员项目分配',
  },
  {
    pageKey: 'drawing-issue-plan',
    pageName: '细化发图计划',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/drawing-issue-plan',
    icon: 'Document',
    description: '按月维护细化/排楼承板图纸发出计划与实际时间（细化仅此页）',
  },
  {
    pageKey: 'weekly-meeting',
    pageName: '周例会',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/weekly-meeting',
    icon: 'ChatLineSquare',
    description: '填写周例会内容、上传图片附件、导出会议纪要文件',
  },
  {
    pageKey: 'director-interview',
    pageName: '主任座谈会',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/director-interview',
    icon: 'ChatDotRound',
    description: '记录主任与员工的一对一约谈，生成沟通交流记录表',
  },
  {
    pageKey: 'monthly-training',
    pageName: '月度培训',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/monthly-training',
    icon: 'Reading',
    description: '管理月度制度培训记录，上传正文 PDF、培训材料与照片并导出培训记录文件',
  },
  {
    pageKey: 'settlement-record',
    pageName: '项目结算',
    module: '钢构技术系统',
    systemId: 'business',
    path: '/business/settlement-record',
    icon: 'Money',
    description: '按定价依据维护钢结构技术科细化结算与设计结算记录',
  },
  {
    pageKey: 'production-sample',
    pageName: '示例页面',
    module: '生产计划系统',
    systemId: 'production',
    path: '/production/sample',
    icon: 'Document',
    description: '生产计划系统示例页面，用于后续功能扩展占位',
  },
  {
    pageKey: 'change-order-browse',
    pageName: '变更单',
    module: '生产计划系统',
    systemId: 'production',
    path: '/production/change-order-browse',
    icon: 'DocumentChecked',
    description: '计划科查询上传工程变更单',
  },
  {
    pageKey: 'production-contact',
    pageName: '联系单登记',
    module: '生产计划系统',
    systemId: 'production',
    path: '/production/contact',
    icon: 'EditPen',
    description: '计划科联系单登记、查询、附件管理与状态跟踪',
  },
  {
    pageKey: 'production-project-browse',
    pageName: '项目概况',
    module: '生产计划系统',
    systemId: 'production',
    path: '/production/project-browse',
    icon: 'Briefcase',
    description: '计划科维护项目结构形式与预估重量',
  },
  {
    pageKey: 'person',
    pageName: '人员',
    module: '人员系统',
    systemId: 'personnel',
    path: '/personnel/person',
    icon: 'Avatar',
    description: '人员档案查询、详情编辑及按班组/国籍/宿舍分组',
  },
  {
    pageKey: 'role',
    pageName: '角色',
    module: '人员系统',
    systemId: 'personnel',
    path: '/personnel/role',
    icon: 'Key',
    description: '角色管理、关联人员与页面访问权限配置',
  },
  {
    pageKey: 'leave',
    pageName: '年休',
    module: '人员系统',
    systemId: 'personnel',
    path: '/personnel/leave',
    icon: 'Calendar',
    description: '全年休假日历、班组筛选与休假记录查看',
  },
  {
    pageKey: 'monthly-rest',
    pageName: '月休',
    module: '人员系统',
    systemId: 'personnel',
    path: '/personnel/monthly-rest',
    icon: 'Document',
    description: '每月周末休息排班，点击方格切换休息日',
  },
  {
    pageKey: 'system-settings',
    pageName: '全局配置',
    module: '系统设置',
    systemId: 'system',
    path: '/system/settings',
    icon: 'Setting',
    description: '本地工作路径、IP 等系统级参数维护',
  },
  {
    pageKey: 'page-config',
    pageName: '页面配置',
    module: '系统设置',
    systemId: 'system',
    path: '/system/page-config',
    icon: 'Menu',
    description: '调整顶部系统与各系统侧栏页面的显示顺序，以及页面是否展示',
  },
]

export const DEV_APP_PAGES: AppPageDefinition[] = [
  {
    pageKey: 'dev-page1',
    pageName: '浏览器储存',
    module: '开发',
    systemId: 'development',
    path: '/dev/page1',
    icon: 'Document',
  },
  {
    pageKey: 'dev-page3',
    pageName: '开发页面3',
    module: '开发',
    systemId: 'development',
    path: '/dev/page3',
    icon: 'Folder',
  },
  {
    pageKey: 'dev-login',
    pageName: '登录页面',
    module: '开发',
    systemId: 'development',
    path: '/dev/login',
    icon: 'User',
  },
  {
    pageKey: 'dev-error',
    pageName: '错误页面',
    module: '开发',
    systemId: 'development',
    path: '/dev/error',
    icon: 'Warning',
  },
]

export function resolveSystemIdFromPath(path: string): AppSystemId {
  if (path.startsWith('/dev')) return 'development'
  if (path.startsWith('/system')) return 'system'
  if (path.startsWith('/business')) return 'business'
  if (path.startsWith('/production')) return 'production'
  if (path.startsWith('/personnel')) return 'personnel'
  return 'portal'
}

export function findPageByPath(path: string): AppPageDefinition | undefined {
  return [...APP_PAGES, ...DEV_APP_PAGES].find((page) => page.path === path)
}

export function findPageByKey(pageKey: string): AppPageDefinition | undefined {
  return [...APP_PAGES, ...DEV_APP_PAGES].find((page) => page.pageKey === pageKey)
}

export function viewPermissionCode(pageKey: string) {
  return `${pageKey}:view`
}
