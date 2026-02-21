export type StockfishResult = {
  bestMove: string   // UCI format e.g. "e2e4"
  eval: number       // centipawns (positive = white winning)
  depth: number
}

export class StockfishEngine {
  private worker: Worker | null = null
  private ready = false
  private queue: Array<() => void> = []
  private currentResolve: ((r: StockfishResult) => void) | null = null
  private latestEval = 0
  private latestDepth = 0
  private isTurn = false

  async init() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker('/stockfish.js')

        this.worker.onmessage = (e: MessageEvent<string>) => {
          const msg = typeof e.data === 'string' ? e.data : String(e.data)

          if (msg === 'uciok') {
            this.worker!.postMessage('isready')
          } else if (msg === 'readyok') {
            this.ready = true
            resolve()
            this.processQueue()
          } else {
            this.handleMessage(msg)
          }
        }

        this.worker.onerror = (err) => {
          reject(new Error(`Stockfish worker error: ${err.message}`))
        }

        this.worker.postMessage('uci')
      } catch (err) {
        reject(err)
      }
    })
  }

  private handleMessage(line: string) {
    if (line.startsWith('info') && line.includes('score cp')) {
      const cpMatch = line.match(/score cp (-?\d+)/)
      const depthMatch = line.match(/depth (\d+)/)
      if (cpMatch) this.latestEval = parseInt(cpMatch[1])
      if (depthMatch) this.latestDepth = parseInt(depthMatch[1])
    }
    // Handle mate scores
    if (line.startsWith('info') && line.includes('score mate')) {
      const mateMatch = line.match(/score mate (-?\d+)/)
      if (mateMatch) {
        const mateIn = parseInt(mateMatch[1])
        this.latestEval = mateIn > 0 ? 10000 : -10000
      }
    }
    if (line.startsWith('bestmove')) {
      const parts = line.split(' ')
      const bestMove = parts[1] || '0000'
      if (this.currentResolve) {
        this.currentResolve({ bestMove, eval: this.latestEval, depth: this.latestDepth })
        this.currentResolve = null
        this.isTurn = false
        this.processQueue()
      }
    }
  }

  private processQueue() {
    if (!this.isTurn && this.queue.length > 0) {
      this.isTurn = true
      this.queue.shift()!()
    }
  }

  private runAnalysis(fen: string, skillLevel: number, moveTime: number): Promise<StockfishResult> {
    return new Promise<StockfishResult>((resolve) => {
      this.currentResolve = resolve
      this.latestEval = 0
      this.latestDepth = 0
      this.worker!.postMessage('stop')
      this.worker!.postMessage(`setoption name Skill Level value ${skillLevel}`)
      this.worker!.postMessage(`position fen ${fen}`)
      this.worker!.postMessage(`go movetime ${moveTime}`)
    })
  }

  async analyze(fen: string, skillLevel: number, moveTime: number): Promise<StockfishResult> {
    if (!this.ready) {
      return new Promise((resolve) => {
        this.queue.push(() => this.runAnalysis(fen, skillLevel, moveTime).then(resolve))
      })
    }
    if (this.isTurn) {
      return new Promise((resolve) => {
        this.queue.push(() => this.runAnalysis(fen, skillLevel, moveTime).then(resolve))
      })
    }
    this.isTurn = true
    return this.runAnalysis(fen, skillLevel, moveTime)
  }

  async getBestMove(fen: string): Promise<StockfishResult> {
    return this.analyze(fen, 20, 1500)
  }

  async getEval(fen: string): Promise<StockfishResult> {
    return this.analyze(fen, 20, 500)
  }

  destroy() {
    this.worker?.postMessage('quit')
    this.worker?.terminate()
    this.worker = null
    this.ready = false
    this.queue = []
    this.currentResolve = null
  }
}
