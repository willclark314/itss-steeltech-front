const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function request<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('itss_token')
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    let message = `请求失败: ${response.status}`
    try {
      const payload = (await response.json()) as { message?: string }
      if (payload.message) message = payload.message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}
