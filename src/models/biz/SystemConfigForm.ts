import { BusinessSystemConfig, type LocalWorkPathConfig, type WorkPathPatternConfig } from './BusinessSystemConfig'
import { ProjectWorkPath } from './ProjectWorkPath'
import type { SystemConfigResponse } from '@/api/system'

export interface SystemConfigFormData {
  localWorkPath: LocalWorkPathConfig
}

const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/

export class SystemConfigForm {
  static createEmpty(): SystemConfigFormData {
    return {
      localWorkPath: BusinessSystemConfig.normalizeLocalWorkPathConfig(
        BusinessSystemConfig.LOCAL_WORK_PATH,
      ),
    }
  }

  static fromResponse(response: SystemConfigResponse): SystemConfigFormData {
    return {
      localWorkPath: BusinessSystemConfig.normalizeLocalWorkPathConfig(response.localWorkPath),
    }
  }

  static toPayload(form: SystemConfigFormData): SystemConfigResponse {
    const localWorkPath = BusinessSystemConfig.normalizeLocalWorkPathConfig(form.localWorkPath)
    return { localWorkPath }
  }

  static mergeLocalIpOptions(config: LocalWorkPathConfig, localIps: string[]) {
    BusinessSystemConfig.mergeIpOptions(config, localIps)
  }

  static buildSampleFullPath(config: LocalWorkPathConfig, pattern?: string) {
    const relativePath = pattern
      ? ProjectWorkPath.buildSamplePath(pattern)
      : ProjectWorkPath.buildSamplePath(config.pathPatterns.design)
    return BusinessSystemConfig.buildFullPath(relativePath, config)
  }

  static buildPatternPreview(config: LocalWorkPathConfig, nature: keyof WorkPathPatternConfig) {
    return ProjectWorkPath.buildSamplePath(config.pathPatterns[nature])
  }

  static readonly FORM_RULES = {
    'localWorkPath.ips': [
      {
        validator: (_rule: unknown, value: string[], callback: (error?: Error) => void) => {
          const ips = BusinessSystemConfig.normalizeIpList(value)
          if (!ips.length) {
            callback(new Error('请至少保留一个 IP'))
            return
          }
          callback()
        },
        trigger: 'change',
      },
    ],
    'localWorkPath.ip': [
      { required: true, message: '请选择当前使用的 IP', trigger: 'change' },
      {
        validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
          const ip = String(value ?? '').trim()
          if (!IP_PATTERN.test(ip)) {
            callback(new Error('IP 格式不正确'))
            return
          }
          callback()
        },
        trigger: 'change',
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
