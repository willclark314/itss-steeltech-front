import { createApp } from 'vue'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import { fetchCurrentUser } from '@/api/auth'
import { getToken, getUser, setUser } from '@/utils/auth'
import { initTheme } from '@/utils/theme'
import './styles/index.css'

initTheme()

async function bootstrap() {
  if (getToken()) {
    try {
      const { user } = await fetchCurrentUser()
      const stored = getUser()
      setUser({ ...stored, ...user, password: stored?.password })
    } catch {
      // 保留本地会话，由接口层在 401 时跳转登录
    }
  }

  const app = createApp(App)

  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  app.use(router)
  app.mount('#app')
}

bootstrap()
