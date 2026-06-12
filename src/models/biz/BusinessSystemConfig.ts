export interface WorkPathPatternConfig {
  design: string
  detail: string
}

export interface LocalWorkPathConfig {
  /** 当前用于拼接 UNC 路径的 IP */
  ip: string
  /** 可选 IP 列表（含预设、本机 IP 与自定义输入） */
  ips: string[]
  drive: string
  /** 项目本地路径组合规则，支持 {year} {year2} {projectNo} {projectName} {projectFolder} {date} */
  pathPatterns: WorkPathPatternConfig
}

export class BusinessSystemConfig {
  static readonly DEFAULT_SERVER_IP = '10.10.1.175'

  static readonly DEFAULT_PATH_PATTERNS: WorkPathPatternConfig = {
    design: 'e\\1【项目归档】设计组\\【{year}】设计组归档\\{projectNo}#{projectName}',
    detail: 'f\\1【项目归档】深化组\\【{year}】深化组归档\\{projectNo}#{projectName}',
  }

  static readonly LOCAL_WORK_PATH: LocalWorkPathConfig = {
    ip: BusinessSystemConfig.DEFAULT_SERVER_IP,
    ips: [BusinessSystemConfig.DEFAULT_SERVER_IP],
    drive: 'F',
    pathPatterns: { ...BusinessSystemConfig.DEFAULT_PATH_PATTERNS },
  }

  static normalizeIpList(ips: unknown, fallbackIp = BusinessSystemConfig.DEFAULT_SERVER_IP): string[] {
    const rawList = Array.isArray(ips) && ips.length ? ips : [fallbackIp]
    const seen = new Set<string>()
    const result: string[] = []

    for (const raw of rawList) {
      const ip = String(raw).trim()
      if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || seen.has(ip)) continue
      seen.add(ip)
      result.push(ip)
    }

    if (!result.includes(fallbackIp)) {
      result.unshift(fallbackIp)
    }
    if (!result.length) {
      result.push(fallbackIp)
    }
    return result
  }

  static normalizePathPatterns(patterns: Partial<WorkPathPatternConfig> | undefined): WorkPathPatternConfig {
    const defaults = BusinessSystemConfig.DEFAULT_PATH_PATTERNS
    return {
      design: String(patterns?.design ?? defaults.design).trim() || defaults.design,
      detail: String(patterns?.detail ?? defaults.detail).trim() || defaults.detail,
    }
  }

  static normalizeLocalWorkPathConfig(config: Partial<LocalWorkPathConfig>): LocalWorkPathConfig {
    const ips = BusinessSystemConfig.normalizeIpList(
      config.ips?.length ? config.ips : [config.ip ?? BusinessSystemConfig.DEFAULT_SERVER_IP],
    )
    const ipCandidate = String(config.ip ?? ips[0]).trim()
    const ip = ips.includes(ipCandidate) ? ipCandidate : ips[0]

    return {
      ip,
      ips,
      drive: BusinessSystemConfig.normalizeDrive(
        String(config.drive ?? BusinessSystemConfig.LOCAL_WORK_PATH.drive),
      ),
      pathPatterns: BusinessSystemConfig.normalizePathPatterns(config.pathPatterns),
    }
  }

  static mergeIpOptions(config: LocalWorkPathConfig, extraIps: string[] = []) {
    config.ips = BusinessSystemConfig.normalizeIpList([...config.ips, ...extraIps])
    if (!config.ips.includes(config.ip)) {
      config.ip = config.ips[0]
    }
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
