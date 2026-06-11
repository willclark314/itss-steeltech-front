import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { runMigrations } from './migrate'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dbPath = path.join(rootDir, 'datas', 'steeltech.db')

let database: Database.Database | null = null

export function getDb() {
  if (!database) {
    if (!fs.existsSync(dbPath)) {
      throw new Error(`SQLite 数据库不存在: ${dbPath}，请先运行 npm run db:init`)
    }
    database = new Database(dbPath)
    database.pragma('foreign_keys = ON')
    runMigrations(database)
  }
  return database
}
