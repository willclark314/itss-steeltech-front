/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_USE_MOCK: string
  readonly VITE_API_PROXY_TARGET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'element-plus/dist/locale/zh-cn.mjs' {
  import type { Language } from 'element-plus/es/locale'
  const locale: Language
  export default locale
}
