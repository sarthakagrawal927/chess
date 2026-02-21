import { Loader2 } from 'lucide-react'
import type { MoveQuality } from './MoveList'

const QUALITY_BADGE: Record<MoveQuality, { label: string; className: string }> = {
  best: { label: 'Best Move', className: 'bg-blue-900 text-blue-300 border border-blue-700' },
  good: { label: 'Good Move', className: 'bg-green-900 text-green-300 border border-green-700' },
  inaccuracy: { label: 'Inaccuracy ?!', className: 'bg-yellow-900 text-yellow-300 border border-yellow-700' },
  mistake: { label: 'Mistake ?', className: 'bg-orange-900 text-orange-300 border border-orange-700' },
  blunder: { label: 'Blunder ??', className: 'bg-red-900 text-red-300 border border-red-700' },
}

interface CoachPanelProps {
  explanation: string
  isStreaming: boolean
  error: string | null
  lastMoveQuality: MoveQuality | null
  lastMoveSan: string | null
}

export function CoachPanel({ explanation, isStreaming, error, lastMoveQuality, lastMoveSan }: CoachPanelProps) {
  const badge = lastMoveQuality ? QUALITY_BADGE[lastMoveQuality] : null

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">AI Coach</div>

      {badge && lastMoveSan && (
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${badge.className}`}>
            {badge.label}
          </span>
          <span className="text-sm font-mono text-gray-300">{lastMoveSan}</span>
        </div>
      )}

      <div className="min-h-[80px] text-sm text-gray-200 leading-relaxed">
        {isStreaming && !explanation && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analyzing move...</span>
          </div>
        )}

        {!isStreaming && !explanation && !error && (
          <span className="text-gray-500 italic">
            Make a move to get coaching from your AI coach.
          </span>
        )}

        {explanation && (
          <span>
            {explanation}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-gray-400 ml-0.5 animate-pulse" />
            )}
          </span>
        )}

        {error && !explanation && (
          <div className="text-red-400 text-xs">
            <span className="font-semibold">Coach unavailable:</span> {error}
            <div className="mt-1 text-gray-500">Configure your AI provider using the settings button.</div>
          </div>
        )}
      </div>
    </div>
  )
}
