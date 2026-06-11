const THEME_KEY = 'itss_theme'

export type Theme = 'light' | 'dark'

export function getStoredTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme): void {
  const isDark = theme === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light')
}

export function initTheme(): void {
  applyTheme(getStoredTheme())
}

export function toggleTheme(): Theme {
  const next = getStoredTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
