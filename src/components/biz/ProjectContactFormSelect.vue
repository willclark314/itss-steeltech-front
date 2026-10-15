<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fetchContactList } from '@/api/contacts'
import { ContactForm } from '@/models/biz/contact'
import type { ContactRecord } from '@/models/biz/contact'

const model = defineModel<string[]>({ default: () => [] })

const props = withDefaults(
  defineProps<{
    displayProjectNo?: string
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    displayProjectNo: '',
    placeholder: '输入联系单号、项目号或联系主题搜索',
    disabled: false,
  },
)

const searchResults = ref<ContactRecord[]>([])
let searchTimer: ReturnType<typeof setTimeout> | undefined

const optionRecords = computed(() => {
  const map = new Map<string, ContactRecord>()
  for (const record of searchResults.value) {
    map.set(record.id, record)
  }
  return map
})

function formatContactLabel(contactFormId: string) {
  const record = optionRecords.value.get(contactFormId)
  if (record) {
    return ContactForm.formatOptionLabel(record)
  }
  return ContactForm.formatDisplayId(contactFormId, props.displayProjectNo || undefined)
}

async function searchContacts(query: string) {
  const keyword = query.trim()
  if (!keyword) {
    searchResults.value = []
    return
  }

  try {
    const result = await fetchContactList({ keyword, pageSize: 20 })
    searchResults.value = result.list
  } catch {
    searchResults.value = []
  }
}

function filterContacts(query: string) {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void searchContacts(query)
  }, 300)
}

async function preloadSelectedContacts(ids: string[]) {
  const missing = ids.filter((id) => !optionRecords.value.has(id))
  if (!missing.length) return

  try {
    const result = await fetchContactList({ keyword: missing[0], pageSize: 20 })
    const next = new Map(optionRecords.value)
    for (const record of result.list) {
      next.set(record.id, record)
    }
    searchResults.value = [...next.values()]
  } catch {
    // 保留已选 ID 的格式化展示即可
  }
}

watch(
  () => [...model.value],
  (ids) => {
    if (!ids.length) return
    void preloadSelectedContacts(ids)
  },
  { immediate: true },
)
</script>

<template>
  <el-select
    v-model="model"
    multiple
    filterable
    clearable
    :filter-method="filterContacts"
    :disabled="disabled"
    :placeholder="placeholder"
    no-data-text="未找到匹配的联系单"
    style="width: 100%"
  >
    <el-option
      v-for="contactFormId in model"
      :key="`selected-${contactFormId}`"
      :label="formatContactLabel(contactFormId)"
      :value="contactFormId"
    />
    <el-option
      v-for="item in searchResults.filter((record) => !model.includes(record.id))"
      :key="item.id"
      :label="ContactForm.formatOptionLabel(item)"
      :value="item.id"
    >
      <div class="contact-option">
        <span class="contact-option__main">{{ ContactForm.formatOptionLabel(item) }}</span>
        <span v-if="item.projectNos?.length" class="contact-option__sub">
          项目号：{{ item.projectNos.join('、') }}
        </span>
      </div>
    </el-option>
  </el-select>
</template>

<style scoped>
.contact-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
}

.contact-option__main {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.contact-option__sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
