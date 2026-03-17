'use client'

import { useTheme } from '@/lib/theme-context'
import { Icons } from '@/components/ui/Icons'

/** Desktop variant: prominent pill-shaped button with animated toggle */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      onClick={toggleTheme}
      className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-300 border"
      style={{
        background: isLight
          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08))'
          : 'linear-gradient(135deg, rgba(249, 255, 133, 0.08), rgba(250, 204, 21, 0.08))',
        borderColor: isLight
          ? 'rgba(99, 102, 241, 0.2)'
          : 'rgba(249, 255, 133, 0.15)',
      }}
      title={isLight ? 'Schakel naar donker thema' : 'Schakel naar licht thema'}
      aria-label={isLight ? 'Schakel naar donker thema' : 'Schakel naar licht thema'}
    >
      {/* Animated icon */}
      <span className="relative w-6 h-6 flex items-center justify-center">
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            isLight ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
          }`}
          style={{ color: '#facc15' }}
        >
          <Icons.sunIcon size={20} />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            isLight ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
          }`}
          style={{ color: '#818cf8' }}
        >
          <Icons.moonIcon size={20} />
        </span>
      </span>

      {/* Label + description */}
      <div className="flex-1 text-left">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {isLight ? 'Donker' : 'Licht'}
        </span>
        <span className="text-[10px] ml-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
          modus
        </span>
      </div>

      {/* Toggle switch indicator */}
      <div
        className="w-9 h-5 rounded-full relative transition-all duration-300 flex-shrink-0"
        style={{
          background: isLight
            ? 'linear-gradient(135deg, #818cf8, #6366f1)'
            : 'linear-gradient(135deg, #f9ff85, #facc15)',
        }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300"
          style={{ left: isLight ? '18px' : '2px' }}
        />
      </div>
    </button>
  )
}

/** Mobile variant: compact icon-only button */
export function ThemeToggleCompact() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl transition-all duration-300 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]"
      title={isLight ? 'Schakel naar donker thema' : 'Schakel naar licht thema'}
      aria-label={isLight ? 'Schakel naar donker thema' : 'Schakel naar licht thema'}
    >
      <span className="relative w-5 h-5 flex items-center justify-center">
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isLight ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
          }`}
        >
          <Icons.sunIcon size={16} />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isLight ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
          }`}
        >
          <Icons.moonIcon size={16} />
        </span>
      </span>
    </button>
  )
}
