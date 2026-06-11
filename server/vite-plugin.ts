import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { createSqliteApiMiddleware } from './middleware'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function sqliteApiPlugin(): Plugin {
  return {
    name: 'vite-sqlite-api',
    configureServer(server) {
      server.middlewares.use(createSqliteApiMiddleware())

      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/datas/')) {
          next()
          return
        }

        const relativePath = req.url.split('?')[0].replace(/^\//, '')
        const filePath = path.join(rootDir, relativePath)

        if (!filePath.startsWith(path.join(rootDir, 'datas')) || !fs.existsSync(filePath)) {
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
