interface RiskBarProps {
  score: number
  showLabel?: boolean
  height?: number
}

export function riskColor(score: number) {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f59e0b'
  return '#10b981'
}

export function riskLabel(score: number) {
  if (score >= 70) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  return 'LOW'
}

export default function RiskBar({ score, showLabel = true, height = 6 }: RiskBarProps) {
  const color = riskColor(score)
  const label = riskLabel(score)
  return (
    <div>
      {showLabel && (
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: 'var(--text-muted)' }}>Risk</span>
          <span className="font-semibold" style={{ color }}>{score.toFixed(0)} — {label}</span>
        </div>
      )}
      <div className="w-full rounded-full" style={{ background: 'var(--bg-hover)', height }}>
        <div className="risk-bar-fill" style={{ width: `${Math.min(100, score)}%`, background: color, height }} />
      </div>
    </div>
  )
}
