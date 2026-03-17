'use client'

import { useTheme } from '@/lib/theme-context'
import { Icons } from '@/components/ui/Icons'

/** Desktop variant: pill-shaped button with label */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl transition-all duration-300 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
      title={isLight ? 'Schakel naar donker thema' : 'Schakel naar licht thema'}
      aria-label={isLight ? 'Schakel naar donker thema' : 'Schakel naar licht thema'}
    >
      <span className="relative w-5 h-5 flex items-center justify-center">
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isLight ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
          }`}
        >
          <Icons.sunIcon size={18} />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isLight ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
          }`}
        >
          <Icons.moonIcon size={18} />
        </span>
      </span>
      <span className="text-sm">{isLight ? 'Donker' : 'Licht'}</span>
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
