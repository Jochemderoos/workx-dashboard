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

      {/* Floating doves from workxin.nl (hidden on mobile) - no animation to prevent GPU artifacts */}
      <div className="fixed top-[10%] right-[4%] pointer-events-none z-[1] hidden md:block">
        <Image
          src="/pigeons.svg"
          alt=""
          width={180}
          height={140}
          className="opacity-[0.07] hover:opacity-[0.12] transition-opacity duration-700"
          priority={false}
        />
      </div>
      <div className="fixed top-[20%] left-[2%] pointer-events-none z-[1] hidden md:block" style={{ transform: 'scaleX(-1)' }}>
        <Image
          src="/pigeons.svg"
          alt=""
          width={140}
          height={110}
          className="opacity-[0.05] hover:opacity-[0.1] transition-opacity duration-700"
          priority={false}
        />
      </div>

      {/* Ambient glow effects - using radial-gradient instead of blur filter to prevent rendering artifacts */}
      <div className="fixed top-0 right-0 w-[600px] md:w-[1000px] h-[600px] md:h-[1000px] pointer-events-none" style={{ background: 'radial-gradient(circle at center, rgba(249, 255, 133, 0.04) 0%, transparent 60%)', transform: 'translate(30%, -30%)' }} />
      <div className="fixed bottom-0 left-1/4 w-[400px] md:w-[800px] h-[400px] md:h-[800px] pointer-events-none" style={{ background: 'radial-gradient(circle at center, rgba(249, 255, 133, 0.025) 0%, transparent 60%)', transform: 'translate(-10%, 30%)' }} />

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
