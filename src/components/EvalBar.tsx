interface EvalBarProps {
  eval: number  // centipawns, positive = white winning
  orientation: 'white' | 'black'
  className?: string
  horizontal?: boolean
}

function formatEval(cp: number): string {
  if (Math.abs(cp) >= 10000) {
    return cp > 0 ? 'M' : '-M'
  }
  const pawns = cp / 100
  return pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1)
}

export function EvalBar({ eval: evalScore, orientation, className = '', horizontal = false }: EvalBarProps) {
  // Clamp at ±1000cp for display purposes
  const clamped = Math.max(-1000, Math.min(1000, evalScore))
  // White percentage: 50% at 0, 100% at +1000, 0% at -1000
  const whitePercent = Math.round(50 + (clamped / 1000) * 50)

  const label = formatEval(evalScore)
  const isWhiteAhead = evalScore >= 0

  if (horizontal) {
    // Horizontal bar for mobile (white on left)
    const leftPercent = orientation === 'white' ? whitePercent : 100 - whitePercent
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs font-mono text-gray-400 w-10 text-right">{label}</span>
        <div className="flex-1 h-4 rounded overflow-hidden bg-gray-800 relative">
          <div
            className="h-full bg-gray-100 absolute left-0 top-0 transition-all duration-700 ease-in-out"
            style={{ width: `${leftPercent}%` }}
          />
          <div
            className="h-full bg-gray-800 absolute right-0 top-0 transition-all duration-700 ease-in-out"
            style={{ width: `${100 - leftPercent}%` }}
          />
        </div>
      </div>
    )
  }

  // Vertical bar for desktop: white on top if white orientation, bottom otherwise
  // Standard chess eval bar: white portion is always the light portion
  // Top = player's advantage shown at top of bar
  // Convention: top = black's portion (dark), bottom = white's portion (light)
  // whitePercent is how much white has from bottom
  const whiteHeightPct = orientation === 'white' ? whitePercent : 100 - whitePercent

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <span className="text-xs font-mono text-gray-400">
        {isWhiteAhead ? label : ''}
      </span>
      <div className="w-6 flex-1 rounded overflow-hidden relative bg-gray-800" style={{ minHeight: '200px' }}>
        {/* Dark portion (top) */}
        <div
          className="absolute top-0 left-0 right-0 bg-gray-800 transition-all duration-700 ease-in-out"
          style={{ height: `${100 - whiteHeightPct}%` }}
        />
        {/* Light portion (bottom) */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-gray-100 transition-all duration-700 ease-in-out"
          style={{ height: `${whiteHeightPct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-400">
        {!isWhiteAhead ? label : ''}
      </span>
    </div>
  )
}
