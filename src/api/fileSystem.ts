import { request } from './request'

export interface OpenFolderResponse {
  success: boolean
  path: string
}

export function openFolder(folderPath: string) {
  return request<OpenFolderResponse>('/file-system/open-folder', {
    method: 'POST',
    body: JSON.stringify({ path: folderPath }),
  })
}
