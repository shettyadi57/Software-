'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/api'

export default function RootPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace(isAuthenticated() ? '/dashboard' : '/login')
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center">
        <div className="text-4xl mb-4">🛡️</div>
        <div className="text-lg font-semibold text-blue-400">AEGIS</div>
        <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    </div>
  )
}
