'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isAuthenticated, api, Session } from '@/lib/api'
import Sidebar from '@/components/Sidebar'
import RiskBar from '@/components/RiskBar'
import { format, formatDistanceToNow } from 'date-fns'

export default function SessionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const examIdFilter = searchParams.get('exam_id')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'flagged' | 'ended'>('all')

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    load()
  }, [router, examIdFilter])

  async function load() {
    try {
      setLoading(true)
      setSessions(await api.getSessions(examIdFilter || undefined))
    } finally { setLoading(false) }
  }

  const filtered = sessions.filter(s => {
    if (filter === 'active') return s.status === 'active'
    if (filter === 'flagged') return s.flagged === 1
    if (filter === 'ended') return s.status === 'ended'
    return true
  })

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="ml-56 flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Sessions</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {examIdFilter ? `Filtered by exam` : 'All exam sessions'}
            </p>
          </div>
          {examIdFilter && (
            <button onClick={() => router.push('/sessions')}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              ✕ Clear filter
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {(['all', 'active', 'flagged', 'ended'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={filter === f
                ? { background: 'var(--accent)', color: 'white' }
                : { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              {f}
              {f === 'flagged' && sessions.filter(s => s.flagged).length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-red-500 text-white">
                  {sessions.filter(s => s.flagged).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading sessions...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-3">🎥</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No sessions found</div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-hover)' }}>
                  {['Student', 'Status', 'Risk Score', 'Attention', 'Started', 'Duration', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const duration = s.ended_at && s.started_at
                    ? Math.round((s.ended_at - s.started_at) / 60)
                    : s.started_at ? Math.round((Date.now() / 1000 - s.started_at) / 60) : 0
                  return (
                    <tr key={s.id} className="border-t cursor-pointer transition-all hover:bg-blue-900/10"
                      style={{ borderColor: 'var(--border)' }}
                      onClick={() => router.push(`/sessions/${s.id}`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: 'var(--accent)', color: 'white' }}>
                            {(s.student_id || '?')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{s.student_id}</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.id.slice(0, 12)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={s.status === 'active' ? 'badge badge-success' : 'badge badge-gray'}>
                            {s.status}
                          </span>
                          {s.flagged === 1 && <span className="badge badge-danger">⚑ Flagged</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <RiskBar score={s.risk_score || 0} height={4} />
                        <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                          {(s.risk_score || 0).toFixed(0)}/100
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold"
                          style={{ color: (s.attention_score || 100) >= 70 ? '#34d399' : (s.attention_score || 100) >= 40 ? '#fbbf24' : '#f87171' }}>
                          {(s.attention_score || 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {s.started_at ? format(new Date(s.started_at * 1000), 'dd MMM HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {duration} min
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'var(--accent)' }}>View →</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
