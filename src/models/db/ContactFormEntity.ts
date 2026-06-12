import { DB_TABLES } from './tables'

export interface ContactFormEntity {
  id: string
  title: string
  receivedDate: string
  urgency: string
  status: string
  content: string
  expectReplyDate: string
  parentId?: string
  rootId: string
  relationType: string
  sortOrder: number
  cancelScope?: string
  createdAt: string
  updatedAt?: string
}

export type ContactFormRow = {
  id: string
  title: string
  received_date: string
  urgency: string
  status: string
  content: string
  expect_reply_date: string
  parent_id?: string | null
  root_id: string
  relation_type: string
  sort_order: number
  cancel_scope?: string | null
  created_at: string
  updated_at?: string
}

export class ContactFormEntityModel {
  static readonly TABLE = DB_TABLES.contactForms

  static fromRow(row: ContactFormRow): ContactFormEntity {
    return {
      id: row.id,
      title: row.title,
      receivedDate: row.received_date,
      urgency: row.urgency,
      status: row.status,
      content: row.content,
      expectReplyDate: row.expect_reply_date,
      parentId: row.parent_id || undefined,
      rootId: row.root_id || row.id,
      relationType: row.relation_type || 'primary',
      sortOrder: row.sort_order ?? 0,
      cancelScope: row.cancel_scope || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  static toRow(entity: ContactFormEntity): ContactFormRow {
    return {
      id: entity.id,
      title: entity.title,
      received_date: entity.receivedDate,
      urgency: entity.urgency,
      status: entity.status,
      content: entity.content,
      expect_reply_date: entity.expectReplyDate,
      parent_id: entity.parentId ?? null,
      root_id: entity.rootId,
      relation_type: entity.relationType,
      sort_order: entity.sortOrder,
      cancel_scope: entity.cancelScope ?? null,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    }
  }
}
