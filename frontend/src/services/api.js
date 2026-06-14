const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const SESSION_KEY = 'educonnect.session'

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function rolePath(role) {
  if (role === 'administrator') return '/admin'
  if (role === 'teacher') return '/teacher'
  return '/student'
}

export function assetUrl(url) {
  if (!url) return '#'
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url}`
}

export function chatSocketUrl(token) {
  const base = API_BASE_URL.replace(/^http/, 'ws')
  return `${base}/ws/chat?token=${encodeURIComponent(token)}`
}

async function request(path, options = {}) {
  const session = getStoredSession()
  const headers = new Headers(options.headers || {})
  const hasBody = options.body !== undefined
  const isFormData = hasBody && options.body instanceof FormData

  if (hasBody && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  })

  const contentType = response.headers.get('Content-Type') || ''
  const data = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok) {
    throw new Error(data?.error || 'Action impossible')
  }
  return data
}

export async function login(email, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const session = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user || { name: data.name, role: data.role },
  }
  storeSession(session)
  return session
}

export function logout() {
  return request('/api/auth/logout', { method: 'POST' }).finally(clearSession)
}

export const api = {
  getProfile: () => request('/api/profile'),
  getUsers: () => request('/api/users'),
  createUser: (payload) =>
    request('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
  getServers: () => request('/api/servers'),
  createServer: (payload) =>
    request('/api/servers', { method: 'POST', body: JSON.stringify(payload) }),
  addServerMembers: (serverId, userIds) =>
    request(`/api/servers/${serverId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    }),
  getMessages: (channelId) => request(`/api/channels/${channelId}/messages`),
  sendMessage: (channelId, content) =>
    request(`/api/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  getFiles: (channelId) => request(`/api/channels/${channelId}/files`),
  uploadFile: (channelId, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(`/api/channels/${channelId}/files`, {
      method: 'POST',
      body: form,
    })
  },
}
