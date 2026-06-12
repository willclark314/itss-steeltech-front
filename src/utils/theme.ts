/** localStorage 中保存主题偏好的键名 */
const THEME_KEY = 'itss_theme'

/** 应用支持的主题模式，与 Element Plus 暗色模式配合使用 */
export type Theme = 'light' | 'dark'

/**
 * 读取用户上次选择的主题。
 * 未设置或非 `light` 时默认返回 `dark`。
 */
export function getStoredTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
}

/**
 * 应用主题并持久化。
 * 通过在 `<html>` 上切换 `dark` class 触发全局暗色样式（见 `src/styles/index.css`）。
 */
export function applyTheme(theme: Theme): void {
  const isDark = theme === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light')
}

/** 应用启动时调用，恢复用户上次保存的主题，避免刷新后闪烁 */
export function initTheme(): void {
  applyTheme(getStoredTheme())
}

/** 在明暗主题间切换，返回切换后的主题值 */
export function toggleTheme(): Theme {
  const next = getStoredTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
