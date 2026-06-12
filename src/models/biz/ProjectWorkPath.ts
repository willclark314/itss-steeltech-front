import { BusinessSystemConfig, type WorkPathPatternConfig } from './BusinessSystemConfig'
import type { ProjectNatureCode, ProjectRecord } from './project/ProjectForm'

export interface ProjectPathVariables {
  year: string
  year2: string
  projectNo: string
  projectName: string
  projectFolder: string
  date: string
}

export class ProjectWorkPath {
  static buildVariables(project: Pick<ProjectRecord, 'projectNo' | 'name' | 'receivedDate' | 'plannedStartDate'>): ProjectPathVariables {
    const year = ProjectWorkPath.extractProjectYear(project)
    const year2 = year.slice(-2)
    const projectNo = project.projectNo.trim()
    const projectName = project.name.trim()
    const projectFolder = projectName ? `${projectNo}#${projectName}` : projectNo

    return {
      year,
      year2,
      projectNo,
      projectName,
      projectFolder,
      date: new Date().toISOString().slice(0, 10),
    }
  }

  static extractProjectYear(
    project: Pick<ProjectRecord, 'projectNo' | 'receivedDate' | 'plannedStartDate'>,
  ): string {
    const dateStr = (project.receivedDate || project.plannedStartDate || '').trim()
    if (/^\d{4}/.test(dateStr)) {
      return dateStr.slice(0, 4)
    }

    const digits = project.projectNo.replace(/^[A-Za-z]+/, '')
    if (digits.length >= 2) {
      return `20${digits.slice(0, 2)}`
    }

    return String(new Date().getFullYear())
  }

  static renderPattern(pattern: string, variables: ProjectPathVariables): string {
    let rendered = pattern.trim()
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replaceAll(`{${key}}`, value)
    }
    return BusinessSystemConfig.normalizeRelativePath(rendered)
  }

  static resolveNatureTemplate(natures: ProjectNatureCode[]): ProjectNatureCode | null {
    if (natures.includes('detail')) return 'detail'
    if (natures.includes('design')) return 'design'
    return null
  }

  static buildRelativePath(
    project: Pick<ProjectRecord, 'projectNo' | 'name' | 'natures' | 'receivedDate' | 'plannedStartDate'>,
    patterns: WorkPathPatternConfig = BusinessSystemConfig.DEFAULT_PATH_PATTERNS,
    nature?: ProjectNatureCode | null,
  ): string | null {
    const templateNature = nature ?? ProjectWorkPath.resolveNatureTemplate(project.natures)
    if (!templateNature) return null

    const pattern = patterns[templateNature]
    if (!pattern?.trim()) return null

    return ProjectWorkPath.renderPattern(pattern, ProjectWorkPath.buildVariables(project))
  }

  static buildSamplePath(pattern: string) {
    return ProjectWorkPath.renderPattern(pattern, {
      year: '2026',
      year2: '26',
      projectNo: 'AB25059',
      projectName: '示例项目名称',
      projectFolder: 'AB25059#示例项目名称',
      date: new Date().toISOString().slice(0, 10),
    })
  }
}
