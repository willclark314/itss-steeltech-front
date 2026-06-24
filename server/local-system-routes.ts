/** 必须在用户本机执行的系统接口（UNC 路径检测、本机 IP、共享盘列表等） */
export const LOCAL_SYSTEM_API_ROUTES = [
  '/api/system/path-exists',
  '/api/system/host-drives',
  '/api/system/local-ip',
] as const

export function isLocalSystemApiRequest(url: string | undefined, method: string | undefined) {
  if ((method || 'GET').toUpperCase() !== 'GET' || !url) return false
  const pathname = url.split('?')[0]
  return LOCAL_SYSTEM_API_ROUTES.some((route) => pathname === route)
}
