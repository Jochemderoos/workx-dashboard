'use client'

import { useState, useEffect, useCallback } from 'react'

// Silicon Valley quotes
const siliconValleyQuotes = [
  "This guy fucks! 🎉",
  "I've been known to fuck myself. — Russ Hanneman",
  "Consider the coconut. 🥥",
  "RIGBY! — Jared Dunn",
  "Middle-out compression activated! 📦",
  "Not hot dog. 🌭",
  "Tres Comas Club 🍾",
  "Do you want to die today, motherfucker? — Erlich",
  "You just brought piss to a shit fight. — Erlich",
  "I'm a billionaire! I drive a matte gold Tesla! — Russ",
  "Always blue! Always blue! Always blue!",
  "JIAN YANG!!! 🏠",
  "Delete Facebook. — Gavin Belson",
  "Pivot! — Every startup ever",
  "This is the new Erlich Bachman. — Jian Yang",
  "Pied Piper makes the world a better place 🌍",
  "Optimal tip-to-tip efficiency 📐",
  "Aviato. — Erlich Bachman",
]

// Konami code: ↑↑↓↓←→←→BA
const konamiCode = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA'
]

export default function EasterEggs() {
  const [showEasterEgg, setShowEasterEgg] = useState(false)
  const [currentQuote, setCurrentQuote] = useState('')
  const [keySequence, setKeySequence] = useState<string[]>([])
  const [showPiedPiper, setShowPiedPiper] = useState(false)

  const triggerEasterEgg = useCallback(() => {
    const randomQuote = siliconValleyQuotes[Math.floor(Math.random() * siliconValleyQuotes.length)]
    setCurrentQuote(randomQuote)
    setShowEasterEgg(true)

    // Play a fun sound (optional - browser might block)
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdXaBhYWFhYV/dXFuaWdrb3R5fX1/fXt3c29raWdpbHB0eHt9fXt5dXFtamlqa25zeHt9fXt3c29raWlrbXJ3e319e3dzcG1paWpscHV5fH18eXVxbWppaWtuc3h7fXt5dXFtamlpam1yd3t9e3l1cW1qaWlrbXJ3e319eXVxbWppamtucnd7fXt5dXFtamlpa25yd3t7eXVxbWppamtuc3d7e3l1cW1qaWlrbHB1eXx8eXVxbWppaWtscHV5fHx5dXFtamlpa2xwd3p8e3l1cG1paWlrbHF1eXt7eHRwbWppaGptcHR4e3t4dHBsaWlpa21wd3t8eHRwbGlpaWtscHV5fHp2cm5raWlqa25yd3p7eHRwbGlpaGptcHV5e3l1cG1qaWlqa25yd3p6dnJubGlpaWtucnZ6e3h0cGxpaWlrbXF2ent3c29samlpa21xdnp6dnJubGlpaWptcXZ6eXVxbWppaWlrbXJ2enh0cG5ramlpa21ydnp4dHBuamppamtuc3Z5d3NvbWpqaWlrbXJ2eXd0cG5ramppamtucnZ4dHBua2ppamptcXV4d3Nwbmtqamlqa25yd3h0cG5ramlqa2xvcnZ4dHBua2pqaWptcHN2eHRwbmtqamlqbG9zdnh0cG5ramppa2xvc3Z4dHBua2pqaWptb3J2eHRxbmtqamlqbG9ydnh1cW5ramppamtvdHd2c29samtqa2xvc3Z4dXJvbGtqamprbXF0d3Zybmxrampqa2xvc3Z2c29ubGpqa2ttcHN2dnNvbmxramtqbG9zdnZzbm1ra2pra2xvcnV2cm5sa2prbGtscHN1dm9ubWxramprbHBzdnRwbm1ra2pra2xvc3V0cG9tbGtqamtscHN1cm9ubGxramttb3J0c29ubWxra2prbnF0dHBubWxrampqa21wc3RxbW5tbGtra2tucXN0cG5ubWxra2tsbm9zdHBubmxsamprbnJ1dG9tbmxraWptb3F0cG9ubmxsa2ttbm9ydHBvbm1samtsbW5xcXBubm1ramttb3BycW5ubGxqaWxtb3FxcG5ubGxqamxtb3Fxb25tbGtqam1ucHFvbm5tbGtqbG1ucHJvbm5tbGtrbG1ucHFub25tbGtrbG1ucHBubm5tbWxsbG1ub29ubW1tbGxsbW1ubm5tbW1tbGxsbW1tbW1tbG1tbGxsbGxsbGxsbGxsbGxsbGxsAA==')
      audio.volume = 0.3
      audio.play().catch(() => {})
    } catch (e) {}

    setTimeout(() => setShowEasterEgg(false), 4000)
  }, [])

  // Konami code detector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.code
      const newSequence = [...keySequence, key].slice(-10)
      setKeySequence(newSequence)

      if (newSequence.join(',') === konamiCode.join(',')) {
        triggerEasterEgg()
        setKeySequence([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [keySequence, triggerEasterEgg])

  // Click counter for secret Pied Piper mode
  useEffect(() => {
    let clickCount = 0
    let clickTimer: NodeJS.Timeout

    const handleTripleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Triple click on version badge
      if (target.closest('.badge-lime') || target.textContent?.includes('v2.0')) {
        clickCount++
        clearTimeout(clickTimer)
        clickTimer = setTimeout(() => { clickCount = 0 }, 500)

        if (clickCount >= 3) {
          setShowPiedPiper(true)
          setTimeout(() => setShowPiedPiper(false), 3000)
          clickCount = 0
        }
      }
    }

    window.addEventListener('click', handleTripleClick)
    return () => {
      window.removeEventListener('click', handleTripleClick)
      clearTimeout(clickTimer)
    }
  }, [])

  if (!showEasterEgg && !showPiedPiper) return null

  return (
    <>
      {/* Konami code easter egg */}
      {showEasterEgg && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" />
          <div className="relative animate-bounceIn">
            <div className="bg-gradient-to-br from-workx-lime to-green-400 text-workx-dark px-8 py-6 rounded-2xl shadow-2xl transform max-w-md text-center">
              <div className="text-4xl mb-3">🚀</div>
              <p className="text-lg font-bold whitespace-pre-line">{currentQuote}</p>
              <p className="text-xs mt-3 opacity-60">— Silicon Valley Easter Egg —</p>
            </div>
          </div>
        </div>
      )}

      {/* Pied Piper mode */}
      {showPiedPiper && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 to-green-900/90 backdrop-blur-sm animate-fadeIn" />
          <div className="relative animate-bounceIn text-center">
            <div className="text-8xl mb-4">🎵</div>
            <h1 className="text-5xl font-bold text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>
              Pied Piper
            </h1>
            <p className="text-green-400 text-lg">Making the world a better place</p>
            <p className="text-white/40 text-sm mt-4">Through minimal message-oriented transport layers</p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-bounceIn {
          animation: bounceIn 0.5s ease-out;
        }
      `}</style>
    </>
  )
}
