import type { IncomingMessage, ServerResponse } from 'node:http'

export interface ApiContext {
  method: string
  pathname: string
  query: URLSearchParams
  body: unknown
  authorization?: string
}

export function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

export function sendError(res: ServerResponse, status: number, message: string) {
  sendJson(res, status, { message })
}

export async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf-8').trim()
  if (!raw) return {}
  return JSON.parse(raw) as unknown
}

export function matchRoute(pathname: string, pattern: string) {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)

  if (patternParts.length !== pathParts.length) {
    return null
  }

  const params: Record<string, string> = {}

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index]
    const pathPart = pathParts[index]

    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = pathPart
      continue
    }

    if (patternPart !== pathPart) {
      return null
    }
  }

  return params
}
