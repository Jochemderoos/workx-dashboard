'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/ui/Icons'

interface Shortcut {
  keys: string[]
  description: string
  action: () => void
  category: 'navigation' | 'actions' | 'search'
}

interface KeyboardShortcutsProps {
  onToggleSearch?: () => void
}

export function KeyboardShortcuts({ onToggleSearch }: KeyboardShortcutsProps) {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set())

  // Define all shortcuts
  const shortcuts: Shortcut[] = [
    // Navigation shortcuts (g + key)
    { keys: ['g', 'h'], description: 'Ga naar Dashboard', action: () => router.push('/dashboard'), category: 'navigation' },
    { keys: ['g', 't'], description: 'Ga naar Team', action: () => router.push('/dashboard/team'), category: 'navigation' },
    { keys: ['g', 'w'], description: 'Ga naar Werk', action: () => router.push('/dashboard/werk'), category: 'navigation' },
    { keys: ['g', 'a'], description: 'Ga naar Agenda', action: () => router.push('/dashboard/agenda'), category: 'navigation' },
    { keys: ['g', 'v'], description: 'Ga naar Vakanties', action: () => router.push('/dashboard/vakanties'), category: 'navigation' },
    { keys: ['g', 'f'], description: 'Ga naar Financien', action: () => router.push('/dashboard/financien'), category: 'navigation' },
    { keys: ['g', 'c'], description: 'Ga naar Chat', action: () => router.push('/dashboard/chat'), category: 'navigation' },
    { keys: ['g', 's'], description: 'Ga naar Instellingen', action: () => router.push('/dashboard/settings'), category: 'navigation' },
    { keys: ['g', 'l'], description: 'Ga naar Lustrum', action: () => router.push('/dashboard/lustrum'), category: 'navigation' },
    { keys: ['g', 'p'], description: 'Ga naar Appjeplekje', action: () => router.push('/dashboard/appjeplekje'), category: 'navigation' },

    // Action shortcuts
    { keys: ['?'], description: 'Toon sneltoetsen', action: () => setShowHelp(true), category: 'actions' },
    { keys: ['Escape'], description: 'Sluit dialoog / menu', action: () => setShowHelp(false), category: 'actions' },

    // Search shortcut
    { keys: ['/'], description: 'Focus zoekbalk', action: () => onToggleSearch?.(), category: 'search' },
    { keys: ['Meta', 'k'], description: 'Open spotlight zoeken', action: () => onToggleSearch?.(), category: 'search' },
  ]

  // Handle key events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Only allow Escape in inputs
      if (event.key === 'Escape') {
        setShowHelp(false)
      }
      return
    }

    // Add key to pressed set
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    setPressedKeys(prev => new Set(prev).add(key))

    // Check for matching shortcuts
    const currentKeys = new Set(pressedKeys).add(key)

    for (const shortcut of shortcuts) {
      const shortcutKeys = shortcut.keys.map(k => k.toLowerCase())

      // Check if all keys in the shortcut are pressed
      if (shortcutKeys.every(k => currentKeys.has(k)) && shortcutKeys.length === currentKeys.size) {
        event.preventDefault()
        shortcut.action()
        setPressedKeys(new Set())
        return
      }
    }

    // Special handling for '?' key
    if (event.key === '?' || (event.shiftKey && event.key === '/')) {
      event.preventDefault()
      setShowHelp(true)
    }

    // Clear keys after a short delay (for sequences like g+h)
    setTimeout(() => {
      setPressedKeys(new Set())
    }, 500)
  }, [pressedKeys, shortcuts, onToggleSearch])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    setPressedKeys(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  // Group shortcuts by category
  const navigationShortcuts = shortcuts.filter(s => s.category === 'navigation')
  const actionShortcuts = shortcuts.filter(s => s.category === 'actions')
  const searchShortcuts = shortcuts.filter(s => s.category === 'search')

  if (!showHelp) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setShowHelp(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-workx-dark border border-white/10 rounded-2xl shadow-2xl animate-modal-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-workx-lime/20 flex items-center justify-center">
              <Icons.command size={20} className="text-workx-lime" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Sneltoetsen</h2>
              <p className="text-sm text-gray-400">Navigeer sneller door het dashboard</p>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Icons.x size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto workx-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Navigation */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                Navigatie
              </h3>
              <div className="space-y-2">
                {navigationShortcuts.map((shortcut, i) => (
                  <ShortcutRow key={i} shortcut={shortcut} />
                ))}
              </div>
            </div>

            {/* Actions & Search */}
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Zoeken
                </h3>
                <div className="space-y-2">
                  {searchShortcuts.map((shortcut, i) => (
                    <ShortcutRow key={i} shortcut={shortcut} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Acties
                </h3>
                <div className="space-y-2">
                  {actionShortcuts.map((shortcut, i) => (
                    <ShortcutRow key={i} shortcut={shortcut} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02]">
          <p className="text-xs text-gray-500 text-center">
            Druk op <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">?</kbd> om dit venster te openen
          </p>
        </div>
      </div>
    </div>
  )
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-300">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, i) => (
          <span key={i}>
            {i > 0 && <span className="text-gray-500 mx-1">+</span>}
            <kbd className="px-2 py-1 rounded-lg bg-white/10 text-white font-mono text-xs border border-white/10">
              {formatKey(key)}
            </kbd>
          </span>
        ))}
      </div>
    </div>
  )
}

function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    'Meta': '⌘',
    'Control': 'Ctrl',
    'Alt': 'Alt',
    'Shift': '⇧',
    'Escape': 'Esc',
    'Enter': '↵',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
  }
  return keyMap[key] || key.toUpperCase()
}

export default KeyboardShortcuts
