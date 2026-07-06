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

  static buildVariables(
    project: Pick<
      ProjectRecord,
      'projectNo' | 'name' | 'receivedDate' | 'plannedStartDate' | 'contactFormIds' | 'localWorkPath' | 'natures'
    > & { isJiagongdan?: boolean },
    patternKey?: keyof WorkPathPatternConfig | null,
  ): ProjectPathVariables {
    const resolvedPatternKey = patternKey ?? ProjectWorkPath.resolvePatternKey(project)
    const year = ProjectWorkPath.extractArchiveYear(project, resolvedPatternKey)
    const year2 = year.slice(-2)
    const projectNo = project.projectNo.trim()
    const projectNoDigits = ProjectWorkPath.extractProjectNoDigits(projectNo)
    const projectName = project.name.trim()
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

  static resolvePatternKey(
    project: Pick<ProjectRecord, 'name' | 'contactFormIds' | 'localWorkPath' | 'natures'> & {
      isJiagongdan?: boolean
    },
    nature?: ProjectNatureCode | null,
  ): keyof WorkPathPatternConfig | null {
    const templateNature = nature ?? ProjectWorkPath.resolveNatureTemplate(project.natures)
    if (!templateNature) return null
    if (templateNature === 'design') return 'design'
    return ProjectWorkPath.isJiagongdanProject(project) ? 'detailJiagongdan' : 'detail'
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
    const digits = ProjectWorkPath.extractProjectNoDigits(projectNo)
    const upperNo = projectNo.trim().toUpperCase()
    return leaf.toUpperCase().includes(upperNo) || leaf.includes(digits)
  }

  static isJiagongdanProject(
    project: Pick<ProjectRecord, 'name' | 'localWorkPath' | 'contactFormIds'> & { isJiagongdan?: boolean },
  ) {
    if (project.isJiagongdan) return true
    const path = BusinessSystemConfig.normalizeRelativePath(project.localWorkPath ?? '')
    if (path.includes('加工单归档')) return true
    if ((project.name || '').includes('加工单')) return true
    return (project.contactFormIds || []).some((id) => ContactForm.isProcessingFormId(id))
  }
}
