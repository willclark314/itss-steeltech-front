import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'
import { sqliteApiPlugin } from './server/vite-plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const useMock = env.VITE_USE_MOCK === 'true'

  return {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        imports: ['vue', 'vue-router'],
        dts: 'src/auto-imports.d.ts',
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: 'src/components.d.ts',
      }),
      ...(useMock ? [sqliteApiPlugin()] : []),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      open: true,
      ...(useMock
        ? {}
        : {
            proxy: {
              '/api': {
                target: env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
                changeOrigin: true,
              },
            },
          }),
    },
  }
})
