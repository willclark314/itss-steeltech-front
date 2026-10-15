import { h } from 'vue'
import type { Router } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { ProjectRecord } from '@/models/biz/project'
import { ProjectForm } from '@/models/biz/project'
import { BIZ_ROUTES, buildProjectRouteQuery } from '@/models/biz/navigation'
import { copyTextToClipboard } from '@/utils/clipboard'

export interface ProjectNoMessageOptions {
  projectNo: string
  projectName?: string
  linkedProject?: ProjectRecord | null
}

function buildInfoLines(options: ProjectNoMessageOptions): string[] {
  const name = (options.projectName || options.linkedProject?.name || '').trim() || '-'
  const lines = [`名称：${name}`]

  if (options.linkedProject) {
    const statusLabel =
      ProjectForm.STATUS_MAP[options.linkedProject.status]?.label ??
      options.linkedProject.status
    lines.push(`状态：${statusLabel}`)

    if (options.linkedProject.natures.length) {
      const natures = options.linkedProject.natures
        .map((nature) => ProjectForm.getNatureLabel(nature))
        .filter(Boolean)
        .join('、')
      lines.push(`性质：${natures}`)
    }
  } else {
    lines.push('状态：未关联项目库')
  }

  return lines
}

export async function copyProjectNoAndShowInfo(
  router: Router,
  options: ProjectNoMessageOptions,
) {
  const displayNo = ProjectForm.formatDisplayProjectNo(options.projectNo)
  if (!displayNo) return

  const copyValue = ProjectForm.extractProjectNoCopyText(options.projectNo) || displayNo
  const copied = await copyTextToClipboard(copyValue)
  if (!copied) {
    ElMessage.error('复制项目号失败')
    return
  }

  const lines = buildInfoLines(options)

  ElMessage({
    type: 'success',
    duration: 6000,
    showClose: true,
    customClass: 'project-no-info-message',
    message: h('div', { class: 'project-no-info-message__content' }, [
      h('div', { class: 'project-no-info-message__title' }, `项目编号「${copyValue}」已复制`),
      h('div', { class: 'project-no-info-message__line' }, `项目号：${displayNo}`),
      ...lines.map((line) => h('div', { class: 'project-no-info-message__line' }, line)),
      h(
        'button',
        {
          type: 'button',
          class: 'project-no-info-message__jump',
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
            ElMessage.closeAll()
            void router.push({
              path: BIZ_ROUTES.project,
              query: buildProjectRouteQuery(options.projectNo),
            })
          },
        },
        '前往项目管理',
      ),
    ]),
  })
}
