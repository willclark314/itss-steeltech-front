export const BIZ_ROUTES = {
  contact: '/business/contact',
  contactBrowse: '/business/contact-browse',
  projectBrowse: '/business/project-browse',
  project: '/business/project',
  schedule: '/business/schedule',
  my: '/portal/my',
} as const

export function buildProjectRouteQuery(projectNo: string, projectNos: string[] = []) {
  return {
    projectNo,
    projectNos: projectNos.join(','),
  }
}

export function buildContactRouteQuery(contactId: string) {
  return { contactId }
}
