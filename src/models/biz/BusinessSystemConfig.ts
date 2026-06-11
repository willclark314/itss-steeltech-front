export interface LocalWorkPathConfig {
  ip: string
  drive: string
}

export class BusinessSystemConfig {
  static readonly LOCAL_WORK_PATH: LocalWorkPathConfig = {
    ip: '10.10.1.175',
    drive: 'F',
  }

  static normalizeDrive(drive: string) {
    return drive.replace(/:$/, '').trim().toUpperCase()
  }

  static normalizeRelativePath(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return ''

    const uncMatch = trimmed.match(/^\\\\[^\\]+\\([A-Za-z])\$?\\(.*)$/i)
    if (uncMatch?.[1] && uncMatch[2] !== undefined) {
      const share = uncMatch[1].toLowerCase()
      const rest = uncMatch[2].replace(/\//g, '\\').replace(/^\\+/, '')
      return rest ? `${share}\\${rest}` : share
    }

    const ipPathMatch = trimmed.match(/^[\d.]+\\([A-Za-z])\\(.*)$/i)
    if (ipPathMatch?.[1] && ipPathMatch[2] !== undefined) {
      const share = ipPathMatch[1].toLowerCase()
      const rest = ipPathMatch[2].replace(/\//g, '\\').replace(/^\\+/, '')
      return rest ? `${share}\\${rest}` : share
    }

    const driveMatch = trimmed.match(/^([A-Za-z]):[\\/]*(.*)$/i)
    if (driveMatch?.[1]) {
      const share = driveMatch[1].toLowerCase()
      const rest = (driveMatch[2] ?? '').replace(/\//g, '\\').replace(/^\\+/, '')
      return rest ? `${share}\\${rest}` : share
    }

    return trimmed.replace(/\//g, '\\').replace(/^\\+/, '')
  }

  static inferShareLetter(relativePath: string, config = BusinessSystemConfig.LOCAL_WORK_PATH) {
    if (relativePath.includes('深化组') || relativePath.includes('加工单归档')) {
      return 'f'
    }
    if (relativePath.includes('设计组')) {
      return 'e'
    }
    return BusinessSystemConfig.normalizeDrive(config.drive).toLowerCase()
  }

  static buildFullPath(relativePath: string, config = BusinessSystemConfig.LOCAL_WORK_PATH) {
    const normalized = BusinessSystemConfig.normalizeRelativePath(relativePath)
    if (!normalized) return ''

    const sharePrefix = normalized.match(/^([A-Za-z])\\(.+)$/i)
    if (sharePrefix) {
      return `\\\\${config.ip}\\${sharePrefix[1].toLowerCase()}\\${sharePrefix[2]}`
    }

    const share = BusinessSystemConfig.inferShareLetter(normalized, config)
    return `\\\\${config.ip}\\${share}\\${normalized}`
  }

  static hasLocalWorkPath(relativePath?: string) {
    return Boolean(BusinessSystemConfig.normalizeRelativePath(relativePath ?? ''))
  }
}
