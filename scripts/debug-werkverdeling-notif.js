const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Zoek Jochem
  const jochem = await prisma.user.findFirst({
    where: { name: { contains: 'Jochem' } },
    select: { id: true, name: true, role: true }
  })
  if (!jochem) { console.log('Jochem niet gevonden'); return }
  console.log('User:', jochem.name, '- Role:', jochem.role, '- ID:', jochem.id)

  // Dismissed keys voor werkverdelings
  const dismissals = await prisma.notificationDismissal.findMany({
    where: { userId: jochem.id, notificationKey: { contains: 'werkverdeling' } },
  })
  console.log('\nDismissed werkverdeling keys:')
  dismissals.forEach(d => console.log(' ', d.notificationKey, '- dismissed at:', d.dismissedAt))

  // Huidige meeting week
  const now = new Date()
  const todayWork = new Date(now)
  const dayOfWeek = todayWork.getDay()
  if (dayOfWeek === 6) todayWork.setDate(todayWork.getDate() + 2)
  else if (dayOfWeek === 0) todayWork.setDate(todayWork.getDate() + 1)

  const currentWeek = await prisma.meetingWeek.findFirst({
    where: {
      meetingDate: {
        gte: new Date(todayWork.getTime() - 3 * 24 * 60 * 60 * 1000),
        lte: new Date(todayWork.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
    },
    include: { distributions: true },
    orderBy: { meetingDate: 'desc' },
  })

  if (!currentWeek) { console.log('\nGeen meeting week gevonden'); return }
  console.log('\nMeeting week:', currentWeek.id, '- Date:', currentWeek.meetingDate)

  const completions = await prisma.conversationCompletion.findMany({
    where: { weekId: currentWeek.id },
  })
  console.log('Completions:', completions.length)

  if (jochem.role === 'PARTNER') {
    const partnerFirstName = jochem.name.split(' ')[0]
    console.log('\nPartner first name:', partnerFirstName)
    const partnerDists = currentWeek.distributions.filter(d => d.partnerName === partnerFirstName)
    console.log('Distributions for', partnerFirstName + ':', partnerDists.length)

    let totalEmployees = 0, completedCount = 0
    for (const d of partnerDists) {
      if (!d.employeeName) continue
      const names = d.employeeName.split(', ').map(n => n.trim())
      for (const name of names) {
        totalEmployees++
        const isComplete = completions.some(c => c.partnerName === d.partnerName && c.employeeName === name)
        if (isComplete) completedCount++
        console.log('  Employee:', name, isComplete ? '(complete)' : '(open)')
      }
    }
    const remaining = totalEmployees - completedCount
    const key = 'werkverdeling-' + currentWeek.id + '-partner-' + partnerFirstName
    const isDismissed = dismissals.some(d => d.notificationKey === key)
    console.log('\nKey:', key)
    console.log('Remaining:', remaining, '- Dismissed:', isDismissed)
    console.log('Would show notification:', remaining > 0 && !isDismissed)
  } else {
    console.log('\nEmployee flow:')
    for (const d of currentWeek.distributions) {
      if (!d.employeeName) continue
      const names = d.employeeName.split(',').map(n => n.trim())
      const userFirst = jochem.name.split(' ')[0].toLowerCase()
      const nameMatches = names.some(name =>
        name === jochem.name || name.split(' ')[0].toLowerCase() === userFirst
      )
      if (!nameMatches && d.employeeId !== jochem.id) continue
      const isComplete = completions.some(c => c.partnerName === d.partnerName && c.employeeId === jochem.id)
      if (!isComplete) {
        const key = 'werkverdeling-' + currentWeek.id + '-' + d.partnerName + '-' + jochem.id
        const isDismissed = dismissals.some(dm => dm.notificationKey === key)
        console.log('  Key:', key)
        console.log('  Dismissed:', isDismissed)
        console.log('  Would show:', !isDismissed)
      }
    }
  }

  await prisma.$disconnect()
}

main().catch(console.error)
