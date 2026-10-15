import { ProjectForm } from './ProjectForm'

export interface DesignWorkflowRecord {
  designStartedAt: string
  designCompletedAt: string
  designAreaSqm: number | null
  designAreaUpdatedAt: string
  designAreaUpdatedBy: string
  designAreaUpdatedByName: string
}

export interface DesignWorkflowEditForm {
  designStartedAt: string
  designCompletedAt: string
}

export class DesignWorkflowForm {
  static readonly DATE_FORMAT = 'YYYY-MM-DD'

  static needsDesignWorkflow(natures: readonly string[]) {
    return natures.includes(ProjectForm.NATURE.DESIGN)
  }

  static createEditForm(workflow: DesignWorkflowRecord): DesignWorkflowEditForm {
    return {
      designStartedAt: workflow.designStartedAt,
      designCompletedAt: workflow.designCompletedAt,
    }
  }

  static toSavePayload(form: DesignWorkflowEditForm): DesignWorkflowEditForm {
    return { ...form }
  }

  static buildTimeSavePayload(
    workflow: DesignWorkflowRecord,
    field: keyof DesignWorkflowEditForm,
    value: string,
  ): DesignWorkflowEditForm {
    const form = DesignWorkflowForm.createEditForm(workflow)
    form[field] = value
    return DesignWorkflowForm.toSavePayload(form)
  }

  static formatDesignArea(value: number | null | undefined) {
    if (value === null || value === undefined) return ''
    return String(value)
  }

  static formatDesignAreaDisplay(value: number | null | undefined) {
    const text = DesignWorkflowForm.formatDesignArea(value)
    return text || '-'
  }

  static getDesignAreaAuditTooltip(workflow: DesignWorkflowRecord | null | undefined) {
    if (!workflow?.designAreaUpdatedAt) return ''
    const updater = workflow.designAreaUpdatedByName || workflow.designAreaUpdatedBy
    if (updater) {
      return `${updater} · ${workflow.designAreaUpdatedAt}`
    }
    return workflow.designAreaUpdatedAt
  }
}
