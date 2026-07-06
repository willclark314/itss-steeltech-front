<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { updateProject } from '@/api/projects'
import { ProjectForm } from '@/models/biz/project'
import type { ProjectNatureCode, ProjectRecord } from '@/models/biz/project'

const props = defineProps<{
  project: ProjectRecord
}>()

const emit = defineEmits<{
  updated: [record: ProjectRecord]
}>()

const natureOptions = ProjectForm.NATURE_OPTIONS

const popoverVisible = ref(false)
const saving = ref(false)
const draftNatures = ref<ProjectNatureCode[]>([])

function getNatureMeta(nature: ProjectNatureCode) {
  return ProjectForm.getNatureMeta(nature)
}

function syncDraft() {
  draftNatures.value = [...props.project.natures]
}

function isSameNatures(left: ProjectNatureCode[], right: ProjectNatureCode[]) {
  if (left.length !== right.length) return false
  return left.every((item) => right.includes(item))
}

function handlePopoverShow() {
  syncDraft()
}

async function handlePopoverHide() {
  if (saving.value) return

  const nextNatures = [...draftNatures.value]
  if (isSameNatures(nextNatures, props.project.natures)) return

  saving.value = true
  try {
    const updated = await updateProject(props.project.projectNo, {
      natures: nextNatures,
    })
    emit('updated', updated)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新项目性质失败')
    syncDraft()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-popover
    v-model:visible="popoverVisible"
    placement="bottom-start"
    :width="140"
    trigger="click"
    :disabled="saving"
    @show="handlePopoverShow"
    @hide="handlePopoverHide"
  >
    <template #reference>
      <button
        type="button"
        class="nature-cell"
        :class="{ 'is-loading': saving, 'is-empty': !project.natures.length }"
        :disabled="saving"
        @click.stop
      >
        <el-tooltip v-if="project.natures.length" placement="top" :show-after="200">
          <template #content>
            <div class="nature-tooltip">
              <div v-for="nature in project.natures" :key="nature">
                {{ getNatureMeta(nature)!.label }}
              </div>
            </div>
          </template>
          <div class="nature-tag-list">
            <el-tag
              v-for="nature in project.natures"
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
      </button>
    </template>

    <div class="nature-picker" @click.stop>
      <el-checkbox-group v-model="draftNatures">
        <el-checkbox
          v-for="item in natureOptions"
          :key="item.value"
          :value="item.value"
        >
          {{ item.label }}
        </el-checkbox>
      </el-checkbox-group>
    </div>
  </el-popover>
</template>

<style scoped>
.nature-cell {
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--biz-table-row-height, 35px);
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.nature-cell:hover:not(:disabled) {
  background: var(--el-fill-color-light);
}

.nature-cell.is-loading {
  cursor: wait;
  opacity: 0.6;
}

.nature-cell.is-empty {
  justify-content: flex-start;
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

.text-muted {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

.nature-picker :deep(.el-checkbox-group) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nature-picker :deep(.el-checkbox) {
  margin-right: 0;
  height: auto;
}
</style>
