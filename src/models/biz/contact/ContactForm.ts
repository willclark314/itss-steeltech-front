import type { FormRules, UploadRawFile, UploadUserFile } from 'element-plus'
import { checkContactPdfMd5 } from '@/api/contacts'
import { computeFileMd5 } from '@/utils/md5'
import type { TagRecord } from '@/models/biz/tag'

export type ContactStatus = 'pending' | 'processing' | 'done' | 'cancelled'
export type ContactRelationType = 'primary' | 'supplement' | 'revision' | 'follow_up' | 'cancel'
export type ProjectSourceType = 'own' | 'inherited' | 'added' | 'cancelled'
export type ProjectMode = 'inherit' | 'split' | 'append'
export type CancelScope = 'full' | 'partial'
export type ContactFormType = 'contact' | 'processing'

export interface ContactAttachment {
  id: string
  name: string
  url: string
  createdAt?: string
  version?: number
  isCurrent?: boolean
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
  tags: TagRecord[]
  receivedDate: string
  familyMaxReceivedDate?: string
  urgency: string
  status: ContactStatus
  content: string
  parentId?: string
  rootId?: string
  relationType?: ContactRelationType
  sortOrder?: number
  childCount?: number
  cancelScope?: CancelScope
  primaryPdf?: ContactAttachment
  primaryPdfVersions?: ContactAttachment[]
  attachments: ContactAttachment[]
  createdAt: string
}

export interface ContactFormData {
  id?: string
  contactType: ContactFormType
  title: string
  projectNos: string[]
  tagIds: string[]
  receivedDate: string
  urgency: string
  content: string
  attachmentList: UploadUserFile[]
  primaryPdfList: UploadUserFile[]
  primaryPdfVersions?: ContactAttachment[]
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
  tags?: string[]
}

export type ContactGroupBy = '' | 'status' | 'urgency'

export interface ContactRecordGroup {
  key: string
  label: string
  members: ContactRecord[]
}

export interface PdfUploadPayload {
  fileName: string
  content?: string
  md5?: string
}

export class ContactForm {
  static readonly JIAGONGDAN_PREFIX = '加工单-'
  static readonly JIAGONGDAN_DEFAULT_ID = '加工单'
  static readonly JIAGONGDAN_ID_REGEX = /^BRD\d{6}C\d{9}$/i
  static readonly FORM_TYPE_OPTIONS = [
    { label: '联系单', value: 'contact' as const },
    { label: '加工单', value: 'processing' as const },
  ]

  static isProcessingFormId(id: string): boolean {
    const normalized = (id || '').trim()
    return (
      normalized === ContactForm.JIAGONGDAN_DEFAULT_ID ||
      normalized.startsWith(ContactForm.JIAGONGDAN_PREFIX) ||
      ContactForm.JIAGONGDAN_ID_REGEX.test(normalized)
    )
  }

  static parseBaseProjectNo(projectNo: string): string {
    const normalized = (projectNo || '').trim()
    const sepIndex = normalized.search(/[~#]/)
    if (sepIndex === -1) return normalized
    return normalized.slice(0, sepIndex)
  }

  static formatDisplayId(id: string, projectNo?: string): string {
    if (ContactForm.isProcessingFormId(id)) {
      const normalizedProjectNo = ContactForm.parseBaseProjectNo(projectNo || '')
      return normalizedProjectNo ? `加工单(${normalizedProjectNo})` : '加工单'
    }
    return id
  }

  static maxProjectNoForSort(projectNos?: string[]): string {
    const nos = (projectNos || []).filter((no) => no.trim())
    if (!nos.length) return ''
    return nos.reduce((max, no) => (no.localeCompare(max, 'zh-CN') > 0 ? no : max), nos[0])
  }

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

  static readonly GROUP_BY_OPTIONS = [
    { label: '列表', value: '' as ContactGroupBy },
    { label: '按状态', value: 'status' as ContactGroupBy },
    { label: '按紧急程度', value: 'urgency' as ContactGroupBy },
  ] as const

  static readonly FORM_RULES: FormRules = {
    title: [{ required: true, message: '请输入联系主题', trigger: 'blur' }],
    receivedDate: [{ required: true, message: '请选择收单日期', trigger: 'change' }],
  }

  static readonly EDIT_FORM_RULES: FormRules = {
    id: [{ required: true, message: '请输入联系单号', trigger: 'blur' }],
    title: [{ required: true, message: '请输入联系主题', trigger: 'blur' }],
    receivedDate: [{ required: true, message: '请选择收单日期', trigger: 'change' }],
  }

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
      tags: (record.tags || []).map((item) => ({ ...item })),
      attachments: (record.attachments || []).map((file) => ({ ...file })),
      primaryPdf: record.primaryPdf ? { ...record.primaryPdf } : undefined,
      primaryPdfVersions: (record.primaryPdfVersions || []).map((file) => ({ ...file })),
    }
  }

  static cloneSamples(data: ContactRecord[]) {
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
      id: '',
      contactType: 'contact',
      title: '',
      projectNos: [],
      tagIds: [],
      receivedDate: ContactForm.formatDate(),
      urgency: '普通',
      content: '',
      attachmentList: [],
      primaryPdfList: [],
      primaryPdfVersions: [],
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
      id: ContactForm.isProcessingFormId(record.id) ? ContactForm.JIAGONGDAN_DEFAULT_ID : record.id,
      contactType: ContactForm.isProcessingFormId(record.id) ? 'processing' : 'contact',
      title: record.title,
      projectNos: [...(record.projectNos || [])],
      tagIds: (record.tags || []).map((item) => item.id),
      receivedDate: record.receivedDate,
      urgency: record.urgency,
      content: record.content || '',
      attachmentList: ContactForm.toUploadFileList(record.attachments),
      primaryPdfList: ContactForm.toUploadFileList(record.primaryPdf ? [record.primaryPdf] : []),
      primaryPdfVersions: [...(record.primaryPdfVersions || [])],
    }
  }

  static sortForDisplay(records: ContactRecord[]) {
    const familySortDate = (record: ContactRecord) =>
      ContactForm.toDateOnly(record.familyMaxReceivedDate || record.receivedDate)

    const rootDateMap = new Map<string, string>()
    for (const record of records) {
      const rootId = record.rootId || record.id
      const recordDate = familySortDate(record)
      const prevDate = rootDateMap.get(rootId)
      if (!prevDate || recordDate > prevDate) {
        rootDateMap.set(rootId, recordDate)
      }
    }

    return [...records].sort((a, b) => {
      const rootA = a.rootId || a.id
      const rootB = b.rootId || b.id
      const dateA = rootDateMap.get(rootA) ?? familySortDate(a)
      const dateB = rootDateMap.get(rootB) ?? familySortDate(b)
      if (dateA !== dateB) return dateB.localeCompare(dateA)

      const projectNoA = ContactForm.maxProjectNoForSort(a.projectNos)
      const projectNoB = ContactForm.maxProjectNoForSort(b.projectNos)
      if (projectNoA !== projectNoB) return projectNoB.localeCompare(projectNoA, 'zh-CN')

      if (rootA !== rootB) return rootA.localeCompare(rootB)
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    })
  }

  static groupRecords(
    records: ContactRecord[],
    groupBy: ContactGroupBy,
  ): ContactRecordGroup[] {
    if (!groupBy) return []

    if (groupBy === 'status') {
      const statusOrder = ContactForm.STATUS_OPTIONS.filter((item) => item.value).map(
        (item) => item.value,
      )
      return ContactForm.groupByField(
        records,
        (record) => record.status,
        statusOrder,
        (key) => ContactForm.STATUS_MAP[key as ContactStatus]?.label ?? key,
      )
    }

    return ContactForm.groupByField(
      records,
      (record) => record.urgency || '普通',
      [...ContactForm.URGENCY_OPTIONS],
    )
  }

  private static groupByField(
    records: ContactRecord[],
    getKey: (record: ContactRecord) => string,
    orderedKeys: readonly string[],
    getLabel?: (key: string) => string,
  ): ContactRecordGroup[] {
    const groups = new Map<string, ContactRecord[]>()

    for (const record of records) {
      const key = getKey(record)
      const members = groups.get(key) ?? []
      members.push(record)
      groups.set(key, members)
    }

    const extraKeys = [...groups.keys()].filter((key) => !orderedKeys.includes(key))
    const keySequence = [...orderedKeys, ...extraKeys]

    return keySequence
      .map((key) => ({
        key,
        label: getLabel?.(key) ?? key,
        members: ContactForm.sortForDisplay(groups.get(key) ?? []),
      }))
      .filter((group) => group.members.length > 0)
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

  static async fileToUploadPayload(file: File): Promise<PdfUploadPayload> {
    const md5 = await computeFileMd5(file)
    const check = await checkContactPdfMd5(md5)
    if (check.exists) {
      return {
        fileName: file.name,
        md5,
      }
    }

    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]!)
    }
    return {
      fileName: file.name,
      content: btoa(binary),
      md5,
    }
  }

  static async filesToUploadPayload(files: File[]): Promise<PdfUploadPayload[]> {
    return Promise.all(files.map((file) => ContactForm.fileToUploadPayload(file)))
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

  static hasNewPrimaryUpload(fileList: UploadUserFile[]) {
    return fileList.some((item) => item.raw instanceof File)
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
