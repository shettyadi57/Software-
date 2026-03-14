'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated, api, Session } from '@/lib/api'
import Sidebar from '@/components/Sidebar'
import RiskBar from '@/components/RiskBar'
import { useLiveEvents } from '@/lib/useLive'
import { formatDistanceToNow } from 'date-fns'

export default function StudentsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [router])

  async function load() {
    try {
      if (loading) setLoading(true)
      setSessions(await api.getSessions())
    } finally { setLoading(false) }
  }

  const { connected, liveState } = useLiveEvents(() => load())

  const allSessions = sessions.map(s => ({
    ...s,
    isLive: !!liveState[s.id],
    liveData: liveState[s.id],
  }))

  const sorted = [...allSessions].sort((a, b) => {
    if (a.isLive && !b.isLive) return -1
    if (!a.isLive && b.isLive) return 1
    return (b.risk_score || 0) - (a.risk_score || 0)
  })

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="ml-56 flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Students</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              All students across all exams
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
            style={{ background: connected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: connected ? '#34d399' : '#f87171',
              border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            {connected ? <><span className="live-dot mr-1.5" />Live</> : '○ Offline'}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {sorted.map(s => {
              const risk = s.liveData?.risk_score ?? s.risk_score ?? 0
              const attn = s.liveData?.attention_score ?? s.attention_score ?? 100
              const isFlagged = s.flagged === 1 || risk >= 60
              return (
                <div key={s.id}
                  className="card cursor-pointer hover:border-blue-500 transition-all fade-in"
                  style={isFlagged ? { borderColor: 'rgba(239,68,68,0.4)' } : {}}
                  onClick={() => router.push(`/sessions/${s.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold"
                          style={{ background: s.isLive ? 'rgba(59,130,246,0.2)' : 'var(--bg-hover)', color: s.isLive ? '#60a5fa' : 'var(--text-secondary)', fontSize: 14 }}>
                          {(s.student_id || '?')[0]?.toUpperCase()}
                        </div>
                        {s.isLive && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                            style={{ background: '#10b981', borderColor: 'var(--bg-card)' }} />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{s.student_id}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {s.isLive ? (
                            <span style={{ color: '#10b981' }}>● Active now</span>
                          ) : s.last_heartbeat ? (
                            formatDistanceToNow(new Date(s.last_heartbeat * 1000), { addSuffix: true })
                          ) : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {isFlagged && <span className="badge badge-danger" style={{ fontSize: 9 }}>FLAGGED</span>}
                      {s.isLive && <span className="badge badge-success" style={{ fontSize: 9 }}>LIVE</span>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'var(--text-muted)' }}>Attention</span>
                        <span style={{ color: attn >= 70 ? '#34d399' : attn >= 40 ? '#fbbf24' : '#f87171' }}>
                          {attn.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full rounded-full" style={{ background: 'var(--bg-hover)', height: 4 }}>
                        <div className="rounded-full transition-all" style={{
                          width: `${Math.min(100, attn)}%`, height: 4,
                          background: attn >= 70 ? '#10b981' : attn >= 40 ? '#f59e0b' : '#ef4444'
                        }} />
                      </div>
                    </div>
                    <RiskBar score={risk} height={4} />
                  </div>

                  <div className="mt-3 pt-3 border-t flex justify-between text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <span>Session: {s.id.slice(5, 17)}...</span>
                    <span style={{ color: 'var(--accent)' }}>Details →</span>
                  </div>
                </div>
              )
            })}

            {sorted.length === 0 && (
              <div className="col-span-3 flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">👥</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No students yet</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Students will appear when they start an exam
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
