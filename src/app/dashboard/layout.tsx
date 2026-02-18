import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import dynamic from 'next/dynamic'
const EasterEggs = dynamic(() => import('@/components/ui/EasterEggs'), { ssr: false })
import DashboardClient from '@/components/layout/DashboardClient'
import DashboardShell from '@/components/layout/DashboardShell'
import ZaakNotificationWrapper from '@/components/zaken/ZaakNotificationWrapper'

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
    <DashboardShell sidebar={<Sidebar user={user} />}>
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

      {/* Silicon Valley Easter Eggs - Konami code: ↑↑↓↓←→←→BA */}
      <EasterEggs />
    </DashboardShell>
  )
}
