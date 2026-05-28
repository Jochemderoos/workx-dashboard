// One-shot script: maakt het account + teamprofiel voor Alexander Collot d'Escury aan.
// - Email: alexander.collot@workxadvocaten.nl
// - Rol: EMPLOYEE
// - 8e jaars advocaat, fulltime (40u, 5 dagen)
// - In dienst per 1 juni 2026
// - Uurtarief + salaris uit het salarishuis
// - Vakantiebalans 25 dagen voor 2026
// - Tijdelijk wachtwoord wordt in stdout geprint
//
// Idempotent: als er al een user is met dit e-mailadres dan stopt het script zonder iets te doen.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const EMAIL = 'alexander.collot@workxadvocaten.nl'
const NAME = 'Alexander Collot d\'Escury'
const PHONE = null // niet vermeld in contract
const START_DATE = new Date('2026-06-01T00:00:00Z')
const EXPERIENCE_YEAR = 8
const WERKDAGEN = '1,2,3,4,5' // fulltime, 5 dagen
const ROLE = 'EMPLOYEE'

function generateTempPassword(): string {
  // 14 tekens, alfa-num — leesbaar maar redelijk sterk
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = crypto.randomBytes(14)
  for (let i = 0; i < 14; i++) out += chars[bytes[i] % chars.length]
  return out
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[create-alexander] geen DATABASE_URL — afbreken')
    process.exit(1)
  }
  const prisma = new PrismaClient()
  try {
    const existing = await prisma.user.findUnique({ where: { email: EMAIL } })
    if (existing) {
      console.log(`[create-alexander] Account bestaat al (id=${existing.id}) — niets te doen.`)
      return
    }

    const tempPassword = generateTempPassword()
    const hash = await bcrypt.hash(tempPassword, 12)

    // Salarishuis-data ophalen voor 8e jaars
    const scale = await prisma.salaryScale.findUnique({
      where: { experienceYear: EXPERIENCE_YEAR },
    })
    if (!scale) {
      console.warn(`[create-alexander] Geen salarishuis-record voor ${EXPERIENCE_YEAR}e jaars — uurtarief/salaris blijven leeg`)
    }

    const newUser = await prisma.user.create({
      data: {
        email: EMAIL,
        name: NAME,
        password: hash,
        role: ROLE,
        phoneNumber: PHONE,
        startDate: START_DATE,
        werkdagen: WERKDAGEN,
        isActive: true,
      },
    })

    // Vakantiebalans 2026: 25 dagen (komt overeen met contract art. 4.1 + handboek)
    const currentYear = new Date().getFullYear()
    await prisma.vacationBalance.create({
      data: {
        userId: newUser.id,
        year: currentYear,
        opbouwLopendJaar: 25,
        overgedragenVorigJaar: 0,
        bijgekocht: 0,
        opgenomenLopendJaar: 0,
      },
    })

    // Arbeidsvoorwaarden uit salarishuis
    await prisma.employeeCompensation.create({
      data: {
        userId: newUser.id,
        experienceYear: EXPERIENCE_YEAR,
        hourlyRate: scale?.hourlyRateBase || 0,
        salary: scale?.salary || 7100, // fallback: contract 8e jaars vermeldt €7.100
        isHourlyWage: false,
      },
    })

    console.log('\n=========================================')
    console.log('  ALEXANDER COLLOT D\'ESCURY AANGEMAAKT')
    console.log('=========================================')
    console.log(`  ID:             ${newUser.id}`)
    console.log(`  Email:          ${EMAIL}`)
    console.log(`  Tijdelijk ww:   ${tempPassword}`)
    console.log(`  Rol:            ${ROLE}`)
    console.log(`  Ervaringsjaar:  ${EXPERIENCE_YEAR}e jaars`)
    console.log(`  Uurtarief:      €${scale?.hourlyRateBase ?? '(handmatig invullen)'}`)
    console.log(`  Salaris (mnd):  €${scale?.salary ?? 7100}`)
    console.log(`  In dienst:      ${START_DATE.toISOString().slice(0,10)}`)
    console.log(`  Werkdagen:      ${WERKDAGEN} (5 dagen)`)
    console.log(`  Vakantiesaldo:  25 dagen voor ${currentYear}`)
    console.log('=========================================')
    console.log('  Geef het tijdelijke wachtwoord door aan Alexander.')
    console.log('  Hij/zij kan het bij eerste login wijzigen.')
    console.log('=========================================\n')
  } catch (err) {
    console.error('[create-alexander] mislukt:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
