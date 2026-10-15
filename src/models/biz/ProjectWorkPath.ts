import { BusinessSystemConfig, type WorkPathPatternConfig } from './BusinessSystemConfig'
import { ContactForm } from './contact/ContactForm'
import { ProjectForm, type ProjectNatureCode, type ProjectRecord } from './project/ProjectForm'

export interface ProjectPathVariables {
  year: string
  year2: string
  projectNo: string
  /** 项目号中的阿拉伯数字部分，如 AB25059 → 25059 */
  projectNoDigits: string
  projectName: string
  projectFolder: string
  date: string
}

export class ProjectWorkPath {
  static getNaturePath(
    project: Pick<ProjectRecord, 'designWorkPath' | 'detailWorkPath' | 'localWorkPath'>,
    nature: ProjectNatureCode,
  ) {
    if (nature === 'design') {
      return BusinessSystemConfig.normalizeRelativePath(project.designWorkPath ?? '')
    }
    return BusinessSystemConfig.normalizeRelativePath(
      project.detailWorkPath ?? project.localWorkPath ?? '',
    )
  }

  static extractProjectNoDigits(projectNo: string): string {
    const trimmed = projectNo.trim()
    const withoutPrefix = trimmed.replace(/^[A-Za-z]+/, '')
    if (withoutPrefix && /^\d+$/.test(withoutPrefix)) {
      return withoutPrefix
    }
    const digits = trimmed.replace(/\D/g, '')
    return digits || trimmed
  }

  /** 生成文件夹名时去掉样板目录、待安排标记与 GJGJSK 版本号等占位后缀 */
  static sanitizeFolderProjectName(name: string): string {
    return name
      .trim()
      .replace(/^（空样板[!！]勿剪切）\s*/u, '')
      .replace(/\s*【待安排@@】\(需排瓦&不排瓦\)(?:\(GJGJSK-[\d.]+版\))?/gu, '')
      .replace(/[/\\]+$/u, '')
      .trim()
  }

  static buildVariables(
    project: Pick<
      ProjectRecord,
      | 'projectNo'
      | 'name'
      | 'receivedDate'
      | 'plannedStartDate'
      | 'contactFormIds'
      | 'localWorkPath'
      | 'designWorkPath'
      | 'detailWorkPath'
      | 'natures'
    > & { isJiagongdan?: boolean },
    patternKey?: keyof WorkPathPatternConfig | null,
  ): ProjectPathVariables {
    const resolvedPatternKey = patternKey ?? ProjectWorkPath.resolvePatternKey(project)
    const year = ProjectWorkPath.extractArchiveYear(project, resolvedPatternKey)
    const year2 = year.slice(-2)
    const projectNo = project.projectNo.trim()
    const projectNoDigits = ProjectWorkPath.extractProjectNoDigits(projectNo)
    const projectName = ProjectWorkPath.sanitizeFolderProjectName(project.name)
    const projectFolder = projectName ? `${projectNoDigits}#${projectName}` : projectNoDigits

    return {
      year,
      year2,
      projectNo,
      projectNoDigits,
      projectName,
      projectFolder,
      date: new Date().toISOString().slice(0, 10),
    }
  }

  static extractYearFromDate(dateStr: string): string | null {
    const trimmed = dateStr.trim()
    if (/^\d{4}/.test(trimmed)) {
      return trimmed.slice(0, 4)
    }
    return null
  }

  static extractYearFromJiagongdanContactIds(contactFormIds?: string[]): string | null {
    for (const id of contactFormIds || []) {
      const match = (id || '').trim().match(/^BRD(\d{2})\d{4}C/i)
      if (match?.[1]) {
        return `20${match[1]}`
      }
    }
    return null
  }

  static extractProjectYear(
    project: Pick<ProjectRecord, 'projectNo' | 'receivedDate' | 'plannedStartDate'>,
  ): string {
    const digits = ProjectWorkPath.extractProjectNoDigits(project.projectNo)
    if (digits.length >= 2) {
      return `20${digits.slice(0, 2)}`
    }

    const yearFromDate = ProjectWorkPath.extractYearFromDate(
      project.receivedDate || project.plannedStartDate || '',
    )
    if (yearFromDate) {
      return yearFromDate
    }

    return String(new Date().getFullYear())
  }

  /** 深化/加工单归档目录按收单年份；设计组仍优先项目号年份。 */
  static extractArchiveYear(
    project: Pick<ProjectRecord, 'projectNo' | 'receivedDate' | 'plannedStartDate' | 'contactFormIds'>,
    patternKey: keyof WorkPathPatternConfig | null,
  ): string {
    if (patternKey === 'detailJiagongdan') {
      const yearFromContact = ProjectWorkPath.extractYearFromJiagongdanContactIds(project.contactFormIds)
      if (yearFromContact) return yearFromContact
    }

    if (patternKey === 'detailJiagongdan' || patternKey === 'detail') {
      const yearFromDate = ProjectWorkPath.extractYearFromDate(
        project.receivedDate || project.plannedStartDate || '',
      )
      if (yearFromDate) return yearFromDate
      return ProjectWorkPath.extractProjectYear(project)
    }

    return ProjectWorkPath.extractProjectYear(project)
  }

  static renderPattern(pattern: string, variables: ProjectPathVariables): string {
    let rendered = pattern.trim()
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replaceAll(`{${key}}`, value)
    }
    return BusinessSystemConfig.normalizeRelativePath(rendered)
  }

  static resolveNatureTemplate(natures: ProjectNatureCode[]): ProjectNatureCode | null {
    if (natures.some((nature) => ProjectForm.isDetailGroupNature(nature))) return 'detail'
    if (natures.includes('design')) return 'design'
    return null
  }

  static resolveDisplayLocalWorkPath(
    project: Pick<ProjectRecord, 'natures' | 'designWorkPath' | 'detailWorkPath' | 'localWorkPath'>,
  ) {
    const templateNature = ProjectWorkPath.resolveNatureTemplate(project.natures)
    if (templateNature) {
      return ProjectWorkPath.getNaturePath(project, templateNature)
    }
    return ProjectForm.normalizeLocalWorkPath(project.localWorkPath)
  }

  static syncWorkPathsForNatures(
    project: Pick<
      ProjectRecord,
      | 'projectNo'
      | 'name'
      | 'natures'
      | 'receivedDate'
      | 'plannedStartDate'
      | 'contactFormIds'
      | 'designWorkPath'
      | 'detailWorkPath'
      | 'localWorkPath'
      | 'isJiagongdan'
    >,
    prevNatures: readonly ProjectNatureCode[],
    patterns: WorkPathPatternConfig = BusinessSystemConfig.DEFAULT_PATH_PATTERNS,
  ): Pick<ProjectRecord, 'designWorkPath' | 'detailWorkPath' | 'localWorkPath'> {
    const prevHasDesign = prevNatures.includes(ProjectForm.NATURE.DESIGN)
    const prevHasDetailGroup = ProjectForm.hasDetailGroupNature({ natures: [...prevNatures] })
    const nextHasDesign = project.natures.includes(ProjectForm.NATURE.DESIGN)
    const nextHasDetailGroup = ProjectForm.hasDetailGroupNature(project)

    let designWorkPath = ProjectForm.normalizeLocalWorkPath(project.designWorkPath)
    let detailWorkPath = ProjectForm.normalizeLocalWorkPath(project.detailWorkPath)

    if (prevHasDesign && !nextHasDesign) {
      designWorkPath = ''
    }
    if (prevHasDetailGroup && !nextHasDetailGroup) {
      detailWorkPath = ''
    }

    const pathProject = { ...project, designWorkPath, detailWorkPath }

    if (!prevHasDesign && nextHasDesign && !ProjectForm.hasLocalWorkPath(designWorkPath)) {
      designWorkPath =
        ProjectWorkPath.buildRelativePath(pathProject, patterns, ProjectForm.NATURE.DESIGN) ?? ''
    }
    if (!prevHasDetailGroup && nextHasDetailGroup && !ProjectForm.hasLocalWorkPath(detailWorkPath)) {
      detailWorkPath =
        ProjectWorkPath.buildRelativePath(pathProject, patterns, ProjectForm.NATURE.DETAIL) ?? ''
    }

    const localWorkPath = ProjectForm.resolvePrimaryLocalWorkPath({
      designWorkPath,
      detailWorkPath,
      localWorkPath: '',
    })

    return { designWorkPath, detailWorkPath, localWorkPath }
  }

  static resolvePatternKey(
    project: Pick<
      ProjectRecord,
      | 'name'
      | 'contactFormIds'
      | 'localWorkPath'
      | 'designWorkPath'
      | 'detailWorkPath'
      | 'natures'
    > & { isJiagongdan?: boolean },
    nature?: ProjectNatureCode | null,
  ): keyof WorkPathPatternConfig | null {
    const templateNature = nature ?? ProjectWorkPath.resolveNatureTemplate(project.natures)
    if (!templateNature) return null
    if (templateNature === 'design') return 'design'
    // 建议/新建路径只看当前联系单性质，不能被已保存的「加工单归档」路径锁死
    return ProjectWorkPath.expectsJiagongdanArchive(project) ? 'detailJiagongdan' : 'detail'
  }

  static buildRelativePath(
    project: Pick<
      ProjectRecord,
      | 'projectNo'
      | 'name'
      | 'natures'
      | 'receivedDate'
      | 'plannedStartDate'
      | 'contactFormIds'
      | 'localWorkPath'
      | 'designWorkPath'
      | 'detailWorkPath'
    > & { isJiagongdan?: boolean },
    patterns: WorkPathPatternConfig = BusinessSystemConfig.DEFAULT_PATH_PATTERNS,
    nature?: ProjectNatureCode | null,
  ): string | null {
    const patternKey = ProjectWorkPath.resolvePatternKey(project, nature)
    if (!patternKey) return null
    const pattern = patterns[patternKey]
    if (!pattern?.trim()) return null
    return ProjectWorkPath.renderPattern(pattern, ProjectWorkPath.buildVariables(project, patternKey))
  }

  static buildSamplePath(pattern: string) {
    return ProjectWorkPath.renderPattern(pattern, {
      year: '2026',
      year2: '26',
      projectNo: 'AB25059',
      projectNoDigits: '25059',
      projectName: '示例项目名称',
      projectFolder: '25059#示例项目名称',
      date: new Date().toISOString().slice(0, 10),
    })
  }

  static pathMatchesProject(relativePath: string, projectNo: string) {
    const normalized = BusinessSystemConfig.normalizeRelativePath(relativePath)
    if (!normalized) return false

    const leaf = normalized.split('\\').pop() || ''
    const baseNo = ProjectForm.parseBaseProjectNo(projectNo)
    const baseUpper = baseNo.toUpperCase()
    const leafUpper = leaf.toUpperCase()

    if (ProjectForm.hasHyphenSplitSuffix(projectNo)) {
      if (leafUpper.includes(baseUpper)) return true
      const matchKey = ProjectForm.extractProjectNoCopyText(projectNo)
      return Boolean(matchKey) && leaf.includes(matchKey)
    }

    if (leafUpper.includes(baseUpper)) return true

    const digits = ProjectWorkPath.extractProjectNoDigits(projectNo)
    if (!digits || !leaf.includes(digits)) return false

    // 根项目号不匹配已拆分的 -1 / -2 子目录
    if (new RegExp(`${digits}-\\d+`).test(leaf) && !leafUpper.includes(baseUpper)) {
      return false
    }
    return true
  }

  static buildPathSearchOptions(
    project: Pick<
      ProjectRecord,
      | 'projectNo'
      | 'name'
      | 'natures'
      | 'receivedDate'
      | 'plannedStartDate'
      | 'contactFormIds'
      | 'designWorkPath'
      | 'detailWorkPath'
      | 'localWorkPath'
    > & { isJiagongdan?: boolean },
    pathNature?: 'design' | 'detail',
    relativePath = '',
  ) {
    const normalizedPath = ProjectForm.normalizeLocalWorkPath(relativePath)
    const receivedDate = project.receivedDate || project.plannedStartDate
    const contactFormIds = [...(project.contactFormIds || [])]

    if (pathNature === 'design') {
      return {
        relativePath: normalizedPath,
        natures: [ProjectForm.NATURE.DESIGN] as ProjectNatureCode[],
        receivedDate,
        projectName: project.name,
        contactFormIds,
        isJiagongdan: false,
      }
    }

    if (pathNature === 'detail') {
      const detailNatures = project.natures.filter((nature) => ProjectForm.isDetailGroupNature(nature))
      return {
        relativePath: normalizedPath,
        natures: (detailNatures.length ? detailNatures : [ProjectForm.NATURE.DETAIL]) as ProjectNatureCode[],
        receivedDate,
        projectName: project.name,
        contactFormIds,
        isJiagongdan: ProjectWorkPath.expectsJiagongdanArchive(project),
      }
    }

    const templateNature = ProjectWorkPath.resolveNatureTemplate(project.natures)

    return {
      relativePath: normalizedPath,
      natures: [...project.natures],
      receivedDate,
      projectName: project.name,
      contactFormIds,
      isJiagongdan:
        templateNature === 'detail'
          ? ProjectWorkPath.expectsJiagongdanArchive(project)
          : false,
    }
  }

  /**
   * 是否按加工单归档处理。
   * 优先看当前联系单性质；若未命中，再看已保存路径是否已在「加工单归档」下。
   * 生成/建议新路径请用 expectsJiagongdanArchive，避免被旧路径锁死。
   */
  static isJiagongdanProject(
    project: Pick<
      ProjectRecord,
      'name' | 'localWorkPath' | 'detailWorkPath' | 'contactFormIds'
    > & { isJiagongdan?: boolean },
    relativePath?: string,
  ) {
    if (ProjectWorkPath.expectsJiagongdanArchive(project)) return true
    const path = BusinessSystemConfig.normalizeRelativePath(
      relativePath ?? project.detailWorkPath ?? project.localWorkPath ?? '',
    )
    return path.includes('加工单归档')
  }

  /** 仅按项目标志/名称/联系单号判断是否应为加工单归档（忽略已保存路径） */
  static expectsJiagongdanArchive(
    project: Pick<ProjectRecord, 'name' | 'contactFormIds'> & { isJiagongdan?: boolean },
  ) {
    if (project.isJiagongdan) return true
    if ((project.name || '').includes('加工单') || (project.name || '').includes('甲供')) return true
    return (project.contactFormIds || []).some((id) => ContactForm.isProcessingFormId(id))
  }

  /** 根据相对路径判断归档类别（用于悬停提示） */
  static getArchivePathKind(relativePath: string): 'jiagongdan' | 'detail' | 'unknown' {
    const path = BusinessSystemConfig.normalizeRelativePath(relativePath)
    if (!path) return 'unknown'
    if (path.includes('加工单归档')) return 'jiagongdan'
    if (path.includes('深化组归档') || path.includes('【项目归档】深化组')) return 'detail'
    return 'unknown'
  }

  static getArchivePathKindLabel(kind: 'jiagongdan' | 'detail' | 'unknown' | 'design'): string {
    if (kind === 'jiagongdan') return '加工单归档'
    if (kind === 'detail') return '深化组归档'
    if (kind === 'design') return '设计归档'
    return '未知'
  }

  /**
   * 已保存细化路径与当前联系单性质（加工单/普通）是否不一致。
   * 不一致时悬停应提示建议新路径，创建路径应允许按新规则重建。
   */
  static isDetailArchiveKindMismatch(
    project: Pick<
      ProjectRecord,
      | 'name'
      | 'contactFormIds'
      | 'localWorkPath'
      | 'designWorkPath'
      | 'detailWorkPath'
      | 'natures'
    > & { isJiagongdan?: boolean },
    savedRelativePath?: string,
  ) {
    const saved = BusinessSystemConfig.normalizeRelativePath(
      savedRelativePath ?? ProjectWorkPath.getNaturePath(project, 'detail'),
    )
    if (!saved) return false
    const expectJiagongdan = ProjectWorkPath.expectsJiagongdanArchive(project)
    const savedKind = ProjectWorkPath.getArchivePathKind(saved)
    if (savedKind === 'unknown') return false
    if (expectJiagongdan) return savedKind !== 'jiagongdan'
    return savedKind === 'jiagongdan'
  }
}
