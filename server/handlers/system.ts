import fs from 'node:fs'
import type { ServerResponse } from 'node:http'
import { BusinessSystemConfig } from '../../src/models/biz/BusinessSystemConfig.ts'
import { getLocalIPv4Addresses, listHostDrives } from '../network-host.ts'
import {
  getLocalWorkPathConfig,
  saveLocalWorkPathConfig,
} from '../system-config-store'
import type { ApiContext } from '../utils'
import { sendError, sendJson } from '../utils'

function normalizeFullPath(path: string) {
  const trimmed = path.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('\\\\')) {
    return trimmed.replace(/\//g, '\\')
  }

  return BusinessSystemConfig.buildFullPath(trimmed, getLocalWorkPathConfig())
}

function parseLocalWorkPathPayload(body: unknown) {
  if (!body || typeof body !== 'object') {
    throw new Error('请求体格式错误')
  }

  const payload = body as {
    localWorkPath?: {
      ip?: unknown
      ips?: unknown
      drive?: unknown
      pathPatterns?: { design?: string; detail?: string }
    }
  }
  const drive = String(payload.localWorkPath?.drive ?? '').trim()

  if (!drive) throw new Error('默认盘符不能为空')
  if (!/^[A-Za-z]$/.test(drive)) throw new Error('盘符为单个字母')

  return saveLocalWorkPathConfig(
    BusinessSystemConfig.normalizeLocalWorkPathConfig({
      ip: String(payload.localWorkPath?.ip ?? ''),
      ips: payload.localWorkPath?.ips,
      drive,
      pathPatterns: payload.localWorkPath?.pathPatterns,
    }),
  )
}

export async function handleSystemConfig(ctx: ApiContext, res: ServerResponse) {
  if (ctx.method === 'PUT') {
    try {
      const localWorkPath = parseLocalWorkPathPayload(ctx.body)
      sendJson(res, 200, { localWorkPath })
      return true
    } catch (error) {
      sendError(res, 400, error instanceof Error ? error.message : '保存系统配置失败')
      return true
    }
  }

  sendJson(res, 200, {
    localWorkPath: getLocalWorkPathConfig(),
  })
  return true
}

export async function handleSystemLocalIp(_ctx: ApiContext, res: ServerResponse) {
  sendJson(res, 200, {
    ips: getLocalIPv4Addresses(),
  })
  return true
}

export async function handleSystemHostDrives(ctx: ApiContext, res: ServerResponse) {
  const ip = (ctx.query.get('ip') || '').trim()
  if (!ip) {
    sendError(res, 400, 'IP 不能为空')
    return true
  }

  try {
    const result = await listHostDrives(ip)
    sendJson(res, 200, result)
    return true
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : '获取驱动列表失败')
    return true
  }
}

export async function handleSystemPathExists(ctx: ApiContext, res: ServerResponse) {
  const path = normalizeFullPath(ctx.query.get('path') || '')
  if (!path) {
    sendError(res, 400, '路径不能为空')
    return true
  }

  let exists = false
  try {
    exists = fs.existsSync(path)
  } catch {
    exists = false
  }

  sendJson(res, 200, { path, exists })
  return true
}
