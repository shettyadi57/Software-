'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated, api, Session } from '@/lib/api'
import Sidebar from '@/components/Sidebar'
import '@/lib/chartSetup'
import { Bar, Doughnut } from 'react-chartjs-2'

export default function ReportsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    load()
  }, [router])

  async function load() {
    try {
      setLoading(true)
      setSessions(await api.getSessions())
    } finally { setLoading(false) }
  }

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const total = sessions.length
  const flagged = sessions.filter(s => s.flagged).length
  const avgRisk = sessions.length ? sessions.reduce((a, s) => a + (s.risk_score || 0), 0) / sessions.length : 0
  const avgAttn = sessions.length ? sessions.reduce((a, s) => a + (s.attention_score || 100), 0) / sessions.length : 0
  const highRisk = sessions.filter(s => s.risk_score >= 70).length
  const medRisk = sessions.filter(s => s.risk_score >= 40 && s.risk_score < 70).length
  const lowRisk = sessions.filter(s => s.risk_score < 40).length

  const riskDistData = {
    labels: ['High Risk (≥70)', 'Medium Risk (40–69)', 'Low Risk (<40)'],
    datasets: [{
      data: [highRisk, medRisk, lowRisk],
      backgroundColor: ['rgba(239,68,68,0.8)', 'rgba(245,158,11,0.8)', 'rgba(16,185,129,0.8)'],
      borderColor: ['#ef4444', '#f59e0b', '#10b981'],
      borderWidth: 1,
    }]
  }

  // Risk score histogram (buckets of 10)
  const buckets = Array(10).fill(0)
  sessions.forEach(s => {
    const idx = Math.min(9, Math.floor((s.risk_score || 0) / 10))
    buckets[idx]++
  })
  const riskHistData = {
    labels: ['0–9', '10–19', '20–29', '30–39', '40–49', '50–59', '60–69', '70–79', '80–89', '90–100'],
    datasets: [{
      label: 'Students',
      data: buckets,
      backgroundColor: buckets.map((_, i) =>
        i >= 7 ? 'rgba(239,68,68,0.7)' : i >= 4 ? 'rgba(245,158,11,0.7)' : 'rgba(59,130,246,0.7)'
      ),
      borderRadius: 4,
    }]
  }

  const topFlagged = [...sessions]
    .filter(s => s.flagged || s.risk_score >= 40)
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 10)

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } }, beginAtZero: true },
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="ml-56 flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Aggregate exam integrity analysis
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Sessions', val: total, color: '#60a5fa' },
            { label: 'Flagged Students', val: flagged, color: '#f87171' },
            { label: 'Avg Risk Score', val: `${avgRisk.toFixed(1)}`, color: avgRisk >= 40 ? '#fbbf24' : '#34d399' },
            { label: 'Avg Attention', val: `${avgAttn.toFixed(1)}%`, color: avgAttn >= 70 ? '#34d399' : '#fbbf24' },
          ].map(c => (
            <div key={c.label} className="card">
              <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
              <div className="text-2xl font-bold" style={{ color: c.color }}>{c.val}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Risk Distribution Donut */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-4">Risk Distribution</h3>
            <div style={{ height: 200 }}>
              <Doughnut data={riskDistData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, padding: 12 } } },
                cutout: '65%',
              }} />
            </div>
          </div>

          {/* Risk Histogram */}
          <div className="card col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Risk Score Distribution</h3>
            <div style={{ height: 200 }}>
              <Bar data={riskHistData} options={{ ...chartOpts, plugins: { legend: { display: false } } }} />
            </div>
          </div>
        </div>

        {/* High Risk Students Table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold text-white">Students Requiring Review</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
            </div>
          ) : topFlagged.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No high-risk students</div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-hover)' }}>
                  {['Student', 'Risk Score', 'Attention', 'Status', 'Flagged', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topFlagged.map(s => (
                  <tr key={s.id} className="border-t cursor-pointer hover:bg-red-900/5 transition-all"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => router.push(`/sessions/${s.id}`)}>
                    <td className="px-4 py-3 text-sm font-medium text-white">{s.student_id}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-sm"
                        style={{ color: s.risk_score >= 70 ? '#ef4444' : '#f59e0b' }}>
                        {(s.risk_score || 0).toFixed(0)}/100
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm"
                      style={{ color: (s.attention_score || 100) >= 70 ? '#34d399' : '#fbbf24' }}>
                      {(s.attention_score || 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3">
                      <span className={s.status === 'active' ? 'badge badge-success' : 'badge badge-gray'}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.flagged ? <span className="badge badge-danger">Yes</span> : <span className="badge badge-gray">No</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'var(--accent)' }}>Review →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
