/** In-memory File copies created by snapshotFile (safe to re-read later). */
const memoryFiles = new WeakSet<File>()

export function isFileNotReadableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String((error as { name?: unknown }).name || '') : ''
  const message = 'message' in error ? String((error as { message?: unknown }).message || '') : ''
  return (
    name === 'NotReadableError' ||
    message.includes('could not be read') ||
    message.includes('permission problems that have occurred after a reference')
  )
}

export function fileReadErrorMessage(fileName: string): string {
  const label = fileName?.trim() || '所选文件'
  return `无法读取「${label}」。请将文件复制到本地磁盘后重新选择（OneDrive/网盘/网络盘上的文件常见此问题）。`
}

/** Read file once into memory so later save no longer depends on the original path. */
export async function snapshotFile(file: File): Promise<File> {
  if (memoryFiles.has(file)) return file
  try {
    const buffer = await file.arrayBuffer()
    const snapped = new File([buffer], file.name, {
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified,
    })
    memoryFiles.add(snapped)
    return snapped
  } catch (error) {
    if (isFileNotReadableError(error)) {
      throw new Error(fileReadErrorMessage(file.name))
    }
    throw error
  }
}

export async function withFileReadGuard<T>(fileName: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (isFileNotReadableError(error)) {
      throw new Error(fileReadErrorMessage(fileName))
    }
    throw error
  }
}
