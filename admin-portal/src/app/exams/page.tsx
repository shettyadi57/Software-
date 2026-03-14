'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated, api, Exam } from '@/lib/api'
import Sidebar from '@/components/Sidebar'
import { format } from 'date-fns'

export default function ExamsPage() {
  const router = useRouter()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', duration_minutes: 120, allowed_tabs: 1 })
  const [creating, setCreating] = useState(false)
  const [newExam, setNewExam] = useState<{ exam_id: string; session_code: string; title: string } | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return }
    loadExams()
  }, [router])

  async function loadExams() {
    try {
      setLoading(true)
      setExams(await api.getExams())
    } finally { setLoading(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const result = await api.createExam(form)
      setNewExam(result)
      setShowCreate(false)
      loadExams()
    } catch (err: any) {
      alert(err.message)
    } finally { setCreating(false) }
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="ml-56 flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Exams</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Manage exam sessions and codes</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: 'var(--accent)', color: 'white' }}>
            + New Exam
          </button>
        </div>

        {/* New Exam Banner */}
        {newExam && (
          <div className="mb-4 p-4 rounded-xl fade-in"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-green-400">✅ Exam created: {newExam.title}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Share this session code with students:
                  <span className="ml-2 px-3 py-1 rounded font-mono font-bold text-lg text-white"
                    style={{ background: 'var(--bg-card)', letterSpacing: '4px' }}>
                    {newExam.session_code}
                  </span>
                </div>
              </div>
              <button onClick={() => setNewExam(null)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="card w-full max-w-md">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-white">Create New Exam</h2>
                <button onClick={() => setShowCreate(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Exam Title
                  </label>
                  <input type="text" required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                    placeholder="e.g. Midterm Exam 2024"
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                      Duration (min)
                    </label>
                    <input type="number" min={15} max={360} required value={form.duration_minutes}
                      onChange={e => setForm({...form, duration_minutes: Number(e.target.value)})}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                      Allowed Tabs
                    </label>
                    <select value={form.allowed_tabs} onChange={e => setForm({...form, allowed_tabs: Number(e.target.value)})}
                      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                      <option value={1}>1 (Strict)</option>
                      <option value={2}>2 (Lenient)</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={creating}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'white' }}>
                  {creating ? 'Creating...' : 'Create Exam →'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Exams Table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold text-white">All Exams</h2>
            <span className="badge badge-info">{exams.length} total</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
            </div>
          ) : exams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-3">📋</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No exams yet</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Create your first exam above</div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-hover)' }}>
                  {['Title', 'Session Code', 'Duration', 'Status', 'Created', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exams.map(exam => (
                  <tr key={exam.id} className="border-t hover:bg-opacity-50 transition-all"
                    style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3 text-sm font-medium text-white">{exam.title}</td>
                    <td className="px-4 py-3">
                      <span className="px-3 py-1 rounded font-mono font-bold text-sm"
                        style={{ background: 'var(--bg-hover)', color: '#60a5fa', letterSpacing: '3px' }}>
                        {exam.session_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {exam.duration_minutes} min
                    </td>
                    <td className="px-4 py-3">
                      <span className={exam.status === 'active' ? 'badge badge-success' : 'badge badge-gray'}>
                        {exam.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {exam.created_at ? format(new Date(exam.created_at * 1000), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => router.push(`/sessions?exam_id=${exam.id}`)}
                        className="text-xs px-3 py-1 rounded-lg transition-all"
                        style={{ background: 'var(--bg-hover)', color: 'var(--accent)' }}>
                        View Sessions →
                      </button>
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
