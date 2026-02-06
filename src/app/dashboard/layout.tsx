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

      {/* Floating doves from workxin.nl (hidden on mobile) */}
      <div className="pigeon pigeon-1 hidden md:block">
        <Image
          src="/pigeons.svg"
          alt=""
          width={180}
          height={140}
          className="opacity-[0.07] hover:opacity-[0.12] transition-opacity duration-700"
          priority={false}
        />
      </div>
      <div className="pigeon pigeon-2 hidden md:block" style={{ transform: 'scaleX(-1)' }}>
        <Image
          src="/pigeons.svg"
          alt=""
          width={140}
          height={110}
          className="opacity-[0.05] hover:opacity-[0.1] transition-opacity duration-700"
          priority={false}
        />
      </div>

      {/* Ambient glow effects (smaller on mobile) */}
      <div className="fixed top-0 right-0 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-workx-lime/5 rounded-full blur-[100px] md:blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-[200px] md:w-[400px] h-[200px] md:h-[400px] bg-workx-lime/3 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />

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
