import { ref } from 'vue'
import { applyTheme, getStoredTheme } from '@/utils/theme'

const isDark = ref(getStoredTheme() === 'dark')

export function useTheme() {
  function setDark(value: boolean) {
    isDark.value = value
    applyTheme(value ? 'dark' : 'light')
  }

  function toggle() {
    setDark(!isDark.value)
  }

  return {
    isDark,
    setDark,
    toggle,
  }
}
