import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Workx Dashboard',
  description: 'Intern dashboard voor Workx Advocaten',
  icons: {
    icon: '/favicon.ico',
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
        </Providers>
      </body>
    </html>
  )
}
