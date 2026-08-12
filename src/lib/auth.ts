import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { logAuditAction } from './audit-log'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Wachtwoord', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Vul email en wachtwoord in')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          throw new Error('Geen account gevonden met dit emailadres')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error('Onjuist wachtwoord')
        }

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
        // dat de gebruiker opnieuw hoeft in te loggen.
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true },
          })
          if (dbUser) token.role = dbUser.role
        } catch {
          // DB even niet bereikbaar — behoud de bestaande rol in het token
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
}
