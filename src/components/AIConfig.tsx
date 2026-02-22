import { useState } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import {
  type AIConfig,
  type AIProvider,
  getModels,
  loadAIConfig,
  saveAIConfig,
  LOCAL_PROVIDERS,
} from '../hooks/useAI'

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code (local CLI)' },
  { value: 'gemini-cli', label: 'Gemini CLI (local)' },
  { value: 'codex', label: 'Codex CLI (local)' },
  { value: 'anthropic', label: 'Anthropic API' },
  { value: 'openai', label: 'OpenAI API' },
  { value: 'google', label: 'Google AI API' },
  { value: 'deepseek', label: 'DeepSeek API' },
]

interface AIConfigModalProps {
  onClose: () => void
  onSave: (config: AIConfig) => void
}

export function AIConfigModal({ onClose, onSave }: AIConfigModalProps) {
  const [config, setConfig] = useState<AIConfig>(() => loadAIConfig())
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  const isLocal = LOCAL_PROVIDERS.has(config.provider)
  const models = getModels(config.provider)

  const handleProviderChange = (provider: AIProvider) => {
    const newModels = getModels(provider)
    setConfig({ provider, apiKey: '', model: newModels[0] || '' })
    setSaved(false)
  }

  const handleSave = () => {
    saveAIConfig(config)
    onSave(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">AI Coach Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400">Provider</label>
            <select
              value={config.provider}
              onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
              className="bg-gray-800 border border-gray-600 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400">Model</label>
            <select
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              className="bg-gray-800 border border-gray-600 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {isLocal ? (
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-sm text-blue-300">
              Local CLI providers don't need an API key. Make sure the CLI tool is installed and authenticated.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-400">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(e) => { setConfig({ ...config, apiKey: e.target.value }); setSaved(false) }}
                  placeholder="sk-..."
                  className="w-full bg-gray-800 border border-gray-600 text-gray-100 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">Your key is sent through our server proxy — never directly to the provider from your browser.</p>
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
          >
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
