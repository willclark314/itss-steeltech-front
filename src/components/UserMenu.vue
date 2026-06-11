<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Moon, Sunny, User } from '@element-plus/icons-vue'
import { getDisplayName, removeToken } from '@/utils/auth'
import { useTheme } from '@/composables/useTheme'
import UserDetail from '@/components/UserDetail.vue'

const router = useRouter()
const userDetailRef = ref()
const { isDark, toggle: toggleTheme } = useTheme()

const displayName = computed(() => getDisplayName())

function handleCommand(command: string) {
  if (command === 'profile') {
    userDetailRef.value?.open()
  } else if (command === 'logout') {
    removeToken()
    router.push('/login')
  }
}
</script>

<template>
  <div class="user-menu-wrap">
    <el-dropdown
      class="user-dropdown"
      trigger="hover"
      @command="handleCommand"
    >
    <span class="user-trigger">
      <el-icon><User /></el-icon>
      <span>{{ displayName }}</span>
      <el-icon><ArrowDown /></el-icon>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="profile">用户信息</el-dropdown-item>
        <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>

    <el-button class="theme-btn" link @click="toggleTheme">
      <el-icon :size="16">
        <Moon v-if="!isDark" />
        <Sunny v-else />
      </el-icon>
    </el-button>

  <UserDetail ref="userDetailRef" />
  </div>
</template>

<style scoped>
.user-menu-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 16px;
}

.theme-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  color: #ffffffa6;
}

.theme-btn:hover {
  color: #fff;
}

.user-dropdown {
  flex-shrink: 0;
}

.user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #ffffffa6;
  font-size: 13px;
  cursor: pointer;
  outline: none;
}

.user-trigger:hover {
  color: #fff;
}
</style>
