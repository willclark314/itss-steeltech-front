import { PersonnelForm } from '../personnel/PersonnelForm'
import type { PersonnelRecord } from '../personnel/PersonnelForm'

export type DevAccountKey = 'admin' | 'user'

export const DEV_USER_PROFILES: Record<DevAccountKey, PersonnelRecord> = {
  admin: PersonnelForm.sample('DEV001', '陈魏', '设计组', {
    employeeNo: '42609901',
    idCardNo: '50010419880001',
    passportNo: 'ER3990001',
    passportExpiry: '2036-03-24',
    position: '钢结构技术副科长',
    birthDate: '1988-06-12',
    age: 38,
    gender: '男',
    nativePlace: '重庆市渝北区',
    education: '研究生',
    homeAddress: '重庆市九龙坡区钢城大道 18 号',
    graduationSchool: '重庆大学',
    major: '土木工程',
    indonesiaPhone: '081934831390',
    domesticPhone: '13452039901',
    dormitoryNo: 'B3_608',
  }),
  user: PersonnelForm.sample('DEV002', '杜剑龙', '设计组', {
    employeeNo: '42609902',
    idCardNo: '50010419910002',
    passportNo: 'ER3990002',
    passportExpiry: '2035-12-31',
    position: '设计工程师',
    birthDate: '1991-02-15',
    age: 35,
    gender: '男',
    nativePlace: '重庆市',
    education: '研究生',
    homeAddress: '重庆市渝北区示例路 1 号',
    graduationSchool: '西南交通大学',
    major: '土木工程',
    indonesiaPhone: '081934831391',
    domesticPhone: '13800009902',
    dormitoryNo: 'B4_202',
  }),
}

export function getDevUserProfile(account: string) {
  if (account === 'admin' || account === 'user') {
    return DEV_USER_PROFILES[account]
  }
  return null
}
