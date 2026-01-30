import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { Pigeon } from '@/components/ui/Icons'

const fakeUser = {
  id: 'admin',
  name: 'Admin Workx',
  email: 'admin@workxadvocaten.nl',
  role: 'ADMIN'
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

      <Sidebar user={fakeUser} />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <TopBar user={fakeUser} />
        <main className="flex-1 overflow-y-auto p-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
