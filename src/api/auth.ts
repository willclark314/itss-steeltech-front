import { request } from './request'
import type { User } from '@/utils/auth'

export interface LoginData {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export function login(data: LoginData) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export interface ChangePasswordData {
  oldPassword: string
  newPassword: string
}

export function changePassword(data: ChangePasswordData) {
  return request<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function fetchCurrentUser() {
  return request<{ user: User }>('/auth/me')
}
