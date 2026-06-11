export const BIZ_ROUTES = {
  contact: '/business/contact',
  project: '/business/project',
  schedule: '/business/schedule',
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
