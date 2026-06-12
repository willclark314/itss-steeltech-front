import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SERVER_ROOT = currentDir
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..')
export const SERVER_DATAS_DIR = path.join(SERVER_ROOT, 'datas')
export const SERVER_DB_PATH = path.join(SERVER_DATAS_DIR, 'steeltech.db')
export const SERVER_SCHEMA_PATH = path.join(SERVER_DATAS_DIR, 'schema.sql')
export const SERVER_BOARD_XLSX_PATH = path.join(SERVER_DATAS_DIR, '联系单看板.xlsx')

/** Mock 静态资源 URL 前缀，映射到 server/datas 目录 */
export const MOCK_DATAS_URL_PREFIX = '/datas'
export const CONTACT_PDF_URL_DIR = 'datas/files/contact-pdfs'
export const CONTACT_PDF_ROOT = path.join(SERVER_DATAS_DIR, 'files', 'contact-pdfs')

export function resolveMockDatasFilePath(urlPath: string) {
  const relativePath = urlPath.replace(/^\//, '')
  if (!relativePath.startsWith('datas/')) {
    return null
  }

  const filePath = path.join(PROJECT_ROOT, relativePath.replace(/^datas\//, 'server/datas/'))
  const normalizedRoot = path.join(SERVER_DATAS_DIR)
  if (!filePath.startsWith(normalizedRoot)) {
    return null
  }

  return filePath
}
