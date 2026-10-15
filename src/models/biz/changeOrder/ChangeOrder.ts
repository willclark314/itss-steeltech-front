import type { FormRules, UploadRawFile, UploadUserFile } from 'element-plus'
import { checkChangeOrderPdfMd5 } from '@/api/changeOrders'
import { snapshotFile, withFileReadGuard } from '@/utils/fileUpload'
import { computeFileMd5 } from '@/utils/md5'

export interface ChangeOrderAttachment {
  id: string
  name: string
  url: string
  createdAt?: string
  version?: number
  isCurrent?: boolean
}

export interface ChangeOrderRecord {
  id: number
  orderNo: string
  title: string
  projectNos: string[]
  receivedDate: string
  content: string
  /** 当前正文文件列表（可多个） */
  primaryPdfs: ChangeOrderAttachment[]
  /** 兼容：取当前正文列表第一项 */
  primaryPdf?: ChangeOrderAttachment
  /** 全部正文记录（含历史 is_current=0） */
  primaryPdfVersions?: ChangeOrderAttachment[]
  createdAt: string
}

export interface ChangeOrderFormData {
  orderNo: string
  title: string
  projectNos: string[]
  receivedDate: string
  content: string
  /** 正文文件（已有 + 待上传） */
  primaryPdfList: UploadUserFile[]
  primaryPdfVersions?: ChangeOrderAttachment[]
}

export interface PdfUploadPayload {
  fileName: string
  content?: string
  md5?: string
}

export class ChangeOrder {
  static readonly ORDER_NO_RULES = [
    { max: 64, message: '变更单号不能超过 64 个字符', trigger: 'blur' },
  ] as const

  static readonly FORM_RULES: FormRules = {
    orderNo: [...ChangeOrder.ORDER_NO_RULES],
    title: [
      { required: true, message: '请输入变更主题', trigger: 'blur' },
      { max: 256, message: '变更主题不能超过 256 个字符', trigger: 'blur' },
    ],
    receivedDate: [],
    content: [
      { max: 5000, message: '变更内容不能超过 5000 字', trigger: 'blur' },
    ],
  }

  static readonly EDIT_FORM_RULES: FormRules = {
    orderNo: [...ChangeOrder.ORDER_NO_RULES],
    title: [
      { required: true, message: '请输入变更主题', trigger: 'blur' },
      { max: 256, message: '变更主题不能超过 256 个字符', trigger: 'blur' },
    ],
    receivedDate: [],
    content: [
      { max: 5000, message: '变更内容不能超过 5000 字', trigger: 'blur' },
    ],
  }

  static createEmptyForm(): ChangeOrderFormData {
    return {
      orderNo: '',
      title: '',
      projectNos: [],
      receivedDate: '',
      content: '',
      primaryPdfList: [],
      primaryPdfVersions: [],
    }
  }

  static getCurrentPrimaryPdfs(record: ChangeOrderRecord): ChangeOrderAttachment[] {
    if (record.primaryPdfs?.length) return record.primaryPdfs
    return record.primaryPdf ? [record.primaryPdf] : []
  }

  static getHistoricalPrimaryPdfs(record: ChangeOrderRecord): ChangeOrderAttachment[] {
    const versions = record.primaryPdfVersions || []
    return versions.filter((item) => item.isCurrent === false)
  }

  static createFormFromRecord(record: ChangeOrderRecord): ChangeOrderFormData {
    return {
      orderNo: record.orderNo || '',
      title: record.title,
      projectNos: [...record.projectNos],
      receivedDate: record.receivedDate,
      content: record.content,
      primaryPdfList: ChangeOrder.existingAttachmentsToFileList(ChangeOrder.getCurrentPrimaryPdfs(record)),
      primaryPdfVersions: ChangeOrder.getHistoricalPrimaryPdfs(record),
    }
  }

  static existingAttachmentsToFileList(attachments: ChangeOrderAttachment[]): UploadUserFile[] {
    return attachments.map((file, index) => ({
      uid: Date.now() + index,
      name: file.name,
      url: file.url,
      status: 'success' as const,
      attachmentId: file.id,
    } as UploadUserFile))
  }

  static toDateOnly(dateStr?: string | null): string {
    if (!dateStr) return ''
    const match = dateStr.match(/^\d{4}-\d{2}-\d{2}/)
    return match ? match[0] : dateStr.slice(0, 10)
  }

  static isPdfFile(file: { name?: string; raw?: UploadRawFile }): boolean {
    const name = (file.name || (file.raw && file.raw.name) || '').toLowerCase()
    return name.endsWith('.pdf')
  }

  static getNewPrimaryFiles(fileList: UploadUserFile[]): UploadUserFile[] {
    return fileList.filter((file) => !file.url && !(file as { attachmentId?: string }).attachmentId)
  }

  static getRemainingPrimaryIds(fileList: UploadUserFile[]): string[] {
    return fileList
      .map((file) => (file as { attachmentId?: string }).attachmentId)
      .filter((id): id is string => Boolean(id))
  }

  static getAttachmentIdFromUploadFile(file: UploadUserFile): string | undefined {
    return (file as { attachmentId?: string }).attachmentId
  }

  static async filesToAttachmentList(files: File[]): Promise<UploadUserFile[]> {
    let uidBase = Date.now()
    return Promise.all(
      files.map(async (file) => {
        uidBase += 1
        const uid = uidBase
        const snapped = await snapshotFile(file)
        const raw = Object.assign(snapped, { uid }) as UploadRawFile
        return {
          uid,
          name: snapped.name,
          raw,
          status: 'ready' as const,
        } as UploadUserFile
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
        }
      }),
    )
  }

  static async fileToUploadPayload(file: UploadUserFile): Promise<PdfUploadPayload> {
    const raw = file.raw
    if (!raw) {
      return { fileName: file.name }
    }
    const readable = await snapshotFile(raw)
    return withFileReadGuard(readable.name, async () => {
      const md5 = await computeFileMd5(readable)
      const checkResult = await checkChangeOrderPdfMd5(md5)
      if (checkResult.exists) {
        return { fileName: readable.name, md5 }
      }
      const buffer = await readable.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!)
      }
      return { fileName: readable.name, content: btoa(binary), md5 }
    })
  }

  static async filesToUploadPayload(files: UploadUserFile[]): Promise<PdfUploadPayload[]> {
    return Promise.all(files.map((file) => ChangeOrder.fileToUploadPayload(file)))
  }

  static async uploadFilesFromList(fileList: UploadUserFile[]): Promise<PdfUploadPayload[]> {
    const snapshotted = await ChangeOrder.snapshotUploadFiles(fileList)
    const newFiles = snapshotted.filter(
      (file) => file.raw instanceof File && !(file as { attachmentId?: string }).attachmentId,
    )
    return Promise.all(newFiles.map((file) => ChangeOrder.fileToUploadPayload(file)))
  }

  static extractFilesFromDrop(dataTransfer: DataTransfer): File[] {
    return [...dataTransfer.files]
  }

  static formatDisplayId(record: ChangeOrderRecord): string {
    return record.orderNo || `#${record.id}`
  }
}
