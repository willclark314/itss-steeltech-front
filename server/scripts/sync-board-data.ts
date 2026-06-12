import fs from 'node:fs'
import Database from 'better-sqlite3'
import { replaceBoardData } from '../seed-board.ts'
import { SERVER_DB_PATH } from '../paths.ts'

const dbPath = SERVER_DB_PATH

if (!fs.existsSync(dbPath)) {
  throw new Error(`SQLite 数据库不存在: ${dbPath}，请先运行 npm run db:init`)
}

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

const before = {
  personnel: (db.prepare('SELECT COUNT(*) AS count FROM personnel').get() as { count: number })
    .count,
  projects: (db.prepare('SELECT COUNT(*) AS count FROM projects').get() as { count: number })
    .count,
  contacts: (db.prepare('SELECT COUNT(*) AS count FROM contact_forms').get() as { count: number })
    .count,
}

replaceBoardData(db)

const after = {
  personnel: (db.prepare('SELECT COUNT(*) AS count FROM personnel').get() as { count: number })
    .count,
  projects: (db.prepare('SELECT COUNT(*) AS count FROM projects').get() as { count: number })
    .count,
  contacts: (db.prepare('SELECT COUNT(*) AS count FROM contact_forms').get() as { count: number })
    .count,
}

const samplePersonnel = db
  .prepare('SELECT id, name FROM personnel ORDER BY id LIMIT 5')
  .all() as Array<{ id: string; name: string }>

db.close()

console.log('看板数据已同步到 SQLite:')
console.log(`- 人员: ${before.personnel} -> ${after.personnel}`)
console.log(`- 项目: ${before.projects} -> ${after.projects}`)
console.log(`- 联系单: ${before.contacts} -> ${after.contacts}`)
console.log(`- 示例人员: ${samplePersonnel.map((item) => `${item.id}:${item.name}`).join(', ')}`)
