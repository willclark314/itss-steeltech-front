import { BusinessSystemConfig, type LocalWorkPathConfig } from '../src/models/biz/BusinessSystemConfig.ts'
import { getDb } from './db'

const SETTINGS_KEY = 'local_work_path'

let cachedConfig: LocalWorkPathConfig = {
  ip: BusinessSystemConfig.LOCAL_WORK_PATH.ip,
  drive: BusinessSystemConfig.LOCAL_WORK_PATH.drive,
}
let loaded = false

function normalizeConfig(config: LocalWorkPathConfig): LocalWorkPathConfig {
  return {
    ip: config.ip.trim(),
    drive: BusinessSystemConfig.normalizeDrive(config.drive),
  }
}

export function getLocalWorkPathConfig() {
  if (!loaded) {
    loadSystemConfigFromDb()
  }
  return { ...cachedConfig }
}

export function loadSystemConfigFromDb() {
  try {
    const db = getDb()
    const row = db
      .prepare('SELECT value FROM system_settings WHERE key = ?')
      .get(SETTINGS_KEY) as { value: string } | undefined

    if (row?.value) {
      const parsed = JSON.parse(row.value) as Partial<LocalWorkPathConfig>
      cachedConfig = normalizeConfig({
        ip: String(parsed.ip ?? BusinessSystemConfig.LOCAL_WORK_PATH.ip),
        drive: String(parsed.drive ?? BusinessSystemConfig.LOCAL_WORK_PATH.drive),
      })
    }
  } catch {
    cachedConfig = {
      ip: BusinessSystemConfig.LOCAL_WORK_PATH.ip,
      drive: BusinessSystemConfig.LOCAL_WORK_PATH.drive,
    }
  } finally {
    loaded = true
  }
}

export function saveLocalWorkPathConfig(config: LocalWorkPathConfig) {
  const normalized = normalizeConfig(config)
  const db = getDb()

  db.prepare(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now', 'localtime'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
  ).run(SETTINGS_KEY, JSON.stringify(normalized))

  cachedConfig = { ...normalized }
  loaded = true
  return { ...normalized }
}
