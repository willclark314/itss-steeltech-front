import { BusinessSystemConfig, type LocalWorkPathConfig } from './BusinessSystemConfig'
import type { SystemConfigResponse } from '@/api/system'

export interface SystemConfigFormData {
  localWorkPath: LocalWorkPathConfig
}

export class SystemConfigForm {
  static createEmpty(): SystemConfigFormData {
    return {
      localWorkPath: {
        ip: BusinessSystemConfig.LOCAL_WORK_PATH.ip,
        drive: BusinessSystemConfig.LOCAL_WORK_PATH.drive,
      },
    }
  }

  static fromResponse(response: SystemConfigResponse): SystemConfigFormData {
    return {
      localWorkPath: {
        ip: response.localWorkPath.ip.trim(),
        drive: BusinessSystemConfig.normalizeDrive(response.localWorkPath.drive),
      },
    }
  }

  static toPayload(form: SystemConfigFormData): SystemConfigResponse {
    return {
      localWorkPath: {
        ip: form.localWorkPath.ip.trim(),
        drive: BusinessSystemConfig.normalizeDrive(form.localWorkPath.drive),
      },
    }
  }

  static buildSampleFullPath(config: LocalWorkPathConfig) {
    return BusinessSystemConfig.buildFullPath('钢结构项目/示例项目', config)
  }

  static readonly FORM_RULES = {
    'localWorkPath.ip': [
      { required: true, message: '请输入文件服务器 IP', trigger: 'blur' },
      {
        pattern: /^(\d{1,3}\.){3}\d{1,3}$/,
        message: 'IP 格式不正确',
        trigger: 'blur',
      },
    ],
    'localWorkPath.drive': [
      { required: true, message: '请输入默认盘符', trigger: 'blur' },
      {
        pattern: /^[A-Za-z]$/,
        message: '盘符为单个字母',
        trigger: 'blur',
      },
    ],
  } as const
}
