<script setup lang="ts">
export type AttachmentIconItem = {
  id: string | number
  name: string
  url?: string | null
}

withDefaults(
  defineProps<{
    files: AttachmentIconItem[]
  }>(),
  {
    files: () => [],
  },
)

function openAttachment(file: AttachmentIconItem) {
  if (file.url) {
    window.open(file.url, '_blank')
  }
}
</script>

<template>
  <el-popover
    v-if="files.length"
    placement="top"
    :width="320"
    trigger="hover"
    :show-after="200"
    :hide-after="120"
    popper-class="attachment-icons-popover"
  >
    <div class="attachment-popover-list">
      <button
        v-for="file in files"
        :key="file.id"
        type="button"
        class="attachment-popover-item"
        :class="{ 'is-disabled': !file.url }"
        :disabled="!file.url"
        :title="file.name"
        @click.stop="openAttachment(file)"
      >
        <el-icon class="attachment-popover-item__icon">
          <Document />
        </el-icon>
        <span class="attachment-popover-item__name">{{ file.name }}</span>
      </button>
    </div>
    <template #reference>
      <div class="attachment-cell">
        <div class="attachment-icons">
          <span
            v-for="file in files"
            :key="file.id"
            class="pdf-icon-wrap"
            :class="{ 'is-clickable': !!file.url }"
            @click.stop="openAttachment(file)"
          >
            <el-icon class="pdf-icon">
              <Document />
            </el-icon>
          </span>
        </div>
      </div>
    </template>
  </el-popover>
  <span v-else class="text-muted">-</span>
</template>

<style scoped>
.attachment-cell {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.attachment-icons {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  max-width: 100%;
  overflow: hidden;
}

.pdf-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: #fff1f0;
}

.pdf-icon-wrap.is-clickable {
  cursor: pointer;
}

.pdf-icon-wrap.is-clickable:hover {
  background: #ffccc7;
}

.pdf-icon {
  font-size: 16px;
  color: #cf1322;
}
</style>

<style>
.attachment-icons-popover {
  padding: 6px !important;
}

.attachment-icons-popover .attachment-popover-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 260px;
  overflow: auto;
}

.attachment-icons-popover .attachment-popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 6px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.attachment-icons-popover .attachment-popover-item:hover:not(.is-disabled) {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.attachment-icons-popover .attachment-popover-item.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.attachment-icons-popover .attachment-popover-item__icon {
  flex-shrink: 0;
  font-size: 16px;
  color: #cf1322;
}

.attachment-icons-popover .attachment-popover-item__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
