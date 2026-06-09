// Per-route metadata zodat Slack/Twitter/LinkedIn unfurls de juiste
// titel + beschrijving tonen i.p.v. de algemene "Workx Dashboard"-snippet.
// De middleware laat bots door zonder login zodat ze deze server-rendered
// HTML kunnen ophalen.

import type { Metadata } from 'next'

const BASE_URL = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const URL = `${BASE_URL}/dashboard/ontwikkelplannen`
const TITLE = 'Ontwikkelplan — Workx Dashboard'
const DESCRIPTION = 'Vul je persoonlijke ontwikkelplan in: inhoud (theorie + praktijk), eigen praktijk en zaken, en intern. Vind ook je eerdere plannen terug.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: 'Workx Dashboard',
    locale: 'nl_NL',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function OntwikkelplannenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
