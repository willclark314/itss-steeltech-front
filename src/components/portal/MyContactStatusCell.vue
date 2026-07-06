<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { updateContact } from '@/api/contacts'
import { ContactForm } from '@/models/biz/contact'
import type { ContactRecord, ContactStatus } from '@/models/biz/contact'

const props = defineProps<{
  contact: ContactRecord
  loadingKey?: string
}>()

const emit = defineEmits<{
  updated: [contact: ContactRecord]
  saving: [key: string]
  saved: [key: string]
}>()

const statusOptions = ContactForm.STATUS_OPTIONS.filter((item) => item.value)

function getStatusMeta(status: ContactStatus) {
  return ContactForm.STATUS_MAP[status]
}

function canEditStatus() {
  return ContactForm.wrap(props.contact).canEdit()
}

function isLoading() {
  return props.loadingKey === props.contact.id
}

async function handleStatusChange(status: ContactStatus) {
  if (status === props.contact.status) return

  const key = props.contact.id
  emit('saving', key)
  try {
    const updated = await updateContact(props.contact.id, { status })
    emit('updated', updated)
    ElMessage.success('状态已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存状态失败')
  } finally {
    emit('saved', key)
  }
}
</script>

<template>
  <div class="contact-status-cell">
    <el-dropdown
      v-if="canEditStatus()"
      trigger="click"
      @command="handleStatusChange"
    >
      <el-tag
        size="small"
        :type="getStatusMeta(contact.status).type"
        class="cell-tag cell-tag--clickable"
        :class="{ 'is-loading': isLoading() }"
        @click.stop
      >
        {{ getStatusMeta(contact.status).label }}
      </el-tag>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="option in statusOptions"
            :key="option.value"
            :command="option.value"
            :disabled="option.value === contact.status"
          >
            {{ option.label }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <el-tag
      v-else
      size="small"
      :type="getStatusMeta(contact.status).type"
      class="cell-tag"
    >
      {{ getStatusMeta(contact.status).label }}
    </el-tag>
  </div>
</template>

<style scoped>
.contact-status-cell {
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--biz-table-row-height, 35px);
}

.cell-tag.is-loading {
  opacity: 0.6;
  cursor: wait;
}
</style>
