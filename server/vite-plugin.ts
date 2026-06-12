import fs from 'node:fs'
import type { Plugin } from 'vite'
import { createSqliteApiMiddleware } from './middleware'
import { MOCK_DATAS_URL_PREFIX, resolveMockDatasFilePath } from './paths'

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
