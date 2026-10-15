import type { User } from '@/utils/auth'
import { getUser } from '@/utils/auth'
import {
  findPageByPath,
  viewPermissionCode,
  type AppPageDefinition,
} from '@/models/navigation/appNavigation'

/** 本地用户信息是否已包含权限列表（旧会话可能只有 token，尚无 permissions 字段） */
export function hasSyncedPermissions(user: User | null = getUser()): boolean {
  if (!user) return false
  return Object.prototype.hasOwnProperty.call(user, 'permissions')
}

export function getUserPermissions(user: User | null = getUser()): string[] {
  return user?.permissions ?? []
}

export function hasPermission(code: string, user: User | null = getUser()): boolean {
  const normalized = (code || '').trim()
  if (!normalized) return false
  return getUserPermissions(user).includes(normalized)
}

export function canViewPage(pageKey: string, user: User | null = getUser()): boolean {
  if (!hasSyncedPermissions(user)) return true
  if (hasPermission(viewPermissionCode(pageKey), user)) return true
  // 月休与年休配套开放：有年休查看权限的员工应能访问月休（与旧版菜单行为一致）
  if (pageKey === 'monthly-rest' && hasPermission('leave:view', user)) return true
  return false
}

export function canEditPage(pageKey: string, user: User | null = getUser()): boolean {
  return canViewPage(pageKey, user)
}

export function canAccessPath(path: string, user: User | null = getUser()): boolean {
  const page = findPageByPath(path)
  if (!page) return true
  return canViewPage(page.pageKey, user)
}

export function filterAccessiblePages(
  pages: AppPageDefinition[],
  user: User | null = getUser(),
): AppPageDefinition[] {
  return pages.filter((page) => canViewPage(page.pageKey, user))
}
