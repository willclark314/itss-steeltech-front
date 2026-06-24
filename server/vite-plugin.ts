import fs from 'node:fs'
import type { Plugin } from 'vite'
import { isLocalSystemApiRequest } from './local-system-routes'
import { createSqliteApiMiddleware } from './middleware'
import { handleApiRequest } from './router'
import { MOCK_DATAS_URL_PREFIX, resolveMockDatasFilePath } from './paths'

/** 联调 Docker/远程后端时，将依赖本机文件系统的系统接口留在 Vite 本地处理 */
export function localSystemApiPlugin(): Plugin {
  return {
    name: 'vite-local-system-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!isLocalSystemApiRequest(req.url, req.method)) {
          next()
          return
        }

        void handleApiRequest(req, res, req.url!)
      })
    },
  }
}

export function sqliteApiPlugin(): Plugin {
  return {
    name: 'vite-sqlite-api',
    configureServer(server) {
      server.middlewares.use(createSqliteApiMiddleware())

      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(`${MOCK_DATAS_URL_PREFIX}/`)) {
          next()
          return
        }

        const filePath = resolveMockDatasFilePath(req.url.split('?')[0])
        if (!filePath || !fs.existsSync(filePath)) {
          next()
          return
        }

        if (filePath.endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf')
        }

        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}
