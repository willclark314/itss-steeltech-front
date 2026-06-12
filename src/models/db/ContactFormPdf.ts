import { CONTACT_PDF_DIR, DB_TABLES } from './tables'

/**
 * 联系单 PDF 附件（独立业务模型）
 * 与 contact_forms 通过 contact_form_id 关联，一对多
 */
export type AttachmentType = 'primary' | 'supplement'

export interface ContactFormPdfRecord {
  id: string
  contactFormId: string
  fileName: string
  filePath: string
  fileSize: number | null
  mimeType: string
  attachmentType: AttachmentType
  sortOrder: number
  remark?: string
  createdAt: string
}

export type ContactFormPdfRow = {
  id: string
  contact_form_id: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string
  attachment_type: AttachmentType
  sort_order: number
  remark?: string | null
  created_at: string
}

export class ContactFormPdf {
  static readonly TABLE = DB_TABLES.contactFormPdfs
  static readonly MIME_TYPE = 'application/pdf'

  static buildFilePath(contactFormId: string, fileName: string) {
    return `${CONTACT_PDF_DIR}/${contactFormId}/${fileName}`
  }

  static fromRow(row: ContactFormPdfRow): ContactFormPdfRecord {
    return {
      id: row.id,
      contactFormId: row.contact_form_id,
      fileName: row.file_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      attachmentType: row.attachment_type || 'supplement',
      sortOrder: row.sort_order,
      remark: row.remark || undefined,
      createdAt: row.created_at,
    }
  }

  static toRow(record: ContactFormPdfRecord): ContactFormPdfRow {
    return {
      id: record.id,
      contact_form_id: record.contactFormId,
      file_name: record.fileName,
      file_path: record.filePath,
      file_size: record.fileSize,
      mime_type: record.mimeType,
      attachment_type: record.attachmentType,
      sort_order: record.sortOrder,
      remark: record.remark ?? null,
      created_at: record.createdAt,
    }
  }

  static create(params: {
    id: string
    contactFormId: string
    fileName: string
    fileSize?: number | null
    attachmentType?: AttachmentType
    sortOrder?: number
    createdAt?: string
  }): ContactFormPdfRecord {
    return {
      id: params.id,
      contactFormId: params.contactFormId,
      fileName: params.fileName,
      filePath: ContactFormPdf.buildFilePath(params.contactFormId, params.fileName),
      fileSize: params.fileSize ?? null,
      mimeType: ContactFormPdf.MIME_TYPE,
      attachmentType: params.attachmentType ?? 'supplement',
      sortOrder: params.sortOrder ?? 0,
      createdAt: params.createdAt ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
    }
  }

  /** 转为前端联系单附件展示结构 */
  static toAttachmentView(record: ContactFormPdfRecord) {
    return {
      id: record.id,
      name: record.fileName,
      url: record.filePath,
    }
  }
}
