interface ChessClockProps {
  time: number         // seconds remaining
  isActive: boolean    // whose turn it is
  label: string        // 'You' | 'Computer'
}

export function ChessClock({ time, isActive, label }: ChessClockProps) {
  const minutes = Math.floor(time / 60)
  const seconds = time % 60
  const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`
  const isLow = time <= 30 && time > 0

  return (
    <div className={`
      flex items-center justify-between px-4 py-2 rounded-lg transition-colors duration-300
      ${isActive ? 'bg-gray-100 text-gray-900' : 'bg-gray-800/80 text-gray-500'}
    `}>
      <span className="text-sm font-medium">{label}</span>
      <span className={`font-mono text-2xl font-bold tabular-nums tracking-tight
        ${isLow && isActive ? 'text-red-500' : ''}
      `}>
        {formatted}
      </span>
    </div>
  )
}
