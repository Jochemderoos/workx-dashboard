'use client'

import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues
const ZaakNotificationProvider = dynamic(
  () => import('./ZaakNotificationProvider'),
  { ssr: false }
)

interface ZaakNotificationWrapperProps {
  children: React.ReactNode
  userRole: string
}

export default function ZaakNotificationWrapper({ children, userRole }: ZaakNotificationWrapperProps) {
  return (
    <ZaakNotificationProvider userRole={userRole}>
      {children}
    </ZaakNotificationProvider>
  )
}
