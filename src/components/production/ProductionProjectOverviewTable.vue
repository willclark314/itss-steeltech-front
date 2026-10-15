<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { updateProject } from '@/api/projects'
import LocalWorkPathCell from '@/components/biz/LocalWorkPathCell.vue'
import ProjectPersonnelCell from '@/components/biz/ProjectPersonnelCell.vue'
import ProjectPersonnelColumnHeader from '@/components/biz/ProjectPersonnelColumnHeader.vue'
import ProjectFlowStatusColumnHeader from '@/components/biz/ProjectFlowStatusColumnHeader.vue'
import ProjectNatureColumnHeader from '@/components/biz/ProjectNatureColumnHeader.vue'
import { ProjectForm } from '@/models/biz/project'
import { ContactForm } from '@/models/biz/contact'
import { resolveContactLinkPath, buildContactRouteQuery } from '@/models/biz/navigation'
import type { ProjectContactLink, ProjectNatureCode, ProjectRecord } from '@/models/biz/project'
import type { PersonnelRecord } from '@/models/personnel'

const props = withDefaults(
  defineProps<{
    data: ProjectRecord[]
    loading?: boolean
    showNature?: boolean
    showPersonnel?: boolean
    personnelOptions?: PersonnelRecord[]
    highlightedProjectNo?: string
    tableHeight?: string | number
  }>(),
  {
    showNature: true,
    showPersonnel: true,
    tableHeight: 'calc(100vh - 300px)',
  },
)

const assignedPersonnelId = defineModel<string>('assignedPersonnelId', { default: '' })
const flowStatusFilter = defineModel<string[]>('flowStatusFilter', { default: () => [] })
const natureFilter = defineModel<string[]>('natureFilter', { default: () => [] })

const tableRef = ref()
const editDialogVisible = ref(false)
const editSubmitting = ref(false)
const editingProjectNo = ref('')
const editForm = reactive({
  structureType: '',
  estimatedWeightTons: null as number | null,
})

defineExpose({ tableRef })

const emit = defineEmits<{
  columnFilterChange: []
  updated: [record: ProjectRecord]
}>()

const router = useRouter()
const structureTypeOptions = ProjectForm.STRUCTURE_TYPE_OPTIONS

function getFlowStatusItems(row: ProjectRecord) {
  return ProjectForm.getFlowStatusItems(row)
}

function toProjectRecord(row: unknown): ProjectRecord {
  return row as ProjectRecord
}

function getNatureMeta(nature: ProjectNatureCode) {
  return ProjectForm.getNatureMeta(nature)
}

function getRowClassName({ row }: { row: ProjectRecord }) {
  if (!props.highlightedProjectNo) return ''
  return (
    ProjectForm.getDisplayProjectNo(row) ===
    ProjectForm.parseBaseProjectNo(props.highlightedProjectNo)
  )
    ? 'is-highlighted'
    : ''
}

function getContactLinks(row: ProjectRecord): ProjectContactLink[] {
  return ProjectForm.getContactLinks(row)
}

function getContactLinkLabel(link: ProjectContactLink, row: ProjectRecord) {
  return ContactForm.formatDisplayId(link.contactFormId, ProjectForm.getDisplayProjectNo(row))
}

function getContactLinkSummary(links: ProjectContactLink[], row: ProjectRecord) {
  return links.map((link) => getContactLinkLabel(link, row)).join('、')
}

function formatEstimatedWeight(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return String(value)
}

function goToContactBrowse(contactFormId: string) {
  router.push({
    path: resolveContactLinkPath(router.currentRoute.value.path),
    query: buildContactRouteQuery(contactFormId),
  })
}

function handleContactTagClick(link: ProjectContactLink) {
  goToContactBrowse(link.contactFormId)
}

function openEditDialog(row: ProjectRecord) {
  editingProjectNo.value = row.projectNo
  editForm.structureType = row.structureType || ''
  editForm.estimatedWeightTons = row.estimatedWeightTons ?? null
  editDialogVisible.value = true
}

function handleEditDialogClosed() {
  editingProjectNo.value = ''
  editForm.structureType = ''
  editForm.estimatedWeightTons = null
}

async function submitEdit() {
  const projectNo = editingProjectNo.value
  if (!projectNo || editSubmitting.value) return

  editSubmitting.value = true
  try {
    const updated = await updateProject(projectNo, {
      structureType: editForm.structureType || '',
      estimatedWeightTons: editForm.estimatedWeightTons,
    })
    emit('updated', updated)
    editDialogVisible.value = false
    ElMessage.success('项目概况已更新')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新项目概况失败')
  } finally {
    editSubmitting.value = false
  }
}
</script>

<template>
  <el-table
    ref="tableRef"
    v-loading="loading"
    :data="data"
    stripe
    class="biz-data-table production-overview-table"
    :row-class-name="getRowClassName"
    :height="tableHeight"
    style="min-width: 1200px"
  >
    <el-table-column label="联系单编号" width="130" class-name="tag-column contact-form-column">
      <template #default="{ row }">
        <template v-if="getContactLinks(toProjectRecord(row)).length">
          <el-tooltip
            :content="getContactLinkSummary(getContactLinks(toProjectRecord(row)), toProjectRecord(row))"
            placement="top"
            :show-after="200"
            :disabled="getContactLinkSummary(getContactLinks(toProjectRecord(row)), toProjectRecord(row)).length < 16"
          >
            <div class="contact-form-tag-list">
              <el-tag
                v-for="link in getContactLinks(toProjectRecord(row))"
                :key="`${link.projectNo}:${link.contactFormId}`"
                type="success"
                size="small"
                class="cell-tag cell-tag--clickable"
                @click.stop="handleContactTagClick(link)"
              >
                {{ getContactLinkLabel(link, toProjectRecord(row)) }}
              </el-tag>
            </div>
          </el-tooltip>
        </template>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>
    <el-table-column label="项目号" width="130" class-name="text-column">
      <template #default="{ row }">
        <span
          class="project-no-text"
          :class="{ 'is-urgent': ProjectForm.hasUrgentContact(toProjectRecord(row)) }"
        >
          {{ ProjectForm.getDisplayProjectNo(toProjectRecord(row)) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column prop="name" label="项目名称" min-width="300" show-overflow-tooltip />
    <el-table-column label="结构形式" width="120" show-overflow-tooltip>
      <template #default="{ row }">
        {{ toProjectRecord(row).structureType || '-' }}
      </template>
    </el-table-column>
    <el-table-column label="预估重量(t)" width="110" align="center">
      <template #default="{ row }">
        {{ formatEstimatedWeight(toProjectRecord(row).estimatedWeightTons) }}
      </template>
    </el-table-column>
    <el-table-column v-if="showNature" width="130" class-name="tag-column nature-column">
      <template #header>
        <ProjectNatureColumnHeader v-model="natureFilter" @change="emit('columnFilterChange')" />
      </template>
      <template #default="{ row }">
        <div class="nature-cell" :class="{ 'is-empty': !toProjectRecord(row).natures.length }">
          <el-tooltip
            v-if="toProjectRecord(row).natures.length"
            placement="top"
            :show-after="200"
          >
            <template #content>
              <div class="nature-tooltip">
                <div v-for="nature in toProjectRecord(row).natures" :key="nature">
                  {{ getNatureMeta(nature)!.label }}
                </div>
              </div>
            </template>
            <div class="nature-tag-list">
              <el-tag
                v-for="nature in toProjectRecord(row).natures"
                :key="nature"
                :type="getNatureMeta(nature)!.type"
                size="small"
                class="cell-tag"
              >
                {{ getNatureMeta(nature)!.label }}
              </el-tag>
            </div>
          </el-tooltip>
          <span v-else class="text-muted">-</span>
        </div>
      </template>
    </el-table-column>
    <el-table-column
      v-if="showPersonnel"
      width="120"
      class-name="tag-column personnel-column"
    >
      <template #header>
        <ProjectPersonnelColumnHeader
          v-model:assigned-personnel-id="assignedPersonnelId"
          :personnel-options="personnelOptions || []"
        />
      </template>
      <template #default="{ row }">
        <ProjectPersonnelCell :personnel="row.assignedPersonnel || []" />
      </template>
    </el-table-column>
    <el-table-column min-width="150" class-name="tag-column">
      <template #header>
        <ProjectFlowStatusColumnHeader v-model="flowStatusFilter" @change="emit('columnFilterChange')" />
      </template>
      <template #default="{ row }">
        <div class="flow-status-tag-list">
          <el-tag
            v-for="item in getFlowStatusItems(toProjectRecord(row))"
            :key="item.label"
            :type="item.type"
            size="small"
            class="cell-tag"
          >
            {{ item.label }}
          </el-tag>
        </div>
      </template>
    </el-table-column>
    <el-table-column
      prop="receivedDate"
      label="收单时间"
      width="110"
      align="center"
      header-align="center"
      class-name="date-column"
    />
    <el-table-column
      label="本地路径"
      width="116"
      align="center"
      fixed="right"
      class-name="local-path-column"
    >
      <template #default="{ row }">
        <LocalWorkPathCell :project="toProjectRecord(row)" readonly />
      </template>
    </el-table-column>
    <el-table-column label="操作" width="80" fixed="right" align="center">
      <template #default="{ row }">
        <el-button type="primary" link @click="openEditDialog(toProjectRecord(row))">编辑</el-button>
      </template>
    </el-table-column>
  </el-table>

  <el-dialog
    v-model="editDialogVisible"
    title="编辑项目概况"
    width="420px"
    destroy-on-close
    @closed="handleEditDialogClosed"
  >
    <el-form label-width="100px">
      <el-form-item label="项目号">
        <span>{{ ProjectForm.formatDisplayProjectNo(editingProjectNo) }}</span>
      </el-form-item>
      <el-form-item label="结构形式">
        <el-select
          v-model="editForm.structureType"
          clearable
          placeholder="选择结构形式"
          style="width: 100%"
        >
          <el-option
            v-for="item in structureTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="预估重量">
        <el-input-number
          v-model="editForm.estimatedWeightTons"
          :min="0"
          :precision="3"
          :controls="false"
          placeholder="吨"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="editSubmitting" @click="submitEdit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.nature-cell {
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--biz-table-row-height, 35px);
}

.nature-cell.is-empty {
  padding-left: 2px;
}

.nature-tag-list {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}
</style>
