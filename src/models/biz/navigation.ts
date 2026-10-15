export const BIZ_ROUTES = {
  contact: '/business/contact',
  contactBrowse: '/business/contact-browse',
  changeOrder: '/business/change-order',
  changeOrderBrowse: '/production/change-order-browse',
  projectBrowse: '/business/project-browse',
  project: '/business/project',
  projectModel: '/business/project-model',
  productionContact: '/production/contact',
  productionProjectBrowse: '/production/project-browse',
  productionProjectOverview: '/production/project-browse',
  schedule: '/business/schedule',
  my: '/portal/my',
} as const

function isProductionPath(path = '') {
  return path.startsWith('/production')
}

/** 按当前所在系统解析联系单路径（钢构联系单管理 / 生产计划联系单登记） */
export function resolveContactPath(fromPath = '') {
  return isProductionPath(fromPath) ? BIZ_ROUTES.productionContact : BIZ_ROUTES.contact
}

/**
 * 从项目页跳转联系单：
 * - 生产计划系统 → 联系单登记（生产侧仅挂此页）
 * - 钢构技术系统 → 联系单浏览
 */
export function resolveContactLinkPath(fromPath = '') {
  return isProductionPath(fromPath) ? BIZ_ROUTES.productionContact : BIZ_ROUTES.contactBrowse
}

/** 按当前所在系统解析项目浏览路径（钢构 / 生产计划） */
export function resolveProjectBrowsePath(fromPath = '') {
  return isProductionPath(fromPath)
    ? BIZ_ROUTES.productionProjectBrowse
    : BIZ_ROUTES.projectBrowse
}

/**
 * 从联系单页跳转项目：
 * - 生产计划系统 → 项目概况
 * - 钢构技术系统 → 项目管理
 */
export function resolveProjectLinkFromContact(fromPath = '') {
  return isProductionPath(fromPath) ? BIZ_ROUTES.productionProjectOverview : BIZ_ROUTES.project
}

export function buildProjectRouteQuery(projectNo: string, projectNos: string[] = []) {
  return {
    projectNo,
    projectNos: projectNos.join(','),
  }
}

export function buildContactRouteQuery(contactId: string) {
  return { contactId }
}
