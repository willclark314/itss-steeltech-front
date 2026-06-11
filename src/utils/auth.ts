import type { UserPersonnelProfile } from '@/models/auth'

const TOKEN_KEY = 'itss_token'
const USER_KEY = 'itss_user'

export type LoginType = 'dev' | 'personnel'

export interface User {
  username: string
  name?: string
  password?: string
  personnelId?: string
  employeeNo?: string
  loginType?: LoginType
  profile?: UserPersonnelProfile
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function getUsername(): string {
  const user = getUser()
  if (user?.username) return user.username

  const token = getToken()
  if (token?.startsWith('mock-token-')) {
    return token.slice('mock-token-'.length)
  }

  return ''
}

export function getDisplayName(): string {
  const user = getUser()
  return user?.name || getUsername() || '用户'
}

export function setUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isLoggedIn(): boolean {
  return !!getToken()
}
