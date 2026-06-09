import { withAuth } from 'next-auth/middleware'
import { NextResponse, type NextRequest } from 'next/server'

// Linkpreview-bots mogen door zonder login zodat hun unfurl de juiste
// per-pagina OG-tags ophaalt. De page-componenten halen alle data via
// /api achter een sessie-check — bots krijgen alleen de HTML met head.
const BOT_PATTERN = /Slackbot|Slack-ImgProxy|Twitterbot|facebookexternalhit|Facebot|LinkedInBot|WhatsApp|Discordbot|TelegramBot|SkypeUriPreview|Mastodon|Bluesky|Applebot/i

export default withAuth(
  function middleware(req) {
    // Geef pathname + querystring door als header zodat generateMetadata
    // in de dashboard-layout per-pagina metadata kan teruggeven.
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-pathname', req.nextUrl.pathname)
    requestHeaders.set('x-search', req.nextUrl.search || '')
    return NextResponse.next({ request: { headers: requestHeaders } })
  },
  {
    callbacks: {
      authorized: ({ token, req }: { token: unknown; req: NextRequest }) => {
        const ua = req.headers.get('user-agent') || ''
        if (BOT_PATTERN.test(ua)) return true
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*'],
}
