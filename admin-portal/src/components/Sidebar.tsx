'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearToken } from '@/lib/api'
import { clsx } from 'clsx'

const NAV = [
  { href: '/dashboard', icon: '⬛', label: 'Dashboard' },
  { href: '/students',  icon: '👥', label: 'Students' },
  { href: '/exams',     icon: '📋', label: 'Exams' },
  { href: '/sessions',  icon: '🎥', label: 'Sessions' },
  { href: '/reports',   icon: '📊', label: 'Reports' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  function logout() {
    clearToken()
    router.push('/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-56 flex flex-col z-30"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
          style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
          🛡️
        </div>
        <div>
          <div className="font-bold text-sm text-white">AEGIS</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Admin Portal</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'text-white'
                  : 'hover:text-white'
              )}
              style={active
                ? { background: 'rgba(59,130,246,0.15)', color: '#60a5fa', borderLeft: '2px solid #3b82f6' }
                : { color: 'var(--text-secondary)', borderLeft: '2px solid transparent' }
              }>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User / Logout */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-2"
          style={{ background: 'var(--bg-card)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--accent)', color: 'white' }}>
            A
          </div>
          <div className="text-xs">
            <div className="font-medium text-white">admin</div>
            <div style={{ color: 'var(--text-muted)' }}>Invigilator</div>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all hover:bg-red-900/20"
          style={{ color: '#ef4444' }}>
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  )
}
