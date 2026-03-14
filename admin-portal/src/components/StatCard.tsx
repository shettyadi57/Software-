interface StatCardProps {
  label: string
  value: string | number
  icon: string
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'gray'
  sub?: string
}

const colorMap = {
  blue:   { text: '#60a5fa', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.2)'  },
  red:    { text: '#f87171', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.2)'   },
  green:  { text: '#34d399', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.2)'  },
  yellow: { text: '#fbbf24', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.2)'  },
  gray:   { text: '#94a3b8', bg: 'rgba(100,116,139,0.1)',  border: 'rgba(100,116,139,0.2)' },
}

export default function StatCard({ label, value, icon, color = 'blue', sub }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className="card fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-1"
            style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-3xl font-bold" style={{ color: c.text }}>{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}>
          {icon}
        </div>
      </div>
    </div>
  )
}
