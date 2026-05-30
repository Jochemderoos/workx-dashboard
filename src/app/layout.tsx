import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Toaster } from 'react-hot-toast'
import dynamic from 'next/dynamic'
const ConsoleEasterEgg = dynamic(() => import('@/components/ui/ConsoleEasterEgg'), { ssr: false })
const PWARegister = dynamic(() => import('@/components/PWARegister'), { ssr: false })
const StaleVersionGuard = dynamic(() => import('@/components/StaleVersionGuard'), { ssr: false })

// Alleen de weights die we daadwerkelijk gebruiken (was: alle 9 weights = ~700KB).
// display: 'swap' voorkomt FOUT — system-font tot Inter is geladen.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e1e1e',
}

export const metadata: Metadata = {
  title: 'Workx Dashboard',
  description: 'Intern dashboard voor Workx Advocaten',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Workx',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
}

// Anti-FOUC: inline script that runs before React hydration
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('workx-theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.setAttribute('data-theme', 'dark');
  } catch(e) {}
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        {/* Preconnect: team-foto's komen van workxadvocaten.nl — spaart een DNS+TLS rondje */}
        <link rel="preconnect" href="https://www.workxadvocaten.nl" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.workxadvocaten.nl" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <PWARegister />
          <StaleVersionGuard />
          <ConsoleEasterEgg />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              },
              success: {
                iconTheme: {
                  primary: '#f9ff85',
                  secondary: '#1e1e1e',
                },
              },
            }}
          />
          {/* Portal for date picker popups */}
          <div id="datepicker-portal" />
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}
