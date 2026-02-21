export type DifficultyLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface DifficultyConfig {
  skillLevel: number
  moveTime: number
  label: string
}

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  0: { skillLevel: 0, moveTime: 50, label: 'Beginner' },
  1: { skillLevel: 4, moveTime: 100, label: 'Easy' },
  2: { skillLevel: 8, moveTime: 300, label: 'Intermediate' },
  3: { skillLevel: 13, moveTime: 600, label: 'Hard' },
  4: { skillLevel: 18, moveTime: 1200, label: 'Expert' },
  5: { skillLevel: 20, moveTime: 2000, label: 'Max' },
}

const LEVEL_COLORS: Record<DifficultyLevel, string> = {
  0: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500',
  1: 'bg-green-600 hover:bg-green-500 border-green-500',
  2: 'bg-yellow-600 hover:bg-yellow-500 border-yellow-500',
  3: 'bg-orange-600 hover:bg-orange-500 border-orange-500',
  4: 'bg-red-600 hover:bg-red-500 border-red-500',
  5: 'bg-purple-700 hover:bg-purple-600 border-purple-500',
}

const LEVEL_COLORS_INACTIVE: Record<DifficultyLevel, string> = {
  0: 'border-emerald-700 text-emerald-400 hover:bg-emerald-900',
  1: 'border-green-700 text-green-400 hover:bg-green-900',
  2: 'border-yellow-700 text-yellow-400 hover:bg-yellow-900',
  3: 'border-orange-700 text-orange-400 hover:bg-orange-900',
  4: 'border-red-700 text-red-400 hover:bg-red-900',
  5: 'border-purple-700 text-purple-400 hover:bg-purple-900',
}

interface DifficultyPickerProps {
  difficulty: DifficultyLevel
  onChange: (level: DifficultyLevel) => void
  disabled?: boolean
}

export function DifficultyPicker({ difficulty, onChange, disabled }: DifficultyPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Difficulty</div>
      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(DIFFICULTY_CONFIGS) as unknown as DifficultyLevel[]).map((level) => {
          const lvl = Number(level) as DifficultyLevel
          const config = DIFFICULTY_CONFIGS[lvl]
          const isActive = difficulty === lvl
          return (
            <button
              key={level}
              onClick={() => onChange(lvl)}
              disabled={disabled}
              className={`
                px-2 py-1.5 rounded text-xs font-semibold border transition-colors
                ${isActive
                  ? `${LEVEL_COLORS[lvl]} text-white`
                  : `bg-transparent ${LEVEL_COLORS_INACTIVE[lvl]}`
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {config.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
