const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const SESSION_EXPIRED_MESSAGE = '登录已过期，请重新登录'

let authRedirecting = false

async function handleAuthFailure(): Promise<void> {
  if (authRedirecting) return
  authRedirecting = true

  try {
    const [{ ElMessage }, { removeToken }] = await Promise.all([
      import('element-plus'),
      import('@/utils/auth'),
    ])
    removeToken()
    ElMessage.warning(SESSION_EXPIRED_MESSAGE)
  } catch {
    // ignore
  }

  if (window.location.hash !== '#/login') {
    window.location.hash = '#/login'
  }
}

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
    // 401 未登录；422 为 JWT 无效/过期（Flask-JWT-Extended 默认行为）
    if (response.status === 401 || response.status === 422) {
      await handleAuthFailure()
      throw new Error(SESSION_EXPIRED_MESSAGE)
    }

    let message = `请求失败: ${response.status}`
    try {
      const payload = (await response.json()) as { message?: string; msg?: string }
      if (payload.message) message = payload.message
      else if (payload.msg) message = payload.msg
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}
