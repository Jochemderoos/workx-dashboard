// Simulate what the summary route does to build partnerWerkverdelingOverview
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Simulate the query
  const now = new Date()
  const twoWeeksAgo = new Date(now)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 10)
  twoWeeksAgo.setUTCHours(0, 0, 0, 0)
  const twoWeeksAhead = new Date(now)
  twoWeeksAhead.setDate(twoWeeksAhead.getDate() + 8)
  twoWeeksAhead.setUTCHours(23, 59, 59, 999)

  const currentWeekDistribution = await prisma.meetingWeek.findFirst({
    where: { meetingDate: { gte: twoWeeksAgo, lte: twoWeeksAhead } },
    include: { distributions: true },
    orderBy: { meetingDate: 'desc' },
  })

  // Simulate Jochem as currentUser
  const currentUser = await prisma.user.findFirst({
    where: { name: { contains: 'Jochem' } },
    select: { id: true, name: true, role: true },
  })

  console.log('currentUser:', currentUser)
  console.log('currentWeekDistribution:', !!currentWeekDistribution)

  const isPartnerOrAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'
  const userFirstName = currentUser?.name?.split(' ')[0] || ''
  const hasDistributions = currentWeekDistribution?.distributions?.some(
    d => d.partnerName === userFirstName
  )

  console.log('isPartnerOrAdmin:', isPartnerOrAdmin)
  console.log('userFirstName:', userFirstName)
  console.log('hasDistributions:', hasDistributions)

  if (isPartnerOrAdmin && hasDistributions && currentWeekDistribution) {
    const weekId = currentWeekDistribution.id
    const completions = await prisma.conversationCompletion.findMany({ where: { weekId } })
    console.log('completions:', completions.length)

    const partnerDistributions = currentWeekDistribution.distributions?.filter(
      d => d.partnerName === userFirstName
    ) || []
    console.log('partnerDistributions:', partnerDistributions.length)

    const allActiveUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, avatarUrl: true },
    })

    const employeeEntries = []
    for (const d of partnerDistributions) {
      if (!d.employeeName) continue
      const names = d.employeeName.split(', ').map(n => n.trim())
      console.log('  names for', d.partnerName, ':', names)
      for (const name of names) {
        const employeeUser = allActiveUsers.find(u => u.name?.includes(name))
        const empId = employeeUser?.id || `name-${name}`
        employeeEntries.push({
          employeeId: empId,
          employeeName: employeeUser?.name || name,
          partnerName: d.partnerName,
          weekId,
          isCompleted: completions.some(
            c => c.partnerName === d.partnerName && (c.employeeId === empId || c.employeeName === name)
          ),
        })
      }
    }

    console.log('\n=== PARTNER WERKVERDELING OVERVIEW ===')
    console.log(JSON.stringify(employeeEntries, null, 2))
    console.log('\nWidget zou tonen:', employeeEntries.length > 0 && employeeEntries.some(e => !e.isCompleted))
  } else {
    console.log('\n!! PARTNER OVERVIEW WORDT NIET GEBOUWD !!')
    console.log('Reden:', !isPartnerOrAdmin ? 'Geen partner/admin' : !hasDistributions ? 'Geen distributions met naam' : 'Geen weekdata')
  }

  await prisma.$disconnect()
}

main().catch(console.error)
