export function buildChessCoachPrompt(context: {
  fen: string
  playerMove: string
  evalBefore: number
  evalAfter: number
  bestMove: string
  playerColor: 'white' | 'black'
}): string {
  const sign = context.playerColor === 'white' ? 1 : -1
  const playerEvalBefore = (context.evalBefore * sign / 100).toFixed(1)
  const playerEvalAfter = (context.evalAfter * sign / 100).toFixed(1)
  const cpLoss = context.playerColor === 'white'
    ? context.evalBefore - context.evalAfter
    : context.evalAfter - context.evalBefore
  const isBestMove = context.playerMove === context.bestMove || cpLoss <= 10

  return `Player (${context.playerColor}) played **${context.playerMove}**.

Position before move (FEN): ${context.fen}
Player's eval before: ${playerEvalBefore} (positive = player is better)
Player's eval after: ${playerEvalAfter}
Centipawn loss: ${cpLoss}cp${context.bestMove && !isBestMove ? `\nStockfish preferred: ${context.bestMove}` : ''}

${isBestMove
    ? `This was the engine's top choice. Briefly explain (2 sentences) what makes this move strong in the position — what does it achieve strategically or tactically?`
    : `The player lost ~${cpLoss}cp. In 2-3 sentences: (1) What was the idea behind ${context.playerMove}? (2) Why is ${context.bestMove} better — what concrete threat or advantage does it create? Be specific about the position, not generic.`
}`
}

export const SYSTEM_PROMPT = `You are a concise chess coach for improving players. Explain moves in plain English using positional and tactical concepts (pins, forks, open files, weak squares, development, king safety, etc). Be specific to the actual position — never give generic advice. Keep it under 3 sentences. Be encouraging but honest.`
