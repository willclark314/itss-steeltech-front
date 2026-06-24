import fs from 'node:fs'
import Database from 'better-sqlite3'
import { SERVER_DATAS_DIR, SERVER_DB_PATH, SERVER_SCHEMA_PATH } from '../paths.ts'

fs.mkdirSync(SERVER_DATAS_DIR, { recursive: true })

if (fs.existsSync(SERVER_DB_PATH)) {
  fs.unlinkSync(SERVER_DB_PATH)
}

const db = new Database(SERVER_DB_PATH)
db.pragma('foreign_keys = ON')
db.exec(fs.readFileSync(SERVER_SCHEMA_PATH, 'utf-8'))
db.close()

console.log(`SQLite 数据库已初始化（空表）: ${SERVER_DB_PATH}`)
