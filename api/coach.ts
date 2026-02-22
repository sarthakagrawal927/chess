import type { VercelRequest, VercelResponse } from '@vercel/node'

type Provider = 'openai' | 'anthropic' | 'google' | 'deepseek'

const VALID_PROVIDERS = new Set<string>(['openai', 'anthropic', 'google', 'deepseek'])

const OPENAI_COMPAT_URLS: Partial<Record<Provider, string>> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  provider: Provider
  model: string
  apiKey: string
  messages: Message[]
  systemPrompt: string
}

async function proxyAnthropic(
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  res: VercelResponse
) {
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  })

  if (!upstream.ok) {
    const err = await upstream.text()
    res.status(upstream.status).end(err)
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const reader = upstream.body!.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(decoder.decode(value, { stream: true }))
    }
  } finally {
    res.end()
  }
}

async function proxyOpenAICompat(
  provider: Provider,
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  res: VercelResponse
) {
  const url = OPENAI_COMPAT_URLS[provider] || OPENAI_COMPAT_URLS.openai!

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  })

  if (!upstream.ok) {
    const err = await upstream.text()
    res.status(upstream.status).end(err)
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const reader = upstream.body!.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(decoder.decode(value, { stream: true }))
    }
  } finally {
    res.end()
  }
}

async function proxyGoogle(
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  res: VercelResponse
) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
      }),
    }
  )

  if (!upstream.ok) {
    const err = await upstream.text()
    res.status(upstream.status).end(err)
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const reader = upstream.body!.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(decoder.decode(value, { stream: true }))
    }
  } finally {
    res.end()
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { provider, model, apiKey, messages, systemPrompt } = req.body as RequestBody

  if (!provider || !model || !apiKey || !messages || !systemPrompt) {
    res.status(400).json({ error: 'Missing required fields: provider, model, apiKey, messages, systemPrompt' })
    return
  }

  if (!VALID_PROVIDERS.has(provider)) {
    res.status(400).json({ error: `Unknown provider: ${provider}` })
    return
  }

  try {
    if (provider === 'anthropic') {
      await proxyAnthropic(apiKey, model, messages, systemPrompt, res)
    } else if (provider === 'google') {
      await proxyGoogle(apiKey, model, messages, systemPrompt, res)
    } else {
      await proxyOpenAICompat(provider, apiKey, model, messages, systemPrompt, res)
    }
  } catch (e: unknown) {
    const err = e as Error
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal server error' })
    }
  }
}
