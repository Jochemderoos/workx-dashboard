import { withAuth } from 'next-auth/middleware'
import { NextResponse, type NextRequest } from 'next/server'

// Linkpreview-bots mogen door zonder login zodat hun unfurl de juiste
// per-pagina OG-tags ophaalt (titel + beschrijving). De page-component
// rendert toch geen vertrouwelijke data SSR; alle data komt via /api
// achter een sessie-check.
const BOT_PATTERN = /Slackbot|Slack-ImgProxy|Twitterbot|facebookexternalhit|Facebot|LinkedInBot|WhatsApp|Discordbot|TelegramBot|SkypeUriPreview|Mastodon|Bluesky|Applebot/i

export default withAuth(
  function middleware() {
    return NextResponse.next()
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
