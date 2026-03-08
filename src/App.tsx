import { useState, useCallback, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { ChessGame } from './components/ChessGame'
import { AIConfigModal } from './components/AIConfig'
import { loadAIConfig, type AIConfig } from './hooks/useAI'
import { saasmaker } from './lib/saasmaker'

export default function App() {
  const [showAIConfig, setShowAIConfig] = useState(false)

  useEffect(() => {
    saasmaker.analytics.track({ name: 'page_view', url: window.location.pathname }).catch(() => {});
  }, []);
  const [aiConfig, setAIConfig] = useState<AIConfig>(() => loadAIConfig())

  const handleConfigSave = useCallback((config: AIConfig) => {
    setAIConfig(config)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#1a1a2e' }}>
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">♟</span>
          <div>
            <h1 className="text-lg font-bold text-gray-100 leading-none">Chess Coach</h1>
            <p className="text-xs text-gray-500 mt-0.5">Play vs Stockfish with AI coaching</p>
          </div>
        </div>
        <button
          onClick={() => setShowAIConfig(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">AI Config</span>
        </button>
      </header>

      {/* Main content */}
      <main className="p-3 flex justify-center">
        <div className="w-full max-w-7xl">
          <ChessGame aiConfig={aiConfig} />
        </div>
      </main>

      {/* AI Config Modal */}
      {showAIConfig && (
        <AIConfigModal
          onClose={() => setShowAIConfig(false)}
          onSave={(config) => {
            handleConfigSave(config)
            setShowAIConfig(false)
          }}
        />
      )}
    </div>
  )
}
