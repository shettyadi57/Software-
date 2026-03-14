'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated, api } from '@/lib/api'
import { useLiveEvents, LiveEvent } from '@/lib/useLive'
import Sidebar from '@/components/Sidebar'
import StatCard from '@/components/StatCard'
import RiskBar, { riskColor, riskLabel } from '@/components/RiskBar'
import { format, formatDistanceToNow } from 'date-fns'

const VIOLATION_ICONS: Record<string, string> = {
  tab_switch: '🔀', window_blur: '👁️', copy_attempt: '📋', paste_attempt: '📌',
  shortcut_blocked: '⌨️', face_missing: '😶', multiple_faces: '👥', looking_away: '👀',
  voice_detected: '🎙️', devtools_opened: '🔧', resolution_change: '🖥️',
  screen_share_detected: '📡', phone_detected: '📱', screenshot_taken: '📸',
}
const SEVERITY_BADGE: Record<string, string> = {
  critical: 'badge badge-danger', high: 'badge badge-warning',
  medium: 'badge badge-info', low: 'badge badge-gray',
}

function severityOrder(s: string) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s] ?? 0
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({ active_sessions: 0, total_sessions: 0, total_violations: 0, flagged_students: 0, live_count: 0 })
  const [alertCount, setAlertCount] = useState(0)
  const alertsRef = useRef<LiveEvent[]>([])
  const [recentAlerts, setRecentAlerts] = useState<LiveEvent[]>([])
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    loadStats()
    const t = setInterval(loadStats, 15000)
    return () => clearInterval(t)
  }, [router])

  async function loadStats() {
    try { setStats(await api.stats()) } catch {}
  }

  const { connected, liveState, events } = useLiveEvents((evt) => {
    if (evt.type === 'violation') {
      alertsRef.current = [evt, ...alertsRef.current].slice(0, 50)
      setRecentAlerts([...alertsRef.current])
      setAlertCount(c => c + 1)
    }
    if (evt.type === 'heartbeat') forceUpdate(n => n + 1)
  })

  const activeSessions = Object.entries(liveState)
  const flaggedSessions = activeSessions.filter(([, s]) => s.risk_score >= 60)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="ml-56 flex-1 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Live Dashboard</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Real-time exam integrity monitoring
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${connected ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
              <span className={connected ? 'live-dot' : ''} style={connected ? {} : { width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              {connected ? 'Live' : 'Reconnecting...'}
            </div>
            {alertCount > 0 && (
              <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-900/30 text-red-400 border border-red-800">
                ⚠️ {alertCount} alerts
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Live Students" value={activeSessions.length} icon="🟢" color="green" sub="WebSocket active" />
          <StatCard label="Total Sessions" value={stats.total_sessions} icon="📁" color="blue" />
          <StatCard label="Violations" value={stats.total_violations} icon="⚠️" color="yellow" sub="All time" />
          <StatCard label="Flagged" value={flaggedSessions.length} icon="🚩" color="red" sub="Risk ≥ 60" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Live Students Grid */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Active Students</h2>
              <span className="badge badge-info">{activeSessions.length} online</span>
            </div>
            {activeSessions.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">👥</div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No active students</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Waiting for connections...</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {activeSessions.map(([sessionId, s]) => {
                  const risk = s.risk_score || 0
                  const attn = s.attention_score || 100
                  const color = riskColor(risk)
                  const label = riskLabel(risk)
                  const isFlagged = risk >= 60
                  return (
                    <div key={sessionId}
                      className="card cursor-pointer hover:border-blue-500 transition-all fade-in"
                      style={isFlagged ? { borderColor: 'rgba(239,68,68,0.5)' } : {}}
                      onClick={() => router.push(`/sessions/${sessionId}`)}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ background: 'var(--accent)', color: 'white' }}>
                              {(s.student_id || '?')[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">{s.student_id}</div>
                              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {s.last_seen ? formatDistanceToNow(new Date(s.last_seen * 1000), { addSuffix: true }) : '—'}
                              </div>
                            </div>
                          </div>
                        </div>
                        {isFlagged && <span className="badge badge-danger">FLAGGED</span>}
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
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Live Alert Feed */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Alert Feed</h2>
              {alertCount > 0 && (
                <button className="text-xs" style={{ color: 'var(--text-muted)' }}
                  onClick={() => { setAlertCount(0); alertsRef.current = []; setRecentAlerts([]) }}>
                  Clear
                </button>
              )}
            </div>
            <div className="card p-0 overflow-hidden">
              <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
                {recentAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="text-3xl mb-2">✅</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No alerts yet</div>
                  </div>
                ) : (
                  recentAlerts.map((evt, i) => (
                    <div key={i} className={`flex gap-3 px-4 py-3 border-b fade-in ${severityOrder(evt.severity) >= 3 ? 'bg-red-900/10' : ''}`}
                      style={{ borderColor: 'var(--border)' }}>
                      <span className="text-base mt-0.5">{VIOLATION_ICONS[evt.violation_type] || '⚠️'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white truncate">{evt.student_id}</span>
                          <span className={SEVERITY_BADGE[evt.severity] || 'badge badge-gray'} style={{ fontSize: 9 }}>
                            {evt.severity}
                          </span>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {(evt.violation_type || '').replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {evt.timestamp ? format(new Date(evt.timestamp * 1000), 'HH:mm:ss') : '—'}
                          {evt.risk_delta ? ` · +${evt.risk_delta} risk` : ''}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
