// src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('aegis_token')
}

export function setToken(token: string) {
  localStorage.setItem('aegis_token', token)
}

export function clearToken() {
  localStorage.removeItem('aegis_token')
  localStorage.removeItem('aegis_username')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// Auth
export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; username: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // Dashboard
  stats: () => request<{
    active_sessions: number
    total_sessions: number
    total_violations: number
    flagged_students: number
    live_count: number
  }>('/dashboard/stats'),

  // Exams
  getExams: () => request<Exam[]>('/exams'),
  createExam: (data: { title: string; duration_minutes: number; allowed_tabs?: number }) =>
    request<{ exam_id: string; session_code: string; title: string }>('/exams', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getExam: (id: string) => request<Exam>(`/exams/${id}`),

  // Sessions
  getSessions: (examId?: string) =>
    request<Session[]>(`/sessions${examId ? `?exam_id=${examId}` : ''}`),
  getSession: (id: string) => request<Session>(`/sessions/${id}`),
  getViolations: (sessionId: string) => request<Violation[]>(`/sessions/${sessionId}/violations`),
  getScreenshots: (sessionId: string) =>
    request<ScreenshotMeta[]>(`/sessions/${sessionId}/screenshots`),
  getScreenshotImage: (id: string) => request<{ image_data: string }>(`/screenshots/${id}/image`),
  getReport: (sessionId: string) => request<Report>(`/sessions/${sessionId}/report`),
}

export interface Exam {
  id: string
  title: string
  session_code: string
  duration_minutes: number
  allowed_tabs: number
  status: string
  created_by: string
  created_at: number
  started_at: number | null
  ended_at: number | null
}

export interface Session {
  id: string
  exam_id: string
  student_id: string
  student_name: string | null
  status: string
  risk_score: number
  attention_score: number
  flagged: number
  started_at: number
  ended_at: number | null
  last_heartbeat: number | null
}

export interface Violation {
  id: string
  session_id: string
  student_id: string
  exam_id: string
  violation_type: string
  severity: string
  risk_points: number
  metadata: string
  timestamp: number
}

export interface ScreenshotMeta {
  id: string
  session_id: string
  student_id: string
  trigger: string
  timestamp: number
}

export interface Report {
  session: Session
  violations: Violation[]
  screenshots: ScreenshotMeta[]
  summary: string
  risk_breakdown: Record<string, number>
  total_violations: number
}
