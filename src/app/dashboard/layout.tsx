import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import EasterEggs from '@/components/ui/EasterEggs'
import DashboardClient from '@/components/layout/DashboardClient'
import ZaakNotificationWrapper from '@/components/zaken/ZaakNotificationWrapper'
import Image from 'next/image'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/login')
  }

  const user = {
    id: session.user.id || 'unknown',
    name: session.user.name || 'Gebruiker',
    email: session.user.email || '',
    role: session.user.role || 'EMPLOYEE'
  }

  return (
    <div className="flex h-screen bg-workx-dark overflow-hidden">

      {/* Decorative elements temporarily removed to debug transparent bar artifacts */}

      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:flex h-full">
        <Sidebar user={user} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative w-full">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            <ZaakNotificationWrapper userRole={user.role}>
              <DashboardClient>
                {children}
              </DashboardClient>
            </ZaakNotificationWrapper>
          </div>
        </main>
      </div>

      {/* Silicon Valley Easter Eggs - Konami code: ↑↑↓↓←→←→BA */}
      <EasterEggs />
    </div>
  )
}
