import { DB_TABLES } from './tables'

export interface PersonnelEntity {
  id: string
  name: string
  employeeNo: string
  idCardNo: string
  passportNo: string
  passportExpiry: string
  position: string
  nationality: string
  workshop: string
  team: string
  birthDate: string
  age: number
  gender: string
  ethnicity: string
  nativePlace: string
  education: string
  homeAddress: string
  graduationSchool: string
  major: string
  indonesiaPhone: string
  domesticPhone: string
  dormitoryNo: string
  status: string
  createdAt?: string
  updatedAt?: string
}

export type PersonnelRow = {
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
  created_at?: string
  updated_at?: string
}

export class PersonnelEntityModel {
  static readonly TABLE = DB_TABLES.personnel

  static fromRow(row: PersonnelRow): PersonnelEntity {
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  static toRow(entity: PersonnelEntity): PersonnelRow {
    return {
      id: entity.id,
      name: entity.name,
      employee_no: entity.employeeNo,
      id_card_no: entity.idCardNo,
      passport_no: entity.passportNo,
      passport_expiry: entity.passportExpiry,
      position: entity.position,
      nationality: entity.nationality,
      workshop: entity.workshop,
      team: entity.team,
      birth_date: entity.birthDate,
      age: entity.age,
      gender: entity.gender,
      ethnicity: entity.ethnicity,
      native_place: entity.nativePlace,
      education: entity.education,
      home_address: entity.homeAddress,
      graduation_school: entity.graduationSchool,
      major: entity.major,
      indonesia_phone: entity.indonesiaPhone,
      domestic_phone: entity.domesticPhone,
      dormitory_no: entity.dormitoryNo,
      status: entity.status,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    }
  }
}
