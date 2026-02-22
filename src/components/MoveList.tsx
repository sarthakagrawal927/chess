export type MoveQuality = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export interface MoveEntry {
  san: string
  quality: MoveQuality
  evalBefore: number
  evalAfter: number
  bestMove?: string
  prevFen?: string
}

const QUALITY_STYLES: Record<MoveQuality, { dot: string; label: string; bg: string }> = {
  best: { dot: 'bg-blue-400', label: 'Best', bg: 'bg-blue-900/30' },
  good: { dot: 'bg-green-400', label: 'Good', bg: 'bg-green-900/20' },
  inaccuracy: { dot: 'bg-yellow-400', label: '?!', bg: 'bg-yellow-900/20' },
  mistake: { dot: 'bg-orange-400', label: '?', bg: 'bg-orange-900/20' },
  blunder: { dot: 'bg-red-400', label: '??', bg: 'bg-red-900/30' },
}

interface MoveChipProps {
  move: MoveEntry
  moveNumber?: number
  color: 'white' | 'black'
}

function formatEvalShort(cp: number): string {
  if (Math.abs(cp) >= 10000) return cp > 0 ? 'M' : '-M'
  const pawns = cp / 100
  return pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1)
}

function MoveChip({ move, moveNumber, color }: MoveChipProps) {
  const style = QUALITY_STYLES[move.quality]
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded ${style.bg}`}>
      {moveNumber !== undefined && color === 'white' && (
        <span className="text-gray-500 text-xs w-5">{moveNumber}.</span>
      )}
      {color === 'black' && moveNumber === undefined && (
        <span className="text-gray-500 text-xs w-5"></span>
      )}
      <span className="text-gray-100 text-sm font-mono">{move.san}</span>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} title={style.label} />
      <span className="text-gray-500 text-[10px] font-mono ml-auto">{formatEvalShort(move.evalAfter)}</span>
    </div>
  )
}

interface MoveListProps {
  moves: MoveEntry[]
}

export function MoveList({ moves }: MoveListProps) {
  // Pair moves: white (even index) + black (odd index)
  const pairs: Array<{ white?: MoveEntry; black?: MoveEntry; moveNumber: number }> = []
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Move History</div>
      <div className="overflow-y-auto max-h-48 flex flex-col gap-0.5 pr-1">
        {pairs.length === 0 ? (
          <div className="text-gray-500 text-sm italic">No moves yet</div>
        ) : (
          pairs.map((pair) => (
            <div key={pair.moveNumber} className="flex gap-1">
              {pair.white && (
                <div className="flex-1">
                  <MoveChip move={pair.white} moveNumber={pair.moveNumber} color="white" />
                </div>
              )}
              {pair.black ? (
                <div className="flex-1">
                  <MoveChip move={pair.black} color="black" />
                </div>
              ) : (
                <div className="flex-1" />
              )}
            </div>
          ))
        )}
      </div>
      {moves.length > 0 && (
        <div className="flex gap-3 mt-1 flex-wrap">
          {Object.entries(QUALITY_STYLES).map(([q, s]) => (
            <div key={q} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className="text-xs text-gray-400">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
