'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated, api, Session, Violation, ScreenshotMeta, Report } from '@/lib/api'
import Sidebar from '@/components/Sidebar'
import RiskBar from '@/components/RiskBar'
import { format } from 'date-fns'
import '@/lib/chartSetup'
import { Line, Bar } from 'react-chartjs-2'

const VIOLATION_ICONS: Record<string, string> = {
  tab_switch: '🔀', window_blur: '👁️', copy_attempt: '📋', paste_attempt: '📌',
  shortcut_blocked: '⌨️', face_missing: '😶', multiple_faces: '👥', looking_away: '👀',
  voice_detected: '🎙️', devtools_opened: '🔧', resolution_change: '🖥️',
  screen_share_detected: '📡', phone_detected: '📱',
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#94a3b8',
}

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [screenshots, setScreenshots] = useState<ScreenshotMeta[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'violations' | 'screenshots' | 'report'>('overview')
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const [loadingImg, setLoadingImg] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    loadAll()
  }, [params.id])

  async function loadAll() {
    try {
      setLoading(true)
      const [sess, viols, shots, rep] = await Promise.all([
        api.getSession(params.id),
        api.getViolations(params.id),
        api.getScreenshots(params.id),
        api.getReport(params.id),
      ])
      setSession(sess)
      setViolations(viols)
      setScreenshots(shots)
      setReport(rep)
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }

  async function viewScreenshot(id: string) {
    setLoadingImg(true)
    try {
      const res = await api.getScreenshotImage(id)
      setPreviewImg(res.image_data)
    } finally { setLoadingImg(false) }
  }

  // ── Chart data ──────────────────────────────────────────────────────────────
  function buildRiskTimeline() {
    if (!violations.length || !session?.started_at) return null
    const start = session.started_at
    const BUCKETS = 20
    const end = session.ended_at || Date.now() / 1000
    const step = (end - start) / BUCKETS
    const buckets = Array(BUCKETS).fill(0)
    violations.forEach(v => {
      const idx = Math.min(BUCKETS - 1, Math.floor((v.timestamp - start) / step))
      if (idx >= 0) buckets[idx] += v.risk_points || 5
    })
    const labels = buckets.map((_, i) => {
      const t = new Date((start + i * step) * 1000)
      return format(t, 'HH:mm')
    })
    return {
      labels,
      datasets: [{
        label: 'Risk Events',
        data: buckets,
        fill: true,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.1)',
        tension: 0.4,
        pointRadius: 3,
      }]
    }
  }

  function buildViolationBreakdown() {
    if (!report) return null
    const entries = Object.entries(report.risk_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 8)
    return {
      labels: entries.map(([k]) => k.replace(/_/g, ' ')),
      datasets: [{
        label: 'Count',
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map(([k]) => {
          if (k.includes('face') || k.includes('multiple')) return 'rgba(239,68,68,0.7)'
          if (k.includes('voice') || k.includes('phone')) return 'rgba(245,158,11,0.7)'
          return 'rgba(59,130,246,0.7)'
        }),
        borderRadius: 4,
      }]
    }
  }

  if (loading) return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="ml-56 flex-1 flex items-center justify-center">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading session...</div>
      </main>
    </div>
  )

  if (!session) return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="ml-56 flex-1 flex items-center justify-center">
        <div className="text-sm text-red-400">Session not found</div>
      </main>
    </div>
  )

  const riskTimeline = buildRiskTimeline()
  const violationBreakdown = buildViolationBreakdown()

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="ml-56 flex-1 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-sm px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              ← Back
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{session.student_id}</h1>
                {session.flagged === 1 && <span className="badge badge-danger">⚑ FLAGGED</span>}
                <span className={session.status === 'active' ? 'badge badge-success' : 'badge badge-gray'}>
                  {session.status}
                </span>
              </div>
              <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                {session.id}
              </p>
            </div>
          </div>
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Risk Score', val: `${(session.risk_score || 0).toFixed(0)}/100`, color: session.risk_score >= 70 ? '#ef4444' : session.risk_score >= 40 ? '#f59e0b' : '#10b981' },
            { label: 'Attention', val: `${(session.attention_score || 100).toFixed(0)}%`, color: (session.attention_score || 100) >= 70 ? '#10b981' : '#f59e0b' },
            { label: 'Violations', val: violations.length, color: '#f59e0b' },
            { label: 'Screenshots', val: screenshots.length, color: '#3b82f6' },
          ].map(c => (
            <div key={c.label} className="card">
              <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
              <div className="text-2xl font-bold" style={{ color: c.color }}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
          {(['overview', 'violations', 'screenshots', 'report'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={activeTab === t
                ? { background: 'var(--accent)', color: 'white' }
                : { color: 'var(--text-secondary)' }}>
              {t} {t === 'violations' ? `(${violations.length})` : t === 'screenshots' ? `(${screenshots.length})` : ''}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4 fade-in">
            {riskTimeline && (
              <div className="card">
                <h3 className="text-sm font-semibold text-white mb-4">Risk Timeline</h3>
                <Line data={riskTimeline} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                  }
                }} style={{ height: 200 }} />
              </div>
            )}
            {violationBreakdown && (
              <div className="card">
                <h3 className="text-sm font-semibold text-white mb-4">Violation Breakdown</h3>
                <Bar data={violationBreakdown} options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } }, beginAtZero: true },
                  }
                }} style={{ height: 200 }} />
              </div>
            )}
          </div>
        )}

        {/* Violations Timeline */}
        {activeTab === 'violations' && (
          <div className="space-y-2 fade-in">
            {violations.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-12 text-center">
                <div className="text-3xl mb-2">✅</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No violations recorded</div>
              </div>
            ) : violations.map((v, i) => (
              <div key={v.id} className="flex items-start gap-4 px-4 py-3 rounded-xl fade-in"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: `${SEVERITY_COLOR[v.severity] || '#3b82f6'}20` }}>
                  {VIOLATION_ICONS[v.violation_type] || '⚠️'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">
                      {(v.violation_type || '').replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-medium" style={{ color: SEVERITY_COLOR[v.severity] || '#94a3b8' }}>
                        +{v.risk_points} risk
                      </span>
                      <span className="badge" style={{
                        background: `${SEVERITY_COLOR[v.severity] || '#3b82f6'}20`,
                        color: SEVERITY_COLOR[v.severity] || '#3b82f6',
                        border: `1px solid ${SEVERITY_COLOR[v.severity] || '#3b82f6'}40`,
                        fontSize: 9,
                      }}>{v.severity}</span>
                    </div>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {v.timestamp ? format(new Date(v.timestamp * 1000), 'dd MMM yyyy — HH:mm:ss') : '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Screenshots */}
        {activeTab === 'screenshots' && (
          <div className="fade-in">
            {previewImg && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.85)' }}
                onClick={() => setPreviewImg(null)}>
                <div className="relative max-w-3xl w-full">
                  <img src={previewImg} alt="Screenshot" className="w-full rounded-xl" />
                  <button className="absolute top-2 right-2 w-8 h-8 rounded-full text-white flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.7)' }}>✕</button>
                </div>
              </div>
            )}
            {screenshots.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-12 text-center">
                <div className="text-3xl mb-2">📸</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No screenshots</div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {screenshots.map(s => (
                  <div key={s.id} className="card p-3 cursor-pointer hover:border-blue-500 transition-all"
                    onClick={() => viewScreenshot(s.id)}>
                    <div className="aspect-video rounded-lg flex items-center justify-center mb-2"
                      style={{ background: 'var(--bg-hover)' }}>
                      {loadingImg ? (
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</div>
                      ) : (
                        <div className="text-2xl">📸</div>
                      )}
                    </div>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {(s.trigger || 'periodic').replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {s.timestamp ? format(new Date(s.timestamp * 1000), 'HH:mm:ss') : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Report */}
        {activeTab === 'report' && report && (
          <div className="space-y-4 fade-in">
            {/* AI Summary */}
            <div className="card"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.05))', borderColor: 'rgba(59,130,246,0.3)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <h3 className="text-sm font-semibold text-white">AI Integrity Summary</h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {report.summary}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(report.risk_breakdown).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="card flex items-center gap-3">
                  <span className="text-xl">{VIOLATION_ICONS[type] || '⚠️'}</span>
                  <div>
                    <div className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                      {type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-lg font-bold text-white">{count}×</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Session Metadata */}
            <div className="card">
              <h3 className="text-sm font-semibold text-white mb-3">Session Details</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ['Student ID', session.student_id],
                  ['Session ID', session.id.slice(0, 24) + '...'],
                  ['Status', session.status],
                  ['Final Risk', `${(session.risk_score || 0).toFixed(0)}/100`],
                  ['Attention Score', `${(session.attention_score || 100).toFixed(0)}%`],
                  ['Total Violations', report.total_violations],
                  ['Screenshots', report.screenshots.length],
                  ['Started', session.started_at ? format(new Date(session.started_at * 1000), 'dd MMM yyyy HH:mm') : '—'],
                  ['Ended', session.ended_at ? format(new Date(session.ended_at * 1000), 'dd MMM yyyy HH:mm') : 'Ongoing'],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <div style={{ color: 'var(--text-muted)' }}>{k}</div>
                    <div className="font-medium text-white mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
