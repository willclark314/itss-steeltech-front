import { execFile } from 'node:child_process'
import fs from 'node:fs'
import { statfs } from 'node:fs/promises'
import os from 'node:os'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface HostDriveInfo {
  name: string
  label: string
  type: 'local' | 'share'
  totalBytes?: number
  freeBytes?: number
}

export function getLocalIPv4Addresses(): string[] {
  const ips = new Set<string>()
  const nets = os.networkInterfaces()

  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        ips.add(entry.address)
      }
    }
  }

  return [...ips]
}

export function isLocalHostIp(ip: string): boolean {
  const trimmed = ip.trim()
  if (!trimmed || trimmed === '127.0.0.1' || trimmed === 'localhost') {
    return true
  }
  return getLocalIPv4Addresses().includes(trimmed)
}

function listLocalDriveLetters(): HostDriveInfo[] {
  const drives: HostDriveInfo[] = []

  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code)
    try {
      if (fs.existsSync(`${letter}:\\`)) {
        drives.push({
          name: letter,
          label: `${letter}:`,
          type: 'local',
        })
      }
    } catch {
      // ignore inaccessible drive letters
    }
  }

  return drives
}

async function readLocalDriveSpace(letter: string) {
  try {
    const stat = await statfs(`${letter}:\\`)
    const unit = Number(stat.bsize)
    return {
      totalBytes: Number(stat.blocks) * unit,
      freeBytes: Number(stat.bavail) * unit,
    }
  } catch {
    return undefined
  }
}

async function listLocalDrivesWithSpace(): Promise<HostDriveInfo[]> {
  const drives = listLocalDriveLetters()
  return Promise.all(
    drives.map(async (drive) => {
      const space = await readLocalDriveSpace(drive.name)
      if (!space) return drive
      return { ...drive, ...space }
    }),
  )
}

function parseNetViewShares(stdout: string): HostDriveInfo[] {
  const shares: HostDriveInfo[] = []
  const seen = new Set<string>()

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    const match = trimmed.match(/^(\S+)\s+(Disk|Print|IPC|Special)/i)
    if (!match?.[1]) continue

    const name = match[1]
    if (name.endsWith('$') || seen.has(name.toLowerCase())) continue

    seen.add(name.toLowerCase())
    shares.push({
      name,
      label: name,
      type: 'share',
    })
  }

  return shares
}

async function listRemoteShares(ip: string): Promise<HostDriveInfo[]> {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('net', ['view', `\\\\${ip}`], {
        windowsHide: true,
        timeout: 15000,
      })
      const shares = parseNetViewShares(stdout)
      if (shares.length) return shares
    } catch {
      // fall through to admin share probing
    }
  }

  return probeAdminShares(ip)
}

async function probeAdminShares(ip: string): Promise<HostDriveInfo[]> {
  const shares: HostDriveInfo[] = []

  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code)
    const unc = `\\\\${ip}\\${letter}$`
    try {
      await fs.promises.access(unc, fs.constants.R_OK)
      shares.push({
        name: letter,
        label: `${letter}$`,
        type: 'share',
      })
    } catch {
      // ignore inaccessible admin shares
    }
  }

  return shares
}

export async function listHostDrives(ip: string) {
  const trimmed = ip.trim()
  if (!trimmed) {
    throw new Error('IP 不能为空')
  }
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
    throw new Error('IP 格式不正确')
  }

  const isLocal = isLocalHostIp(trimmed)
  const drives = isLocal ? await listLocalDrivesWithSpace() : await listRemoteShares(trimmed)

  return {
    ip: trimmed,
    isLocal,
    drives,
  }
}
