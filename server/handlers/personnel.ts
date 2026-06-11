import type { ServerResponse } from 'node:http'
import { getDb } from '../db'
import type { ApiContext } from '../utils'
import { matchRoute, sendError, sendJson } from '../utils'

type PersonnelRow = {
  id: string
  name: string
  employee_no: string
  id_card_no: string
  passport_no: string
  passport_expiry: string
  position: string
  nationality: string
  workshop: string
  team: string
  birth_date: string
  age: number
  gender: string
  ethnicity: string
  native_place: string
  education: string
  home_address: string
  graduation_school: string
  major: string
  indonesia_phone: string
  domestic_phone: string
  dormitory_no: string
  status: string
}

type PersonnelPayload = {
  name?: string
  employeeNo?: string
  idCardNo?: string
  passportNo?: string
  passportExpiry?: string
  position?: string
  nationality?: string
  workshop?: string
  team?: string
  birthDate?: string
  age?: number
  gender?: string
  ethnicity?: string
  nativePlace?: string
  education?: string
  homeAddress?: string
  graduationSchool?: string
  major?: string
  indonesiaPhone?: string
  domesticPhone?: string
  dormitoryNo?: string
  status?: string
}

const DEFAULT_WORKSHOP = '钢结构技术科'

function mapPersonnel(row: PersonnelRow) {
  return {
    id: row.id,
    name: row.name,
    employeeNo: row.employee_no,
    idCardNo: row.id_card_no,
    passportNo: row.passport_no,
    passportExpiry: row.passport_expiry,
    position: row.position,
    nationality: row.nationality,
    workshop: row.workshop,
    team: row.team,
    birthDate: row.birth_date,
    age: row.age,
    gender: row.gender,
    ethnicity: row.ethnicity,
    nativePlace: row.native_place,
    education: row.education,
    homeAddress: row.home_address,
    graduationSchool: row.graduation_school,
    major: row.major,
    indonesiaPhone: row.indonesia_phone,
    domesticPhone: row.domestic_phone,
    dormitoryNo: row.dormitory_no,
    status: row.status,
  }
}

function getPersonnelById(id: string) {
  const db = getDb()
  return db.prepare('SELECT * FROM personnel WHERE id = ?').get(id) as PersonnelRow | undefined
}

function validatePayload(payload: PersonnelPayload) {
  if (!payload.name?.trim()) return '姓名不能为空'
  if (!payload.employeeNo?.trim()) return '工号不能为空'
  if (!payload.team?.trim()) return '班组不能为空'
  if (!payload.nationality?.trim()) return '国籍不能为空'
  if (!payload.status?.trim()) return '状态不能为空'
  return null
}

export async function handlePersonnelList(ctx: ApiContext, res: ServerResponse) {
  const db = getDb()
  const keyword = (ctx.query.get('keyword') || '').trim().toLowerCase()
  const status = ctx.query.get('status') || ''

  const rows = db.prepare('SELECT * FROM personnel ORDER BY team, name').all() as PersonnelRow[]

  const list = rows
    .map(mapPersonnel)
    .filter((item) => {
      const matchStatus = !status || item.status === status
      if (!keyword) return matchStatus

      const searchable = [
        item.id,
        item.name,
        item.employeeNo,
        item.nationality,
        item.team,
        item.position,
        item.domesticPhone,
      ]
        .join(' ')
        .toLowerCase()

      return matchStatus && searchable.includes(keyword)
    })

  sendJson(res, 200, list)
  return true
}

export async function handlePersonnelUpdate(ctx: ApiContext, res: ServerResponse) {
  const params = matchRoute(ctx.pathname, 'personnel/:id')
  if (!params) return false

  const existing = getPersonnelById(params.id)
  if (!existing) {
    sendError(res, 404, '人员不存在')
    return true
  }

  const payload = ctx.body as PersonnelPayload
  const validationError = validatePayload(payload)
  if (validationError) {
    sendError(res, 400, validationError)
    return true
  }

  const db = getDb()
  db.prepare(
    `UPDATE personnel SET
      name = @name,
      employee_no = @employee_no,
      id_card_no = @id_card_no,
      passport_no = @passport_no,
      passport_expiry = @passport_expiry,
      position = @position,
      nationality = @nationality,
      workshop = @workshop,
      team = @team,
      birth_date = @birth_date,
      age = @age,
      gender = @gender,
      ethnicity = @ethnicity,
      native_place = @native_place,
      education = @education,
      home_address = @home_address,
      graduation_school = @graduation_school,
      major = @major,
      indonesia_phone = @indonesia_phone,
      domestic_phone = @domestic_phone,
      dormitory_no = @dormitory_no,
      status = @status,
      updated_at = datetime('now', 'localtime')
    WHERE id = @id`,
  ).run({
    id: params.id,
    name: payload.name!.trim(),
    employee_no: payload.employeeNo!.trim(),
    id_card_no: payload.idCardNo ?? '',
    passport_no: payload.passportNo ?? '',
    passport_expiry: payload.passportExpiry ?? '',
    position: payload.position ?? '',
    nationality: payload.nationality!.trim(),
    workshop: DEFAULT_WORKSHOP,
    team: payload.team!.trim(),
    birth_date: payload.birthDate ?? '',
    age: Number(payload.age) || 0,
    gender: payload.gender ?? '',
    ethnicity: payload.ethnicity ?? '',
    native_place: payload.nativePlace ?? '',
    education: payload.education ?? '',
    home_address: payload.homeAddress ?? '',
    graduation_school: payload.graduationSchool ?? '',
    major: payload.major ?? '',
    indonesia_phone: payload.indonesiaPhone ?? '',
    domestic_phone: payload.domesticPhone ?? '',
    dormitory_no: payload.dormitoryNo ?? '',
    status: payload.status!.trim(),
  })

  const updated = getPersonnelById(params.id)
  sendJson(res, 200, mapPersonnel(updated!))
  return true
}

export async function handlePersonnelDelete(ctx: ApiContext, res: ServerResponse) {
  const params = matchRoute(ctx.pathname, 'personnel/:id')
  if (!params) return false

  const existing = getPersonnelById(params.id)
  if (!existing) {
    sendError(res, 404, '人员不存在')
    return true
  }

  const db = getDb()
  db.prepare('DELETE FROM personnel WHERE id = ?').run(params.id)
  sendJson(res, 200, { id: params.id })
  return true
}
