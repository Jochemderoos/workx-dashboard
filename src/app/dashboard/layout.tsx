import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import dynamic from 'next/dynamic'
const EasterEggs = dynamic(() => import('@/components/ui/EasterEggs'), { ssr: false })
const PageTracker = dynamic(() => import('@/components/layout/PageTracker'), { ssr: false })
import DashboardClient from '@/components/layout/DashboardClient'
import DashboardShell from '@/components/layout/DashboardShell'
import ZaakNotificationWrapper from '@/components/zaken/ZaakNotificationWrapper'
import { getPageMeta } from '@/lib/page-metadata'

const BOT_PATTERN = /Slackbot|Slack-ImgProxy|Twitterbot|facebookexternalhit|Facebot|LinkedInBot|WhatsApp|Discordbot|TelegramBot|SkypeUriPreview|Mastodon|Bluesky|Applebot/i

const BASE_URL = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')

// Per-pagina OG/snippet-metadata zodat Slack/Twitter/LinkedIn unfurls de
// juiste titel + beschrijving tonen. Het patroon trekt uit menu-data.ts;
// nieuwe pagina's krijgen automatisch goede metadata zodra ze in het
// menu staan.
export async function generateMetadata(): Promise<Metadata> {
  const h = headers()
  const pathname = h.get('x-pathname') || '/dashboard'
  const search = h.get('x-search') || ''
  const meta = getPageMeta(pathname, search)
  const url = `${BASE_URL}${pathname}${search}`
  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      siteName: 'Workx Dashboard',
      locale: 'nl_NL',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: meta.title,
      description: meta.description,
    },
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Linkpreview-bots: render alleen de page (geen shell, geen auth-check)
  // zodat de OG-tags in <head> bij Slack/Twitter/LinkedIn aankomen.
  const ua = headers().get('user-agent') || ''
  if (BOT_PATTERN.test(ua)) {
    return <>{children}</>
  }

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
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-30">
        <div className="max-w-7xl mx-auto">
          <ZaakNotificationWrapper userRole={user.role}>
            <DashboardClient>
              {children}
            </DashboardClient>
          </ZaakNotificationWrapper>
        </div>
      </main>

      {/* Anonieme pagina-tracking voor gebruiks-analytics */}
      <PageTracker />

      {/* Silicon Valley Easter Eggs - Konami code: ↑↑↓↓←→←→BA */}
      <EasterEggs />
    </DashboardShell>
  )
}
