import { DB_TABLES } from './tables'

export interface ProjectEntity {
  projectNo: string
  name: string
  customer: string
  status: string
  receivedDate: string
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate: string
  actualEndDate: string
  localWorkPath: string
  createdAt?: string
  updatedAt?: string
}

export type ProjectRow = {
  project_no: string
  name: string
  customer: string
  status: string
  received_date: string
  planned_start_date: string
  planned_end_date: string
  actual_start_date: string
  actual_end_date: string
  local_work_path: string
  created_at?: string
  updated_at?: string
}

export class ProjectEntityModel {
  static readonly TABLE = DB_TABLES.projects

  static fromRow(row: ProjectRow): ProjectEntity {
    return {
      projectNo: row.project_no,
      name: row.name,
      customer: row.customer,
      status: row.status,
      receivedDate: row.received_date ?? '',
      plannedStartDate: row.planned_start_date,
      plannedEndDate: row.planned_end_date,
      actualStartDate: row.actual_start_date,
      actualEndDate: row.actual_end_date,
      localWorkPath: row.local_work_path ?? '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  static toRow(entity: ProjectEntity): ProjectRow {
    return {
      project_no: entity.projectNo,
      name: entity.name,
      customer: entity.customer,
      status: entity.status,
      received_date: entity.receivedDate,
      planned_start_date: entity.plannedStartDate,
      planned_end_date: entity.plannedEndDate,
      actual_start_date: entity.actualStartDate,
      actual_end_date: entity.actualEndDate,
      local_work_path: entity.localWorkPath,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    }
  }
}
