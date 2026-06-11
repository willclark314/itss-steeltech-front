import type { ServerResponse } from 'node:http'
import { getDevUserProfile } from '../../src/models/auth/DevUserAccount.ts'
import { toUserProfile } from '../../src/models/auth/UserProfile.ts'
import { PersonnelEntityModel } from '../../src/models/db/PersonnelEntity.ts'
import { getDb } from '../db'
import type { ApiContext } from '../utils'
import { sendError, sendJson } from '../utils'

export const DEFAULT_LOGIN_PASSWORD = '123456'

const DEV_USERNAMES = new Set(['admin', 'user'])

const DEV_USERS = [
  { username: 'admin', name: '陈魏' },
  { username: 'user', name: '杜剑龙' },
] as const

type AuthSession = {
  account: string
  loginType: 'dev' | 'personnel'
  personnelId?: string
  name?: string
  employeeNo?: string
}

function isDevEnv() {
  return process.env.NODE_ENV !== 'production'
}

function getAccountPassword(account: string) {
  const db = getDb()
  const row = db
    .prepare('SELECT password FROM account_passwords WHERE account = ?')
    .get(account) as { password: string } | undefined

  return row?.password ?? DEFAULT_LOGIN_PASSWORD
}

function setAccountPassword(account: string, password: string) {
  const db = getDb()
  db.prepare(
    `INSERT INTO account_passwords (account, password, updated_at)
     VALUES (?, ?, datetime('now', 'localtime'))
     ON CONFLICT(account) DO UPDATE SET
       password = excluded.password,
       updated_at = excluded.updated_at`,
  ).run(account, password)
}

function findDevUser(account: string) {
  if (!isDevEnv()) return null
  return DEV_USERS.find((item) => item.username === account) ?? null
}

function findPersonnelByEmployeeNo(employeeNo: string) {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM personnel WHERE employee_no = ?')
    .get(employeeNo)

  if (!row) return undefined
  return PersonnelEntityModel.fromRow(row as Parameters<typeof PersonnelEntityModel.fromRow>[0])
}

function findPersonnelById(personnelId: string) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM personnel WHERE id = ?').get(personnelId)

  if (!row) return undefined
  return PersonnelEntityModel.fromRow(row as Parameters<typeof PersonnelEntityModel.fromRow>[0])
}

function parseBearerToken(authorization?: string) {
  if (!authorization) return ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}

function resolveAuthSession(token: string): AuthSession | null {
  if (!token) return null

  if (token.startsWith('mock-token-')) {
    const account = token.slice('mock-token-'.length)
    if (!DEV_USERNAMES.has(account)) return null
    const devUser = findDevUser(account)
    if (!devUser) return null
    const profile = getDevUserProfile(account)
    return {
      account,
      loginType: 'dev',
      name: profile?.name ?? devUser.name,
      employeeNo: profile?.employeeNo,
    }
  }

  if (token.startsWith('personnel-token-')) {
    const personnelId = token.slice('personnel-token-'.length)
    const person = findPersonnelById(personnelId)
    if (!person || person.status !== 'active') return null

    return {
      account: person.employeeNo,
      loginType: 'personnel',
      personnelId: person.id,
      name: person.name,
      employeeNo: person.employeeNo,
    }
  }

  return null
}

function verifyAccountPassword(account: string, password: string) {
  return password === getAccountPassword(account)
}

function buildLoginUser(
  account: string,
  loginType: 'dev' | 'personnel',
  profileSource: Parameters<typeof toUserProfile>[0],
  extras: { personnelId?: string } = {},
) {
  const profile = toUserProfile(profileSource)

  return {
    username: account,
    name: profile.name,
    employeeNo: profile.employeeNo,
    personnelId: extras.personnelId ?? profile.id,
    loginType,
    profile,
  }
}

export async function handleAuthLogin(ctx: ApiContext, res: ServerResponse) {
  const body = ctx.body as { username?: string; password?: string }
  const account = body.username?.trim() ?? ''
  const password = body.password?.trim() ?? ''

  if (!account || !password) {
    sendError(res, 400, '请输入账号和密码')
    return true
  }

  const devUser = findDevUser(account)
  if (devUser) {
    if (!verifyAccountPassword(account, password)) {
      sendError(res, 401, '工号或密码错误')
      return true
    }

    const profile = getDevUserProfile(account)
    if (!profile) {
      sendError(res, 500, '开发账号配置缺失')
      return true
    }

    sendJson(res, 200, {
      token: `mock-token-${devUser.username}`,
      user: buildLoginUser(devUser.username, 'dev', profile),
    })
    return true
  }

  const person = findPersonnelByEmployeeNo(account)
  if (!person) {
    sendError(res, 401, '工号或密码错误')
    return true
  }

  if (!verifyAccountPassword(account, password)) {
    sendError(res, 401, '工号或密码错误')
    return true
  }

  if (person.status !== 'active') {
    sendError(res, 403, '该人员账号不可用')
    return true
  }

  sendJson(res, 200, {
    token: `personnel-token-${person.id}`,
    user: buildLoginUser(person.employeeNo, 'personnel', person, { personnelId: person.id }),
  })
  return true
}

export async function handleAuthMe(ctx: ApiContext, res: ServerResponse) {
  const token = parseBearerToken(ctx.authorization)
  const session = resolveAuthSession(token)

  if (!session) {
    sendError(res, 401, '请先登录')
    return true
  }

  if (session.loginType === 'dev') {
    const profile = getDevUserProfile(session.account)
    if (!profile) {
      sendError(res, 500, '开发账号配置缺失')
      return true
    }

    sendJson(res, 200, {
      user: buildLoginUser(session.account, 'dev', profile),
    })
    return true
  }

  const person = findPersonnelById(session.personnelId ?? '')
  if (!person || person.status !== 'active') {
    sendError(res, 404, '未找到人员信息')
    return true
  }

  sendJson(res, 200, {
    user: buildLoginUser(person.employeeNo, 'personnel', person, { personnelId: person.id }),
  })
  return true
}

export async function handleAuthChangePassword(ctx: ApiContext, res: ServerResponse) {
  const token = parseBearerToken(ctx.authorization)
  const session = resolveAuthSession(token)

  if (!session) {
    sendError(res, 401, '请先登录')
    return true
  }

  const body = ctx.body as { oldPassword?: string; newPassword?: string }
  const oldPassword = body.oldPassword?.trim() ?? ''
  const newPassword = body.newPassword?.trim() ?? ''

  if (!oldPassword || !newPassword) {
    sendError(res, 400, '请输入当前密码和新密码')
    return true
  }

  if (newPassword.length < 6) {
    sendError(res, 400, '新密码长度不能少于 6 位')
    return true
  }

  if (oldPassword === newPassword) {
    sendError(res, 400, '新密码不能与当前密码相同')
    return true
  }

  if (!verifyAccountPassword(session.account, oldPassword)) {
    sendError(res, 400, '当前密码不正确')
    return true
  }

  setAccountPassword(session.account, newPassword)

  sendJson(res, 200, { message: '密码已更新' })
  return true
}
