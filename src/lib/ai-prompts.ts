export function buildChessCoachPrompt(context: {
  fen: string
  playerMove: string
  evalBefore: number
  evalAfter: number
  bestMove: string
  playerColor: 'white' | 'black'
}): string {
  const evalDiff = context.evalAfter - context.evalBefore
  // If player is black, a more negative eval is better for them
  const loss = context.playerColor === 'white'
    ? context.evalBefore - context.evalAfter
    : context.evalAfter - context.evalBefore

  const quality = loss > 200 ? 'blunder' : loss > 100 ? 'mistake' : loss > 50 ? 'inaccuracy' : 'good'

  return `You are a friendly chess coach. The player (${context.playerColor}) just played ${context.playerMove}.

Position (FEN): ${context.fen}
Evaluation before move: ${(context.evalBefore / 100).toFixed(1)} pawns (from white's perspective)
Evaluation after move: ${(context.evalAfter / 100).toFixed(1)} pawns (from white's perspective)
Eval change: ${(evalDiff / 100).toFixed(1)} pawns
Move quality: ${quality}
Stockfish best move was: ${context.bestMove}

Give a 2-3 sentence coaching comment. Explain simply why this move was ${quality}${quality !== 'good' ? ` and what ${context.bestMove} would have achieved instead` : ''}. Be encouraging. No bullet points.`
}

export const SYSTEM_PROMPT = `You are a concise, encouraging chess coach. Give plain English explanations based only on the engine data provided. Never try to calculate yourself.`
