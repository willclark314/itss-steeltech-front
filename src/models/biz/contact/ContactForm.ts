import type { FormRules, UploadRawFile, UploadUserFile } from 'element-plus'
import { checkContactPdfMd5 } from '@/api/contacts'
import { snapshotFile, withFileReadGuard } from '@/utils/fileUpload'
import { computeFileMd5 } from '@/utils/md5'
import type { TagRecord } from '@/models/biz/tag'

export type ContactRelationType = 'primary' | 'supplement' | 'revision' | 'follow_up' | 'cancel'
export type ProjectSourceType = 'own' | 'inherited' | 'added' | 'cancelled'
export type ProjectMode = 'inherit' | 'split' | 'append'
export type CancelScope = 'full' | 'partial'
export type ContactFormType = 'contact' | 'processing'
export type ContactLinkage = 'independent' | 'append'

export type AttachmentUploadFile = UploadUserFile & {
  attachmentId?: string
}

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
  linkage: ContactLinkage
  parentId: string
  relationType?: ContactRelationType
  attachmentList: UploadUserFile[]
  primaryPdfList: UploadUserFile[]
  primaryPdfVersions?: ContactAttachment[]
}

export interface ChildContactFormData {
  id: string
  contactType: ContactFormType
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
  tags?: string[]
}

export type ContactGroupBy = '' | 'urgency'

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
  static readonly PREV_CONTACT_ID_STORAGE_PREFIX = 'steeltech.prevContactId.'
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

  /** 从项目号或加工单 ID 解析用于记忆上次联系单号的项目根号 */
  static resolveRememberProjectKey(projectNos?: string[], contactId?: string): string {
    for (const projectNo of projectNos || []) {
      const base = ContactForm.parseBaseProjectNo(projectNo)
      if (base) return base
    }
    const normalizedId = (contactId || '').trim()
    if (normalizedId.startsWith(ContactForm.JIAGONGDAN_PREFIX)) {
      return ContactForm.parseBaseProjectNo(
        normalizedId.slice(ContactForm.JIAGONGDAN_PREFIX.length),
      )
    }
    return ''
  }

  static loadRememberedContactId(projectKey: string): string {
    const key = ContactForm.parseBaseProjectNo(projectKey)
    if (!key || typeof localStorage === 'undefined') return ''
    try {
      const value = (localStorage.getItem(`${ContactForm.PREV_CONTACT_ID_STORAGE_PREFIX}${key}`) || '').trim()
      if (!value || ContactForm.isProcessingFormId(value)) return ''
      return value
    } catch {
      return ''
    }
  }

  static saveRememberedContactId(projectKey: string, contactId: string): void {
    const key = ContactForm.parseBaseProjectNo(projectKey)
    const id = (contactId || '').trim()
    if (!key || !id || ContactForm.isProcessingFormId(id) || typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(`${ContactForm.PREV_CONTACT_ID_STORAGE_PREFIX}${key}`, id)
    } catch {
      // ignore quota / private mode
    }
  }

  static formatDisplayId(id: string, projectNo?: string): string {
    if (ContactForm.isProcessingFormId(id)) {
      const normalizedProjectNo = ContactForm.parseBaseProjectNo(projectNo || '')
      return normalizedProjectNo ? `加工单(${normalizedProjectNo})` : '加工单'
    }
    return id
  }

  static formatOptionLabel(record: ContactRecord): string {
    const displayId = ContactForm.formatDisplayId(record.id, record.projectNos?.[0])
    return `${displayId} · ${record.title}`
  }

  static buildProcessingContactId(projectNo: string): string {
    const base = ContactForm.parseBaseProjectNo(projectNo)
    return base ? `${ContactForm.JIAGONGDAN_PREFIX}${base}` : ContactForm.JIAGONGDAN_DEFAULT_ID
  }

  static maxProjectNoForSort(projectNos?: string[]): string {
    const nos = (projectNos || []).filter((no) => no.trim())
    if (!nos.length) return ''
    return nos.reduce((max, no) => (no.localeCompare(max, 'zh-CN') > 0 ? no : max), nos[0])
  }

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

  static readonly URGENCY_OPTIONS = ['普通', '紧急'] as const

  static readonly GROUP_BY_OPTIONS = [
    { label: '列表', value: '' as ContactGroupBy },
    { label: '按紧急程度', value: 'urgency' as ContactGroupBy },
  ] as const

  static readonly FORM_RULES: FormRules = {
    title: [{ required: true, message: '请输入联系主题', trigger: 'blur' }],
    receivedDate: [{ required: true, message: '请选择收单日期', trigger: 'change' }],
  }

  static readonly PROCESSING_FORM_RULES: FormRules = {
    title: [{ required: true, message: '请输入联系主题', trigger: 'blur' }],
    receivedDate: [{ required: true, message: '请选择收单日期', trigger: 'change' }],
    projectNos: [
      {
        type: 'array',
        required: true,
        min: 1,
        message: '加工单须填写项目号',
        trigger: 'change',
      },
    ],
  }

  static readonly EDIT_FORM_RULES: FormRules = {
    id: [{ required: true, message: '请输入联系单号', trigger: 'blur' }],
    title: [{ required: true, message: '请输入联系主题', trigger: 'blur' }],
    receivedDate: [{ required: true, message: '请选择收单日期', trigger: 'change' }],
  }

  static readonly PROCESSING_EDIT_FORM_RULES: FormRules = {
    title: [{ required: true, message: '请输入联系主题', trigger: 'blur' }],
    receivedDate: [{ required: true, message: '请选择收单日期', trigger: 'change' }],
    projectNos: [
      {
        type: 'array',
        required: true,
        min: 1,
        message: '加工单须填写项目号',
        trigger: 'change',
      },
    ],
  }

  static readonly CHILD_FORM_RULES: FormRules = {
    id: [{ required: true, message: '请输入联系单编号', trigger: 'blur' }],
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

  get isChildRow() {
    return (this.record.sortOrder ?? 0) > 0
  }

  canEdit() {
    return true
  }

  canCancel() {
    return true
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
      linkage: 'independent',
      parentId: '',
      attachmentList: [],
      primaryPdfList: [],
      primaryPdfVersions: [],
    }
  }

  static createEmptyChildForm(parent?: ContactRecord): ChildContactFormData {
    return {
      id: '',
      contactType: 'contact',
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
      linkage:
        record.parentId || (record.relationType != null && record.relationType !== 'primary')
          ? 'append'
          : 'independent',
      parentId: record.parentId || '',
      relationType: record.relationType,
      attachmentList: ContactForm.toUploadFileList(record.attachments),
      primaryPdfList: ContactForm.toUploadFileList(record.primaryPdf ? [record.primaryPdf] : []),
      primaryPdfVersions: [...(record.primaryPdfVersions || [])],
    }
  }

  static sortForDisplay(records: ContactRecord[]) {
    // 倒序排序需要体现“最近一次活动”的单据组靠前：
    // 无论追加单类型（补充/变更/跟进/取消），都按同一 rootId 组内最后创建时间作为排序依据。
    const familySortTime = (record: ContactRecord) => (record.createdAt || '').trim()
    const fallbackFamilySortTime = (record: ContactRecord) =>
      ContactForm.toDateOnly(record.familyMaxReceivedDate || record.receivedDate)

    const rootTimeMap = new Map<string, string>()
    for (const record of records) {
      const rootId = record.rootId || record.id
      const recordTime = familySortTime(record) || fallbackFamilySortTime(record)
      const prevTime = rootTimeMap.get(rootId)
      if (!prevTime || recordTime > prevTime) {
        rootTimeMap.set(rootId, recordTime)
      }
    }

    return [...records].sort((a, b) => {
      const rootA = a.rootId || a.id
      const rootB = b.rootId || b.id
      // 同一家族内：主单在前，补充/变更/跟进/取消按 sortOrder 依次排列
      if (rootA === rootB) {
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      }

      const timeA = rootTimeMap.get(rootA) ?? (familySortTime(a) || fallbackFamilySortTime(a))
      const timeB = rootTimeMap.get(rootB) ?? (familySortTime(b) || fallbackFamilySortTime(b))
      if (timeA !== timeB) return timeB.localeCompare(timeA)

      const projectNoA = ContactForm.maxProjectNoForSort(a.projectNos)
      const projectNoB = ContactForm.maxProjectNoForSort(b.projectNos)
      if (projectNoA !== projectNoB) return projectNoB.localeCompare(projectNoA, 'zh-CN')

      return rootA.localeCompare(rootB)
    })
  }

  static groupRecords(
    records: ContactRecord[],
    groupBy: ContactGroupBy,
  ): ContactRecordGroup[] {
    if (!groupBy) return []

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

  static filter(records: ContactRecord[], { keyword = '' }: ContactFilterParams = {}) {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return records.filter((item) => {
      const displayId = ContactForm.formatDisplayId(item.id, item.projectNos?.[0])
      return (
        !normalizedKeyword ||
        item.id.toLowerCase().includes(normalizedKeyword) ||
        displayId.toLowerCase().includes(normalizedKeyword) ||
        item.title.toLowerCase().includes(normalizedKeyword) ||
        item.projectNos?.some((no) => {
          const normalizedNo = no.toLowerCase()
          const baseNo = ContactForm.parseBaseProjectNo(no).toLowerCase()
          return normalizedNo.includes(normalizedKeyword) || baseNo.includes(normalizedKeyword)
        }) ||
        item.receivedDate.toLowerCase().includes(normalizedKeyword)
      )
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

  static extractFilesFromDrop(dataTransfer: DataTransfer) {
    return [...dataTransfer.files]
  }

  static extractPdfFilesFromDrop(dataTransfer: DataTransfer) {
    return ContactForm.extractFilesFromDrop(dataTransfer).filter((file) => ContactForm.isPdfFile(file))
  }

  static async fileToUploadPayload(file: File): Promise<PdfUploadPayload> {
    const readable = await snapshotFile(file)
    return withFileReadGuard(readable.name, async () => {
      const md5 = await computeFileMd5(readable)
      const check = await checkContactPdfMd5(md5)
      if (check.exists) {
        return {
          fileName: readable.name,
          md5,
        }
      }

      const buffer = await readable.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]!)
      }
      return {
        fileName: readable.name,
        content: btoa(binary),
        md5,
      }
    })
  }

  static async filesToUploadPayload(files: File[]): Promise<PdfUploadPayload[]> {
    return Promise.all(files.map((file) => ContactForm.fileToUploadPayload(file)))
  }

  static async filesToAttachmentList(files: File[]): Promise<UploadUserFile[]> {
    return Promise.all(
      files.map(async (file, index) => {
        const uid = Date.now() + index
        const snapped = await snapshotFile(file)
        const raw = Object.assign(snapped, { uid }) as UploadRawFile
        return {
          uid,
          name: snapped.name,
          raw,
          url: URL.createObjectURL(snapped),
          status: 'success' as const,
        }
      }),
    )
  }

  static async snapshotUploadFiles(fileList: UploadUserFile[]): Promise<UploadUserFile[]> {
    return Promise.all(
      fileList.map(async (item) => {
        if (!(item.raw instanceof File)) return item
        const snapped = await snapshotFile(item.raw)
        const raw = Object.assign(snapped, { uid: item.uid }) as UploadRawFile
        return {
          ...item,
          name: snapped.name,
          raw,
          url: item.url || URL.createObjectURL(snapped),
        }
      }),
    )
  }

  static toUploadFileList(attachments: ContactAttachment[] = []): AttachmentUploadFile[] {
    return attachments.map((item, index) => ({
      uid: -(index + 1),
      name: item.name,
      url: item.url,
      status: 'success',
      attachmentId: item.id,
    }))
  }

  static getAttachmentIdFromUploadFile(file: UploadUserFile): string | undefined {
    return (file as AttachmentUploadFile).attachmentId
  }

  static getRemainingAttachmentIds(fileList: UploadUserFile[]): string[] {
    return fileList
      .map((item) => ContactForm.getAttachmentIdFromUploadFile(item))
      .filter((id): id is string => Boolean(id))
  }

  static getRemovedAttachmentIds(
    originalIds: string[],
    remainingIds: string[],
    explicitlyRemovedIds: Iterable<string> = [],
  ): string[] {
    const removedFromDiff = originalIds.filter((id) => !remainingIds.includes(id))
    return [...new Set([...explicitlyRemovedIds, ...removedFromDiff])]
  }

  static getNewAttachmentFiles(fileList: UploadUserFile[]): UploadUserFile[] {
    return fileList.filter((item) => item.raw instanceof File)
  }

  static normalizeAttachments(fileList: UploadUserFile[]): ContactAttachment[] {
    return fileList.map((file) => ({
      id: String(file.uid),
      name: file.name,
      url: file.url || (file.raw ? URL.createObjectURL(file.raw) : ''),
    }))
  }

  static async uploadFilesFromList(fileList: UploadUserFile[]): Promise<PdfUploadPayload[]> {
    const snapshotted = await ContactForm.snapshotUploadFiles(fileList)
    const files = snapshotted
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

    const displayId = ContactForm.formatDisplayId(record.id, record.projectNos?.[0])

    return (
      record.id.toLowerCase().includes(normalizedKeyword) ||
      displayId.toLowerCase().includes(normalizedKeyword) ||
      record.title.toLowerCase().includes(normalizedKeyword) ||
      record.projectNos?.some((no) => {
        const normalizedNo = no.toLowerCase()
        const baseNo = ContactForm.parseBaseProjectNo(no).toLowerCase()
        return normalizedNo.includes(normalizedKeyword) || baseNo.includes(normalizedKeyword)
      })
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
