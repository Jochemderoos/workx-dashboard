import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Toaster } from 'react-hot-toast'
import ConsoleEasterEgg from '@/components/ui/ConsoleEasterEgg'
import PWARegister from '@/components/PWARegister'

const inter = Inter({ subsets: ['latin'] })

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body className={`${inter.className} bg-workx-dark text-white antialiased`}>
        <Providers>
          <PWARegister />
          <ConsoleEasterEgg />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#2a2a2a',
                color: '#fff',
                border: '1px solid #404041',
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
        </Providers>
      </body>
    </html>
  )
}
