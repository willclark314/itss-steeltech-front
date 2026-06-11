import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleAuthChangePassword, handleAuthLogin, handleAuthMe } from './handlers/auth'
import { handleContactList } from './handlers/contacts'
import { handlePersonnelDelete, handlePersonnelList, handlePersonnelUpdate } from './handlers/personnel'
import {
  handlePermissionList,
  handleRoleCreate,
  handleRoleDelete,
  handleRoleList,
  handleRoleUpdate,
} from './handlers/roles'
import {
  handleProjectCheck,
  handleProjectCreate,
  handleProjectList,
  handleProjectUpdate,
} from './handlers/projects'
import { handleSystemConfig, handleSystemPathExists } from './handlers/system'
import { matchRoute, readJsonBody, sendError, type ApiContext } from './utils'

type RouteHandler = (ctx: ApiContext, res: ServerResponse) => Promise<boolean>

const routes: Array<{ method: string; pattern: string; handler: RouteHandler }> = [
  { method: 'POST', pattern: 'auth/login', handler: handleAuthLogin },
  { method: 'GET', pattern: 'auth/me', handler: handleAuthMe },
  { method: 'POST', pattern: 'auth/change-password', handler: handleAuthChangePassword },
  { method: 'GET', pattern: 'personnel', handler: handlePersonnelList },
  { method: 'PUT', pattern: 'personnel/:id', handler: handlePersonnelUpdate },
  { method: 'DELETE', pattern: 'personnel/:id', handler: handlePersonnelDelete },
  { method: 'GET', pattern: 'permissions', handler: handlePermissionList },
  { method: 'GET', pattern: 'roles', handler: handleRoleList },
  { method: 'POST', pattern: 'roles', handler: handleRoleCreate },
  { method: 'PUT', pattern: 'roles/:id', handler: handleRoleUpdate },
  { method: 'DELETE', pattern: 'roles/:id', handler: handleRoleDelete },
  { method: 'GET', pattern: 'projects/check', handler: handleProjectCheck },
  { method: 'GET', pattern: 'projects', handler: handleProjectList },
  { method: 'POST', pattern: 'projects', handler: handleProjectCreate },
  { method: 'PUT', pattern: 'projects/:projectNo', handler: handleProjectUpdate },
  { method: 'GET', pattern: 'contacts', handler: handleContactList },
  { method: 'GET', pattern: 'system/config', handler: handleSystemConfig },
  { method: 'PUT', pattern: 'system/config', handler: handleSystemConfig },
  { method: 'GET', pattern: 'system/path-exists', handler: handleSystemPathExists },
]

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse, rawUrl: string) {
  const url = new URL(rawUrl, 'http://localhost')
  const pathname = url.pathname.replace(/^\/api\/?/, '')
  const method = (req.method || 'GET').toUpperCase()

  let body: unknown = {}
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    try {
      body = await readJsonBody(req)
    } catch {
      sendError(res, 400, '请求体 JSON 格式错误')
      return
    }
  }

  const ctx: ApiContext = {
    method,
    pathname,
    query: url.searchParams,
    body,
    authorization: req.headers.authorization,
  }

  for (const route of routes) {
    if (route.method !== method) continue
    if (!matchRoute(pathname, route.pattern)) continue

    try {
      const handled = await route.handler(ctx, res)
      if (handled) return
    } catch (error) {
      const message = error instanceof Error ? error.message : '服务器内部错误'
      sendError(res, 500, message)
      return
    }
  }

  sendError(res, 404, `未找到接口: ${method} /api/${pathname}`)
}
