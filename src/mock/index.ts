/**
 * 开发阶段 Mock 已迁移至 Vite 服务端中间件。
 *
 * 当 VITE_USE_MOCK=true 时：
 * - 前端统一通过 src/api/request.ts 请求 /api/*
 * - server/ 目录下的 SQLite API 中间件读取 datas/steeltech.db 并返回 JSON
 *
 * 参见 server/router.ts 与 npm run db:init
 */

export {}
