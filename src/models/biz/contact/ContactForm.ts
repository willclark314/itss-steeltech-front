import { BOARD_CONTACTS } from '../../../data/board'
import type { FormRules, UploadRawFile, UploadUserFile } from 'element-plus'

export type ContactStatus = 'pending' | 'processing' | 'done' | 'cancelled'
export type ContactRelationType = 'primary' | 'supplement' | 'revision' | 'follow_up' | 'cancel'
export type ProjectSourceType = 'own' | 'inherited' | 'added' | 'cancelled'
export type ProjectMode = 'inherit' | 'split' | 'append'
export type CancelScope = 'full' | 'partial'

export interface ContactAttachment {
  id: string
  name: string
  url: string
}

export interface ProjectLink {
  projectNo: string
  sourceType: ProjectSourceType
  sourceContactFormId?: string
}

export interface ContactRecord {
  id: string
  title: string
  projectNos: string[]
  projectLinks?: ProjectLink[]
  receivedDate: string
  urgency: string
  status: ContactStatus
  content: string
  expectReplyDate: string
  parentId?: string
  rootId?: string
  relationType?: ContactRelationType
  sortOrder?: number
  childCount?: number
  cancelScope?: CancelScope
  primaryPdf?: ContactAttachment
  attachments: ContactAttachment[]
  createdAt: string
}

export interface ContactFormData {
  title: string
  projectNos: string[]
  receivedDate: string
  urgency: string
  content: string
  expectReplyDate: string
  attachmentList: UploadUserFile[]
  primaryPdfList: UploadUserFile[]
}

export interface ChildContactFormData {
  title: string
  receivedDate: string
  urgency: string
  content: string
  relationType: ContactRelationType
  projectMode: ProjectMode
  projectNos: string[]
  cancelScope: CancelScope
  cancelledProjectNos: string[]
  primaryPdfList: UploadUserFile[]
}

export interface ContactFilterParams {
  keyword?: string
  status?: string
}

export interface PdfUploadPayload {
  fileName: string
  content: string
}

export class ContactForm {
  static readonly STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    DONE: 'done',
    CANCELLED: 'cancelled',
  } as const

  static readonly RELATION_TYPE_OPTIONS = [
    { label: '补充单', value: 'supplement' as const },
    { label: '变更单', value: 'revision' as const },
    { label: '跟进单', value: 'follow_up' as const },
    { label: '取消单', value: 'cancel' as const },
  ]

  static readonly RELATION_TYPE_MAP: Record<
    ContactRelationType,
    { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary' }
  > = {
    primary: { label: '主单', type: 'success' },
    supplement: { label: '补充单', type: 'primary' },
    revision: { label: '变更单', type: 'warning' },
    follow_up: { label: '跟进单', type: 'info' },
    cancel: { label: '取消单', type: 'danger' },
  }

  static readonly PROJECT_SOURCE_MAP: Record<
    ProjectSourceType,
    { label: string; tagType: 'primary' | 'success' | 'warning' | 'info' | 'danger' }
  > = {
    own: { label: '自有', tagType: 'primary' },
    inherited: { label: '继承', tagType: 'info' },
    added: { label: '新增', tagType: 'success' },
    cancelled: { label: '取消', tagType: 'danger' },
  }

  static readonly STATUS_OPTIONS = [
    { label: '全部', value: '' },
    { label: '待处理', value: ContactForm.STATUS.PENDING },
    { label: '处理中', value: ContactForm.STATUS.PROCESSING },
    { label: '已完成', value: ContactForm.STATUS.DONE },
    { label: '已取消', value: ContactForm.STATUS.CANCELLED },
  ]

  static readonly STATUS_MAP: Record<
    ContactStatus,
    { label: string; type: 'warning' | 'primary' | 'success' | 'info' }
  > = {
    pending: { label: '待处理', type: 'warning' },
    processing: { label: '处理中', type: 'primary' },
    done: { label: '已完成', type: 'success' },
    cancelled: { label: '已取消', type: 'info' },
  }

  static readonly URGENCY_OPTIONS = ['普通', '紧急'] as const

  static readonly FORM_RULES: FormRules = {
    title: [{ required: true, message: '请输入联系主题', trigger: 'blur' }],
    receivedDate: [{ required: true, message: '请选择收单日期', trigger: 'change' }],
    content: [{ required: true, message: '请输入联系内容', trigger: 'blur' }],
  }

  static readonly DEFAULT_SAMPLES: ContactRecord[] = BOARD_CONTACTS

  readonly record: ContactRecord

  constructor(record: ContactRecord) {
    this.record = record
  }

  static wrap(record: ContactRecord) {
    return new ContactForm(record)
  }

  get id() {
    return this.record.id
  }

  get title() {
    return this.record.title
  }

  get status() {
    return this.record.status
  }

  get isChildRow() {
    return (this.record.sortOrder ?? 0) > 0
  }

  canEdit() {
    return this.record.status !== ContactForm.STATUS.CANCELLED
  }

  canCancel() {
    return (
      this.record.status === ContactForm.STATUS.PENDING ||
      this.record.status === ContactForm.STATUS.PROCESSING
    )
  }

  cancel() {
    this.record.status = ContactForm.STATUS.CANCELLED
  }

  update(form: ContactFormData, attachmentList: UploadUserFile[]) {
    ContactForm.applyForm(this.record, form, attachmentList)
  }

  static cloneRecord(record: ContactRecord): ContactRecord {
    return {
      ...record,
      projectNos: [...(record.projectNos || [])],
      projectLinks: (record.projectLinks || []).map((item) => ({ ...item })),
      attachments: (record.attachments || []).map((file) => ({ ...file })),
      primaryPdf: record.primaryPdf ? { ...record.primaryPdf } : undefined,
    }
  }

  static cloneSamples(data: ContactRecord[] = ContactForm.DEFAULT_SAMPLES) {
    return data.map((item) => ContactForm.cloneRecord(item))
  }

  static formatDate(date: Date = new Date()) {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  static formatDateTime(date: Date = new Date()) {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mi = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  }

  static toDateOnly(value?: string) {
    if (!value) return ''
    return value.slice(0, 10)
  }

  static createEmptyForm(): ContactFormData {
    return {
      title: '',
      projectNos: [],
      receivedDate: ContactForm.formatDate(),
      urgency: '普通',
      content: '',
      expectReplyDate: '',
      attachmentList: [],
      primaryPdfList: [],
    }
  }

  static createEmptyChildForm(parent?: ContactRecord): ChildContactFormData {
    return {
      title: '',
      receivedDate: ContactForm.formatDate(),
      urgency: parent?.urgency || '普通',
      content: '',
      relationType: 'supplement',
      projectMode: 'inherit',
      projectNos: [...(parent?.projectNos || [])],
      cancelScope: 'partial',
      cancelledProjectNos: [],
      primaryPdfList: [],
    }
  }

  static createFormFromRecord(record: ContactRecord): ContactFormData {
    return {
      title: record.title,
      projectNos: [...(record.projectNos || [])],
      receivedDate: record.receivedDate,
      urgency: record.urgency,
      content: record.content || '',
      expectReplyDate: record.expectReplyDate || '',
      attachmentList: ContactForm.toUploadFileList(record.attachments),
      primaryPdfList: ContactForm.toUploadFileList(record.primaryPdf ? [record.primaryPdf] : []),
    }
  }

  static sortForDisplay(records: ContactRecord[]) {
    return [...records].sort((a, b) => {
      const rootA = a.rootId || a.id
      const rootB = b.rootId || b.id
      if (rootA !== rootB) return rootB.localeCompare(rootA)
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    })
  }

  static filter(records: ContactRecord[], { keyword = '', status = '' }: ContactFilterParams = {}) {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return records.filter((item) => {
      const matchKeyword =
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.projectNos?.some((no) => no.toLowerCase().includes(normalizedKeyword)) ||
        item.receivedDate.toLowerCase().includes(normalizedKeyword)
      const matchStatus = !status || item.status === status
      return matchKeyword && matchStatus
    })
  }

  static generateId(existingCount: number) {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const seq = String(existingCount + 1)
    return `DTP${yy}${mm}${dd}${seq}`
  }

  static applyForm(
    record: ContactRecord,
    form: ContactFormData,
    attachmentList: UploadUserFile[],
  ) {
    record.title = form.title
    record.projectNos = [...form.projectNos]
    record.receivedDate = form.receivedDate
    record.urgency = form.urgency
    record.content = form.content
    record.expectReplyDate = form.expectReplyDate
    record.attachments = ContactForm.normalizeAttachments(attachmentList)
  }

  static isPdfFile(file: UploadUserFile | File) {
    const raw = 'raw' in file ? file.raw : file
    const type = raw instanceof File ? raw.type : undefined
    const name = file.name
    return type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')
  }

  static extractPdfFilesFromDrop(dataTransfer: DataTransfer) {
    return [...dataTransfer.files].filter((file) => ContactForm.isPdfFile(file))
  }

  static async fileToBase64(file: File): Promise<PdfUploadPayload> {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]!)
    }
    return {
      fileName: file.name,
      content: btoa(binary),
    }
  }

  static async filesToUploadPayload(files: File[]): Promise<PdfUploadPayload[]> {
    return Promise.all(files.map((file) => ContactForm.fileToBase64(file)))
  }

  static filesToAttachmentList(files: File[]): UploadUserFile[] {
    return files.map((file, index) => {
      const uid = Date.now() + index
      const raw = Object.assign(file, { uid }) as UploadRawFile
      return {
        uid,
        name: file.name,
        raw,
        url: URL.createObjectURL(file),
        status: 'success',
      }
    })
  }

  static toUploadFileList(attachments: ContactAttachment[] = []): UploadUserFile[] {
    return attachments.map((item, index) => ({
      uid: index,
      name: item.name,
      url: item.url,
      status: 'success',
    }))
  }

  static normalizeAttachments(fileList: UploadUserFile[]): ContactAttachment[] {
    return fileList.map((file) => ({
      id: String(file.uid),
      name: file.name,
      url: file.url || (file.raw ? URL.createObjectURL(file.raw) : ''),
    }))
  }

  static async uploadFilesFromList(fileList: UploadUserFile[]): Promise<PdfUploadPayload[]> {
    const files = fileList
      .map((item) => item.raw)
      .filter((raw): raw is UploadRawFile => raw instanceof File)
    return ContactForm.filesToUploadPayload(files)
  }

  static matchContactKeyword(record: ContactRecord, keyword: string) {
    const normalizedKeyword = keyword.trim().toLowerCase()
    if (!normalizedKeyword) return true

    return (
      record.id.toLowerCase().includes(normalizedKeyword) ||
      record.title.toLowerCase().includes(normalizedKeyword) ||
      record.projectNos?.some((no) => no.toLowerCase().includes(normalizedKeyword))
    )
  }

  static findByKeyword(records: ContactRecord[], keyword: string) {
    return records.filter((record) => ContactForm.matchContactKeyword(record, keyword))
  }

  static getProjectLinks(record: ContactRecord): ProjectLink[] {
    if (record.projectLinks?.length) return record.projectLinks
    return (record.projectNos || []).map((projectNo) => ({
      projectNo,
      sourceType: 'own',
    }))
  }
}
