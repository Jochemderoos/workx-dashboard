import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { logAuditAction } from './audit-log'
import { getLoginBlockSeconds, recordFailedLogin, clearFailedLogins } from './rate-limiter'

// Eén generieke foutmelding voor 'account bestaat niet', 'verkeerd wachtwoord'
// en 'account gedeactiveerd'. Anders kan iemand van buiten via het inlogscherm
// uitvragen wélke e-mailadressen bestaan.
const INVALID_LOGIN = 'E-mailadres of wachtwoord is onjuist'

function ipFromAuthorizeReq(req: unknown): string {
  const headers = (req as { headers?: Record<string, string> } | undefined)?.headers
  const forwarded = headers?.['x-forwarded-for']
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers?.['x-real-ip'] || 'unknown'
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Wachtwoord', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Vul email en wachtwoord in')
        }

        // Brute-force rem: alleen mislukte pogingen tellen mee, dus normaal
        // inloggen merkt hier niets van.
        const ip = ipFromAuthorizeReq(req)
        const blockedFor = getLoginBlockSeconds(credentials.email, ip)
        if (blockedFor !== null) {
          const minutes = Math.max(1, Math.ceil(blockedFor / 60))
          throw new Error(`Te veel mislukte pogingen. Probeer het over ${minutes} minuut${minutes === 1 ? '' : 'en'} opnieuw.`)
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          recordFailedLogin(credentials.email, ip)
          throw new Error(INVALID_LOGIN)
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          recordFailedLogin(credentials.email, ip)
          throw new Error(INVALID_LOGIN)
        }

        // Uit dienst / gedeactiveerd account mag niet meer inloggen.
        if (!user.isActive) {
          recordFailedLogin(credentials.email, ip)
          throw new Error(INVALID_LOGIN)
        }

        clearFailedLogins(credentials.email, ip)

        // Gebruiks-tracking: login bijhouden (mag login nooit doen falen).
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
          })
          await logAuditAction({
            userId: user.id,
            action: 'LOGIN',
            entityType: 'User',
            entityId: user.id,
            description: 'Ingelogd op het dashboard',
          })
        } catch (e) {
          console.error('Login-tracking mislukt:', e)
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 90 * 24 * 60 * 60, // 90 dagen — sessie blijft 90 dagen geldig
    updateAge: 24 * 60 * 60,   // elke 24u activiteit verlengt 'm met 90 dagen
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      } else if (token.id) {
        // Ververs de rol bij elke request live uit de database, zodat een
        // rolwijziging (bijv. ADMIN → OFFICE_MANAGER) direct doorwerkt zonder
        // dat de gebruiker opnieuw hoeft in te loggen. Dezelfde query checkt
        // meteen of het account nog actief bestaat — een sessie is 90 dagen
        // geldig, dus zonder deze check houdt iemand die uit dienst gaat (of
        // wiens account verwijderd is) toegang tot het einde van die 90 dagen.
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, isActive: true },
          })
          if (!dbUser || !dbUser.isActive) {
            // Token zonder id → middleware en API-routes zien geen geldige
            // sessie meer en sturen terug naar /login.
            return { ...token, id: '', role: '' }
          }
          token.role = dbUser.role
        } catch {
          // DB even niet bereikbaar — behoud de bestaande rol in het token
        }
      }
      return token
    },
    async session({ session, token }) {
      // Leeggemaakt token (account gedeactiveerd of verwijderd, zie jwt) →
      // geen user op de sessie, zodat elke `session?.user`-check faalt.
      if (!token?.id) {
        session.user = undefined as unknown as typeof session.user
        return session
      }
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
}
