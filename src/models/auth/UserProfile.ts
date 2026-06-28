import type { PersonnelRecord } from '../personnel'

export interface UserPersonnelProfile {
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
}

export function toUserProfile(record: PersonnelRecord): UserPersonnelProfile {
  return {
    id: record.id,
    name: record.name,
    employeeNo: record.employeeNo,
    idCardNo: record.idCardNo,
    passportNo: record.passportNo,
    passportExpiry: record.passportExpiry,
    position: record.position,
    nationality: record.nationality,
    workshop: record.workshop,
    team: record.team,
    birthDate: record.birthDate,
    age: record.age,
    gender: record.gender,
    ethnicity: record.ethnicity,
    nativePlace: record.nativePlace,
    education: record.education,
    homeAddress: record.homeAddress,
    graduationSchool: record.graduationSchool,
    major: record.major,
    indonesiaPhone: record.indonesiaPhone,
    domesticPhone: record.domesticPhone,
    dormitoryNo: record.dormitoryNo,
    status: record.status,
  }
}
