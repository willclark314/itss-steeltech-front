import { request } from './request'

export type DbSyncMode = 'upsert' | 'replace'

export interface DbMigrateStatus {
  current_backend: string
  current_url_masked: string
  suggested_target_backend: string
  note: string
}

export interface DbMigrateSwitchInstructions {
  target_backend: string
  target_url_masked: string
  steps: string[]
  note: string
}

export interface DbMigrateSyncResult {
  tables: number
  rows: number
  errors: number
  per_table?: Record<string, number>
}

export interface DbMigrateVerifyResult {
  ok: boolean
  matched: number
  mismatches: Array<{
    table: string
    source_count: number
    target_count: number
  }>
  only_source: string[]
  only_target: string[]
}

export interface DbMigrateResult {
  ok?: boolean
  message?: string
  dry_run?: boolean
  mode?: DbSyncMode
  source_backend?: string
  target_backend?: string
  sync?: DbMigrateSyncResult
  verify?: DbMigrateVerifyResult | null
  switch_instructions?: DbMigrateSwitchInstructions
  logs?: string[]
  backup?: Record<string, unknown>
}

export function fetchDbMigrateStatus() {
  return request<DbMigrateStatus>('/system/db-migrate/status')
}

export function previewDbMigrate(targetUrl: string) {
  return request<DbMigrateResult>('/system/db-migrate/preview', {
    method: 'POST',
    body: JSON.stringify({ target_url: targetUrl }),
  })
}

export function runDbMigrate(payload: {
  targetUrl: string
  mode?: DbSyncMode
  backupFirst?: boolean
}) {
  return request<DbMigrateResult>('/system/db-migrate/run', {
    method: 'POST',
    body: JSON.stringify({
      target_url: payload.targetUrl,
      mode: payload.mode ?? 'upsert',
      backup_first: payload.backupFirst ?? true,
    }),
  })
}

export function verifyDbMigrate(targetUrl: string) {
  return request<DbMigrateResult>('/system/db-migrate/verify', {
    method: 'POST',
    body: JSON.stringify({ target_url: targetUrl }),
  })
}
