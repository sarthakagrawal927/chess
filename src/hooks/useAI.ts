import { useState, useCallback, useRef } from 'react'
import { buildChessCoachPrompt, SYSTEM_PROMPT } from '../lib/ai-prompts'

export type AIProvider = 'claude-code' | 'codex' | 'gemini-cli' | 'openai' | 'anthropic' | 'google' | 'deepseek'

export const LOCAL_PROVIDERS = new Set<AIProvider>(['claude-code', 'codex', 'gemini-cli'])
export const IS_LOCAL = import.meta.env.DEV

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
}

const AI_CONFIG_KEY = 'chess-coach-ai-config'

const MODELS: Record<AIProvider, string[]> = {
  'claude-code': ['claude-code-local'],
  'codex': ['codex-local'],
  'gemini-cli': ['gemini-cli-local'],
  openai: ['gpt-4.1-nano', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o', 'o4-mini'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929', 'claude-opus-4-6'],
  google: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
}

export function getModels(provider: AIProvider): string[] {
  return MODELS[provider] || []
}

export function loadAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch { }
  return IS_LOCAL
    ? { provider: 'claude-code' as AIProvider, apiKey: '', model: 'claude-code-local' }
    : { provider: 'anthropic' as AIProvider, apiKey: '', model: 'claude-sonnet-4-5-20250929' }
}

export function saveAIConfig(config: AIConfig) {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config))
}

interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

// SSE parsers per provider — the serverless proxy streams the upstream response as-is
const CHUNK_PARSERS: Record<string, (line: string) => string | null> = {
  anthropic: (line) => {
    const json = JSON.parse(line.slice(6))
    return json.type === 'content_block_delta' ? json.delta?.text ?? null : null
  },
  google: (line) => {
    const json = JSON.parse(line.slice(6))
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null
  },
  _openai: (line) => {
    const json = JSON.parse(line.slice(6))
    return json.choices?.[0]?.delta?.content ?? null
  },
}

async function streamCloudProxy(
  config: AIConfig,
  messages: AIMessage[],
  systemContext: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
) {
  const res = await fetch('/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      messages,
      systemPrompt: systemContext,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Coach API error: ${res.status} - ${err}`)
  }

  const parse = CHUNK_PARSERS[config.provider] || CHUNK_PARSERS._openai
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const text = parse(line)
          if (text) onChunk(text)
        } catch { }
      }
    }
  }
}

const LOCAL_TOOL_MAP: Partial<Record<AIProvider, string>> = {
  'claude-code': 'claude',
  'codex': 'codex',
  'gemini-cli': 'gemini',
}

async function streamLocalCLI(
  config: AIConfig,
  messages: AIMessage[],
  systemContext: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
) {
  const tool = LOCAL_TOOL_MAP[config.provider] || 'claude'
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      systemPrompt: systemContext,
      tool,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Local CLI server error: ${res.status} - ${err}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.slice(6))
          if (json.text) onChunk(json.text)
          if (json.error) throw new Error(json.error)
        } catch (e: unknown) {
          const err = e as Error
          if (err.message && !err.message.includes('JSON')) throw e
        }
      }
    }
  }
}

export interface CoachContext {
  fen: string
  playerMove: string
  evalBefore: number
  evalAfter: number
  bestMove: string
  playerColor: 'white' | 'black'
}

export function useChessCoach() {
  const [explanation, setExplanation] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const evaluate = useCallback(async (context: CoachContext, config: AIConfig) => {
    // Abort any in-progress stream
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setExplanation('')
    setIsStreaming(true)
    setError(null)

    if (!LOCAL_PROVIDERS.has(config.provider) && !config.apiKey) {
      setError('No API key configured. Open AI Config (gear icon) to add your key.')
      setIsStreaming(false)
      return
    }

    const prompt = buildChessCoachPrompt(context)
    const messages: AIMessage[] = [{ role: 'user', content: prompt }]
    const systemContext = SYSTEM_PROMPT

    const onChunk = (text: string) => {
      setExplanation(prev => prev + text)
    }

    try {
      const streamFn = LOCAL_PROVIDERS.has(config.provider)
        ? streamLocalCLI
        : streamCloudProxy

      await streamFn(config, messages, systemContext, onChunk, abortRef.current.signal)
    } catch (e: unknown) {
      const err = e as Error
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to get coaching explanation')
      }
    } finally {
      setIsStreaming(false)
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return { explanation, isStreaming, error, evaluate, cancel }
}
