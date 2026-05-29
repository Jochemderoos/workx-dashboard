// Diagnostic: laat zien welke records Alexander al heeft.
import { PrismaClient } from '@prisma/client'

const EMAIL = 'alexander.collot@workxadvocaten.nl'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('geen DATABASE_URL')
    process.exit(1)
  }
  const prisma = new PrismaClient()
  try {
    const u = await prisma.user.findUnique({
      where: { email: EMAIL },
      select: { id: true, name: true, email: true, role: true, isActive: true, startDate: true, werkdagen: true, phoneNumber: true, avatarUrl: true, birthDate: true, department: true },
    })
    if (!u) {
      console.log('GEEN USER GEVONDEN')
      return
    }
    const id = u.id
    const out: Record<string, unknown> = { user: u }
    out.vacationBalance = await prisma.vacationBalance.findMany({ where: { userId: id } })
    out.employeeCompensation = await prisma.employeeCompensation.findUnique({ where: { userId: id } })
    out.personalTaskCount = await prisma.personalTask.count({ where: { userId: id } })
    out.bonusCalcCount = await prisma.bonusCalculation.count({ where: { userId: id } })
    out.partnerTaskCount = await prisma.partnerTaskAssignment.count({ where: { userId: id } })
    out.expenseCount = await prisma.expenseDeclaration.count({ where: { userId: id } })
    out.officeAttendanceCount = await prisma.officeAttendance.count({ where: { userId: id } })
    out.certificateCount = await prisma.certificate.count({ where: { userId: id } })
    out.coachingBudget = await prisma.coachingBudget.findUnique({ where: { userId: id } })
    // Onboarding
    try {
      const onboardingEmp = await (prisma as any).onboardingEmployee?.findMany?.({ where: { userId: id } })
      out.onboardingEmployee = onboardingEmp || 'tabel niet beschikbaar'
    } catch {
      out.onboardingEmployee = '(error)'
    }
    console.log(JSON.stringify(out, null, 2))
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
main()
