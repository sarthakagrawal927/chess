import { useState, useEffect, useRef, useCallback } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { PieceDropHandlerArgs } from 'react-chessboard'
import { Undo2, Lightbulb, RefreshCw, FlipVertical2 } from 'lucide-react'
import { StockfishEngine } from '../lib/stockfish'
import { DifficultyPicker, DIFFICULTY_CONFIGS, type DifficultyLevel } from './DifficultyPicker'
import { EvalBar } from './EvalBar'
import { MoveList, type MoveEntry, type MoveQuality } from './MoveList'
import { CoachPanel } from './CoachPanel'
import { ChessClock } from './ChessClock'
import { useChessCoach } from '../hooks/useAI'
import type { AIConfig } from '../hooks/useAI'

interface BestMoveArrow {
  from: string
  to: string
}

function classifyMoveQuality(loss: number): MoveQuality {
  if (loss > 200) return 'blunder'
  if (loss > 100) return 'mistake'
  if (loss > 50) return 'inaccuracy'
  if (loss > 10) return 'good'
  return 'best'
}

function uciToSan(game: Chess, uci: string): string {
  try {
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci.length > 4 ? uci[4] : undefined
    const gameCopy = new Chess(game.fen())
    const move = gameCopy.move({ from, to, promotion })
    return move?.san || uci
  } catch {
    return uci
  }
}

// Clone a chess.js game preserving full move history
// (new Chess(fen) loses history — this uses PGN instead)
function cloneGame(game: Chess): Chess {
  const clone = new Chess()
  const pgn = game.pgn()
  if (pgn) clone.loadPgn(pgn)
  return clone
}

const TIME_CONTROLS = [
  { label: '∞', value: 0 },
  { label: '1m', value: 1 },
  { label: '3m', value: 3 },
  { label: '5m', value: 5 },
  { label: '10m', value: 10 },
  { label: '15m', value: 15 },
]

const GAME_STATE_KEY = 'chess-coach-game'

function loadGameState() {
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as {
      pgn: string
      orientation: 'white' | 'black'
      difficulty: DifficultyLevel
      moveHistory: MoveEntry[]
      timeControl: number
      timeLeft: { white: number; black: number }
    }
  } catch { return null }
}

interface ChessGameProps {
  aiConfig: AIConfig
}

export function ChessGame({ aiConfig }: ChessGameProps) {
  const saved = useRef(loadGameState()).current

  const [game, setGame] = useState(() => {
    if (saved?.pgn) {
      const g = new Chess()
      g.loadPgn(saved.pgn)
      return g
    }
    return new Chess()
  })
  const [fen, setFen] = useState(() => game.fen())
  const [orientation, setOrientation] = useState<'white' | 'black'>(saved?.orientation ?? 'white')
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(saved?.difficulty ?? 2)
  const [evalScore, setEvalScore] = useState(0)
  const [bestMoveArrow, setBestMoveArrow] = useState<BestMoveArrow | null>(null)
  const [gameOver, setGameOver] = useState<string | null>(null)
  const [isComputerThinking, setIsComputerThinking] = useState(false)
  const [moveHistory, setMoveHistory] = useState<MoveEntry[]>(saved?.moveHistory ?? [])
  const [lastMoveQuality, setLastMoveQuality] = useState<MoveQuality | null>(null)
  const [lastMoveSan, setLastMoveSan] = useState<string | null>(null)
  const [isFetchingHint, setIsFetchingHint] = useState(false)
  const [boardWidth, setBoardWidth] = useState(480)
  const [timeControl, setTimeControl] = useState(saved?.timeControl ?? 0)
  const [timeLeft, setTimeLeft] = useState(saved?.timeLeft ?? { white: 0, black: 0 })

  const engineRef = useRef<StockfishEngine | null>(null)
  const engineReadyRef = useRef(false)
  const gameRef = useRef(game)
  gameRef.current = game
  const evalScoreRef = useRef(evalScore)
  evalScoreRef.current = evalScore
  const orientationRef = useRef(orientation)
  orientationRef.current = orientation
  const evalDebounceRef = useRef<ReturnType<typeof setTimeout>>()
  const computerMoveTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const centerColRef = useRef<HTMLDivElement>(null)

  // Persist game state to localStorage
  useEffect(() => {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      pgn: game.pgn(),
      orientation,
      difficulty,
      moveHistory,
      timeControl,
      timeLeft,
    }))
  }, [fen, orientation, difficulty, moveHistory, timeControl, timeLeft])

  // Debounced eval setter
  const setEvalSmooth = useCallback((val: number) => {
    clearTimeout(evalDebounceRef.current)
    evalDebounceRef.current = setTimeout(() => setEvalScore(val), 120)
  }, [])

  const { explanation, isStreaming, error: coachError, evaluate } = useChessCoach()

  // ResizeObserver for accurate board sizing based on actual container width
  useEffect(() => {
    const el = centerColRef.current
    if (!el) return

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        const vh = window.innerHeight
        if (window.innerWidth < 768) {
          setBoardWidth(Math.min(w - 8, vh - 220, 560))
        } else {
          setBoardWidth(Math.min(w - 8, vh - 180, 800))
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Init Stockfish engine
  useEffect(() => {
    const engine = new StockfishEngine()
    engineRef.current = engine
    engine.init().then(() => {
      engineReadyRef.current = true
      engine.getEval(new Chess().fen()).then((result) => {
        setEvalScore(result.eval)
      })
    }).catch(console.error)

    return () => {
      engine.destroy()
      engineReadyRef.current = false
    }
  }, [])

  // Timer countdown — re-registers on each move (fen change) to switch whose clock ticks
  useEffect(() => {
    if (timeControl === 0 || gameOver) return

    const turn = gameRef.current.turn()
    const key = turn === 'w' ? 'white' : 'black'

    const interval = setInterval(() => {
      setTimeLeft(prev => ({
        ...prev,
        [key]: Math.max(0, prev[key] - 1),
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [fen, timeControl, gameOver])

  // Detect time running out
  useEffect(() => {
    if (timeControl === 0 || gameOver) return
    if (timeLeft.white === 0 && timeControl > 0) {
      setGameOver('Black wins on time!')
    } else if (timeLeft.black === 0 && timeControl > 0) {
      setGameOver('White wins on time!')
    }
  }, [timeLeft, timeControl, gameOver])

  const playerColor = orientation

  const isPlayerTurn = useCallback((g?: Chess) => {
    const turn = (g || gameRef.current).turn()
    return (turn === 'w' && orientationRef.current === 'white') || (turn === 'b' && orientationRef.current === 'black')
  }, [])

  const makeComputerMove = useCallback(async (currentGame: Chess) => {
    if (!engineRef.current || !engineReadyRef.current) return
    if (currentGame.isGameOver()) return

    setIsComputerThinking(true)
    setBestMoveArrow(null)

    const diffConfig = DIFFICULTY_CONFIGS[difficulty]
    try {
      const result = await engineRef.current.analyze(
        currentGame.fen(),
        diffConfig.skillLevel,
        diffConfig.moveTime
      )

      const uci = result.bestMove
      if (!uci || uci === '0000') {
        setIsComputerThinking(false)
        return
      }

      const from = uci.slice(0, 2)
      const to = uci.slice(2, 4)
      const promotion = uci.length > 4 ? uci[4] : undefined

      const newGame = cloneGame(currentGame)
      const move = newGame.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined })

      if (move) {
        setGame(newGame)
        setFen(newGame.fen())

        if (engineRef.current) {
          engineRef.current.getEval(newGame.fen()).then(r => setEvalSmooth(r.eval))
        }

        if (newGame.isCheckmate()) {
          setGameOver(`Checkmate! ${orientationRef.current === 'white' ? 'Black' : 'White'} wins.`)
        } else if (newGame.isDraw() || newGame.isStalemate()) {
          setGameOver('Draw!')
        }
      }
    } catch (err) {
      console.error('Computer move error:', err)
    } finally {
      setIsComputerThinking(false)
    }
  }, [difficulty])

  // After player moves: eval + quality + trigger computer — NO AI coach call
  const afterPlayerMove = useCallback(async (
    movedGame: Chess,
    moveSan: string,
    prevFen: string,
  ) => {
    if (!engineRef.current) {
      // Still need to trigger computer even if engine eval fails
      if (!movedGame.isGameOver()) {
        computerMoveTimeoutRef.current = setTimeout(() => makeComputerMove(movedGame), 300)
      }
      return
    }

    const engine = engineRef.current

    const [preMoveResult, bestMoveResult] = await Promise.allSettled([
      engine.getEval(prevFen),
      engine.getBestMove(prevFen),
    ])

    const evalBefore = preMoveResult.status === 'fulfilled' ? preMoveResult.value.eval : evalScoreRef.current
    const bestMoveUci = bestMoveResult.status === 'fulfilled' ? bestMoveResult.value.bestMove : ''

    const preMoveGame = new Chess(prevFen)
    const bestMoveSan = bestMoveUci ? uciToSan(preMoveGame, bestMoveUci) : ''

    let evalAfter = 0
    try {
      const postResult = await engine.getEval(movedGame.fen())
      evalAfter = postResult.eval
    } catch { }

    const color = orientationRef.current
    const lossFromPlayer = color === 'white'
      ? evalBefore - evalAfter
      : evalAfter - evalBefore

    const quality = classifyMoveQuality(lossFromPlayer)

    const moveEntry: MoveEntry = {
      san: moveSan,
      quality,
      evalBefore,
      evalAfter,
      bestMove: bestMoveSan || bestMoveUci,
      prevFen,
    }

    setMoveHistory(prev => [...prev, moveEntry])
    setLastMoveQuality(quality)
    setLastMoveSan(moveSan)

    if (!movedGame.isGameOver()) {
      computerMoveTimeoutRef.current = setTimeout(() => makeComputerMove(movedGame), 300)
    }
  }, [makeComputerMove])

  const onPieceDrop = useCallback(({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (!engineRef.current || !engineReadyRef.current) return false
    if (isComputerThinking) return false
    if (!isPlayerTurn()) return false
    if (gameRef.current.isGameOver()) return false
    if (!targetSquare) return false

    setBestMoveArrow(null)

    const currentFen = gameRef.current.fen()

    const pieceType = piece.pieceType
    const isPromoting = pieceType?.toLowerCase() === 'p' &&
      (targetSquare[1] === '8' || targetSquare[1] === '1')
    const promotion = isPromoting ? 'q' : undefined

    const newGame = cloneGame(gameRef.current)
    let move
    try {
      move = newGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      })
    } catch {
      return false
    }

    if (!move) return false

    setGame(newGame)
    setFen(newGame.fen())

    if (newGame.isCheckmate()) {
      setGameOver(`Checkmate! ${orientationRef.current} wins!`)
    } else if (newGame.isDraw() || newGame.isStalemate()) {
      setGameOver('Draw!')
    }

    afterPlayerMove(newGame, move.san, currentFen)

    return true
  }, [isComputerThinking, isPlayerTurn, afterPlayerMove])

  const handleBestMoveHint = useCallback(async () => {
    if (!engineRef.current || !engineReadyRef.current) return
    if (isComputerThinking || isFetchingHint) return
    if (!isPlayerTurn()) return

    setIsFetchingHint(true)
    setBestMoveArrow(null)

    try {
      const result = await engineRef.current.getBestMove(game.fen())
      const uci = result.bestMove
      if (uci && uci !== '0000') {
        setBestMoveArrow({ from: uci.slice(0, 2), to: uci.slice(2, 4) })
      }
    } catch (err) {
      console.error('Hint error:', err)
    } finally {
      setIsFetchingHint(false)
    }
  }, [game, isComputerThinking, isFetchingHint, isPlayerTurn])

  const handleAnalyze = useCallback(() => {
    if (moveHistory.length === 0) return
    const lastMove = moveHistory[moveHistory.length - 1]
    if (!lastMove.prevFen) return

    evaluate(
      {
        fen: lastMove.prevFen,
        playerMove: lastMove.san,
        evalBefore: lastMove.evalBefore,
        evalAfter: lastMove.evalAfter,
        bestMove: lastMove.bestMove || '',
        playerColor: orientation,
      },
      aiConfig,
    )
  }, [moveHistory, orientation, aiConfig, evaluate])

  const handleNewGame = useCallback(() => {
    const newGame = new Chess()
    setGame(newGame)
    setFen(newGame.fen())
    setGameOver(null)
    setMoveHistory([])
    setEvalScore(0)
    setBestMoveArrow(null)
    setLastMoveQuality(null)
    setLastMoveSan(null)
    setTimeLeft({ white: timeControl * 60, black: timeControl * 60 })

    if (engineRef.current) {
      engineRef.current.getEval(newGame.fen()).then(r => setEvalSmooth(r.eval))
    }

    if (orientationRef.current === 'black') {
      setTimeout(() => makeComputerMove(newGame), 500)
    }
  }, [makeComputerMove, timeControl])

  const handleFlipBoard = useCallback(() => {
    setOrientation(prev => prev === 'white' ? 'black' : 'white')
  }, [])

  const handleUndo = useCallback(() => {
    if (isComputerThinking) return
    const moves = game.history() // plain SAN strings like ['e4', 'e5', ...]
    if (moves.length === 0) return

    // Cancel any pending computer move to prevent race condition
    clearTimeout(computerMoveTimeoutRef.current)

    const movesToUndo = isPlayerTurn() ? 2 : 1
    const keepCount = Math.max(0, moves.length - movesToUndo)

    const newGame = new Chess()
    for (let i = 0; i < keepCount; i++) {
      newGame.move(moves[i])
    }

    setGame(newGame)
    setFen(newGame.fen())
    setGameOver(null)
    setBestMoveArrow(null)
    setLastMoveQuality(null)
    setLastMoveSan(null)
    setMoveHistory(prev => prev.slice(0, Math.max(0, prev.length - 1)))

    if (engineRef.current) {
      engineRef.current.getEval(newGame.fen()).then(r => setEvalSmooth(r.eval))
    }
  }, [game, isComputerThinking, isPlayerTurn, setEvalSmooth])

  // When orientation changes, trigger computer move if it's computer's turn
  useEffect(() => {
    if (!game.isGameOver() && !isPlayerTurn(game) && !isComputerThinking) {
      makeComputerMove(game)
    }
  }, [orientation]) // eslint-disable-line react-hooks/exhaustive-deps

  const arrows = bestMoveArrow
    ? [{ startSquare: bestMoveArrow.from, endSquare: bestMoveArrow.to, color: 'rgba(0,200,100,0.85)' }]
    : []

  const canInteract = !isComputerThinking && !gameOver && isPlayerTurn()
  const computerColor = orientation === 'white' ? 'black' : 'white'

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full items-start justify-center">
      {/* Left panel: Eval bar (desktop only) */}
      <div className="hidden md:flex flex-col items-center self-stretch py-2">
        <EvalBar eval={evalScore} orientation={playerColor} className="h-full" />
      </div>

      {/* Center: Board + clocks */}
      <div ref={centerColRef} className="flex-1 min-w-0 flex flex-col gap-2 items-center">
        {/* Mobile eval bar */}
        <div className="md:hidden w-full">
          <EvalBar eval={evalScore} orientation={playerColor} horizontal />
        </div>

        {/* Computer clock (opponent, above board) */}
        {timeControl > 0 && (
          <div style={{ width: boardWidth }}>
            <ChessClock
              time={timeLeft[computerColor]}
              isActive={!isPlayerTurn() && !gameOver}
              label="Computer"
            />
          </div>
        )}

        {/* Status area — fixed height to prevent layout shift */}
        <div className="h-8 flex items-center justify-center" style={{ width: boardWidth }}>
          {gameOver ? (
            <div className="bg-yellow-900/60 border border-yellow-600 text-yellow-200 rounded-lg px-4 py-1 text-sm font-semibold">
              {gameOver}
            </div>
          ) : isComputerThinking ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Computer is thinking...
            </div>
          ) : null}
        </div>

        {/* Chess board */}
        <div style={{ width: boardWidth, height: boardWidth }}>
          <Chessboard
            options={{
              position: fen,
              onPieceDrop,
              boardOrientation: orientation,
              arrows,
              allowDrawingArrows: true,
              animationDurationInMs: 200,
              boardStyle: {
                borderRadius: '8px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
              },
            }}
          />
        </div>

        {/* Player clock (you, below board) */}
        {timeControl > 0 && (
          <div style={{ width: boardWidth }}>
            <ChessClock
              time={timeLeft[playerColor]}
              isActive={isPlayerTurn() && !gameOver}
              label="You"
            />
          </div>
        )}

        {/* Controls row */}
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={handleNewGame}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            New Game
          </button>
          <button
            onClick={handleFlipBoard}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            <FlipVertical2 className="w-4 h-4" />
            Flip Board
          </button>
          <button
            onClick={handleUndo}
            disabled={isComputerThinking || game.history().length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
          <button
            onClick={handleBestMoveHint}
            disabled={!canInteract || isFetchingHint}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isFetchingHint ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Lightbulb className="w-4 h-4" />
            )}
            Best Move Hint
          </button>
          {bestMoveArrow && (
            <button
              onClick={() => setBestMoveArrow(null)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-400 rounded-lg text-sm transition-colors"
            >
              Clear Arrow
            </button>
          )}
        </div>
      </div>

      {/* Right panel: Time Control + Difficulty + Coach + Moves */}
      <div className="flex flex-col gap-4 w-full md:w-72 flex-shrink-0">
        {/* Time control */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <div className="text-sm text-gray-400 font-medium mb-2">Time Control</div>
          <div className="flex flex-wrap gap-2">
            {TIME_CONTROLS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => {
                  setTimeControl(value)
                  setTimeLeft({ white: value * 60, black: value * 60 })
                }}
                className={`px-2.5 py-1 rounded text-sm font-medium transition-colors ${
                  timeControl === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <DifficultyPicker
            difficulty={difficulty}
            onChange={setDifficulty}
            disabled={isComputerThinking}
          />
        </div>

        {/* Coach panel */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <CoachPanel
            explanation={explanation}
            isStreaming={isStreaming}
            error={coachError}
            lastMoveQuality={lastMoveQuality}
            lastMoveSan={lastMoveSan}
            onAnalyze={handleAnalyze}
            canAnalyze={moveHistory.length > 0}
          />
        </div>

        {/* Move list */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <MoveList moves={moveHistory} />
        </div>
      </div>
    </div>
  )
}
