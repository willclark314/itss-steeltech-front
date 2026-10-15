export type ProjectModelType = 'detail' | 'jiagong'
export type ProjectModelStatus = 'not_started' | 'in_progress' | 'completed'

export interface ProjectModelRecord {
  id: string
  projectNo: string
  projectName: string
  isJiagongdan: boolean
  modelType: ProjectModelType
  name: string
  status: ProjectModelStatus
  modelWeightTons: number | null
  modelPath: string
  remark: string
  seq: number
  createdAt: string
  updatedAt: string
}

export interface ProjectModelFormState {
  projectNo: string
  modelType: ProjectModelType
  name: string
  status: ProjectModelStatus
  modelWeightTons: number | null
  modelPath: string
  remark: string
  seq: number
}

export class ProjectModelForm {
  static readonly MODEL_TYPE = {
    DETAIL: 'detail',
    JIAGONG: 'jiagong',
  } as const

  static readonly STATUS = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
  } as const

  static readonly MODEL_TYPE_OPTIONS = [
    { value: '' as const, label: '全部类型' },
    { value: ProjectModelForm.MODEL_TYPE.DETAIL, label: '细化模型' },
    { value: ProjectModelForm.MODEL_TYPE.JIAGONG, label: '甲供模型' },
  ]

  static readonly MODEL_TYPE_FORM_OPTIONS = ProjectModelForm.MODEL_TYPE_OPTIONS.filter(
    (item) => item.value,
  )

  static readonly STATUS_OPTIONS = [
    { value: '' as const, label: '全部状态' },
    { value: ProjectModelForm.STATUS.NOT_STARTED, label: '未开始' },
    { value: ProjectModelForm.STATUS.IN_PROGRESS, label: '进行中' },
    { value: ProjectModelForm.STATUS.COMPLETED, label: '已完成' },
  ]

  static readonly STATUS_FORM_OPTIONS = ProjectModelForm.STATUS_OPTIONS.filter((item) => item.value)

  static readonly FORM_RULES = {
    projectNo: [{ required: true, message: '请选择关联项目', trigger: 'change' }],
    modelType: [{ required: true, message: '请选择模型类型', trigger: 'change' }],
    name: [{ required: true, message: '请输入模型名称', trigger: 'blur' }],
    status: [{ required: true, message: '请选择状态', trigger: 'change' }],
  }

  static createEmptyForm(): ProjectModelFormState {
    return {
      projectNo: '',
      modelType: ProjectModelForm.MODEL_TYPE.DETAIL,
      name: '',
      status: ProjectModelForm.STATUS.NOT_STARTED,
      modelWeightTons: null,
      modelPath: '',
      remark: '',
      seq: 0,
    }
  }

  static fromRecord(record: ProjectModelRecord): ProjectModelFormState {
    return {
      projectNo: record.projectNo,
      modelType: record.modelType,
      name: record.name,
      status: record.status,
      modelWeightTons: record.modelWeightTons,
      modelPath: record.modelPath || '',
      remark: record.remark || '',
      seq: record.seq ?? 0,
    }
  }

  static modelTypeLabel(type: string) {
    return ProjectModelForm.MODEL_TYPE_OPTIONS.find((item) => item.value === type)?.label || type || '-'
  }

  static statusLabel(status: string) {
    return ProjectModelForm.STATUS_OPTIONS.find((item) => item.value === status)?.label || status || '-'
  }

  static statusTagType(status: string): 'info' | 'primary' | 'success' {
    if (status === ProjectModelForm.STATUS.IN_PROGRESS) return 'primary'
    if (status === ProjectModelForm.STATUS.COMPLETED) return 'success'
    return 'info'
  }

  static formatWeight(value: number | null | undefined) {
    if (value === null || value === undefined || Number.isNaN(value)) return '-'
    return `${value}`
  }

  static sortForDisplay(list: ProjectModelRecord[]) {
    return [...list].sort((a, b) => {
      const projectCompare = a.projectNo.localeCompare(b.projectNo)
      if (projectCompare !== 0) return projectCompare
      if (a.seq !== b.seq) return a.seq - b.seq
      return (b.createdAt || '').localeCompare(a.createdAt || '')
    })
  }
}
