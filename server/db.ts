import fs from 'node:fs'
import Database from 'better-sqlite3'
import { runMigrations } from './migrate'
import { SERVER_DB_PATH } from './paths'

let database: Database.Database | null = null

export function getDb() {
  if (!database) {
    if (!fs.existsSync(SERVER_DB_PATH)) {
      throw new Error(`SQLite 数据库不存在: ${SERVER_DB_PATH}，请先运行 npm run db:init`)
    }
    database = new Database(SERVER_DB_PATH)
    database.pragma('foreign_keys = ON')
    runMigrations(database)
  }
  return database
}
