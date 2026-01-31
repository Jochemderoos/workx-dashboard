import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { Pigeon } from '@/components/ui/Icons'

// Demo user voor als er geen echte sessie is
const demoUser = {
  id: 'demo',
  name: 'Demo Gebruiker',
  email: 'demo@workxadvocaten.nl',
  role: 'EMPLOYEE'
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Probeer echte sessie te krijgen, anders gebruik demo
  let user = demoUser

  try {
    const session = await getServerSession(authOptions)
    if (session?.user) {
      user = {
        id: session.user.id || 'unknown',
        name: session.user.name || 'Gebruiker',
        email: session.user.email || '',
        role: (session.user as any).role || 'EMPLOYEE'
      }
    }
  } catch (e) {
    // Bij fout, gebruik demo user
    console.log('Using demo user (no session)')
  }

  return (
    <div className="flex h-screen bg-workx-dark overflow-hidden">
      {/* Grachtenpand silhouette at bottom */}
      <div className="grachtenpand" />

      {/* Animated pigeons - like workxin.nl */}
      <Pigeon className="pigeon pigeon-1" size={50} />
      <Pigeon className="pigeon pigeon-2" size={40} />
      <Pigeon className="pigeon pigeon-3" size={45} />

      {/* Ambient glow effects */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-workx-lime/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-[400px] h-[400px] bg-workx-lime/3 rounded-full blur-[120px] pointer-events-none" />

      <Sidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
