import type { Connect } from 'vite'
import { handleApiRequest } from './router'

export function createSqliteApiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url?.startsWith('/api')) {
      next()
      return
    }

    void handleApiRequest(req, res, req.url)
  }
}
