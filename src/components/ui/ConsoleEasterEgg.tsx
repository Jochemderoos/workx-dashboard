'use client'

import { useEffect } from 'react'

export default function ConsoleEasterEgg() {
  useEffect(() => {
    // ASCII Art logo
    console.log(`
%c██╗    ██╗ ██████╗ ██████╗ ██╗  ██╗██╗  ██╗
%c██║    ██║██╔═══██╗██╔══██╗██║ ██╔╝╚██╗██╔╝
%c██║ █╗ ██║██║   ██║██████╔╝█████╔╝  ╚███╔╝
%c██║███╗██║██║   ██║██╔══██╗██╔═██╗  ██╔██╗
%c╚███╔███╔╝╚██████╔╝██║  ██║██║  ██╗██╔╝ ██╗
%c ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝`,
      'color: #f9ff85; font-weight: bold;',
      'color: #e0e676; font-weight: bold;',
      'color: #c7cd67; font-weight: bold;',
      'color: #aeb458; font-weight: bold;',
      'color: #959b49; font-weight: bold;',
      'color: #7c823a; font-weight: bold;'
    )

    console.log(
      '%c🎉 Welcome to Workx Dashboard! %c\n' +
      '%c💡 Pro tip: Try the Konami code (↑↑↓↓←→←→BA) for a surprise!\n' +
      '%c💡 Triple-click the version badge for another easter egg!\n',
      'color: #f9ff85; font-size: 16px; font-weight: bold;',
      '',
      'color: #888; font-size: 12px;',
      'color: #888; font-size: 12px;'
    )

    // Silicon Valley themed console group
    console.groupCollapsed('%c🚀 Pied Piper Mode', 'color: #4CAF50; font-weight: bold;')
    console.log('%c"Consider the coconut." 🥥', 'color: #888; font-style: italic;')
    console.log('%c"This guy fucks!" — Russ Hanneman', 'color: #888; font-style: italic;')
    console.log('%c"Making the world a better place" — Gavin Belson', 'color: #888; font-style: italic;')
    console.log('%c"JIAN YANG!!!" — Erlich Bachman', 'color: #888; font-style: italic;')
    console.log('%c"Always blue! Always blue! Always blue!"', 'color: #2196F3; font-style: italic;')
    console.groupEnd()

    // Fun warning message
    console.log(
      '%c⚠️ STOP! ',
      'color: #ff6b6b; font-size: 24px; font-weight: bold;',
    )
    console.log(
      '%cThis is a browser feature intended for developers. If someone told you to copy-paste something here, it is likely a scam and will give them access to your account.',
      'color: #ff6b6b; font-size: 14px;'
    )
    console.log(
      '%c(Just kidding, but seriously, be careful with console commands! 😄)',
      'color: #888; font-size: 12px;'
    )

    // Tres Comas joke
    console.log(
      '\n%c💰 Tres Comas Club Status: %cPending...',
      'color: #FFD700; font-size: 12px; font-weight: bold;',
      'color: #888; font-size: 12px;'
    )
    console.log(
      '%c   Need 3 commas in your bank account: $1,000,000,000',
      'color: #888; font-size: 11px;'
    )

    // Add a secret function to the window for fun
    if (typeof window !== 'undefined') {
      (window as any).piedPiper = () => {
        console.log('%c🎵 Pied Piper Activated!', 'color: #4CAF50; font-size: 20px;')
        console.log('%c"Making the world a better place through constructing elegant hierarchies for maximum code reuse and extensibility."', 'color: #888; font-style: italic;')
        return '🎵 Middle-out compression: ACTIVATED'
      };

      (window as any).aviato = () => {
        console.log('%c✈️ A-V-I-A-T-O', 'color: #2196F3; font-size: 24px; font-weight: bold;')
        console.log('%c"My aviato?"', 'color: #888;')
        console.log('%c"Is there any other Aviato?"', 'color: #888;')
        return '✈️ You know Aviato?'
      };

      (window as any).hotdog = () => {
        const result = Math.random() > 0.5
        if (result) {
          console.log('%c🌭 HOT DOG!', 'color: #4CAF50; font-size: 20px;')
          return 'hotdog'
        } else {
          console.log('%c❌ NOT HOT DOG', 'color: #ff6b6b; font-size: 20px;')
          return 'not hotdog'
        }
      }
    }
  }, [])

  return null
}
