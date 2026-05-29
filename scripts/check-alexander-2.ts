import { PrismaClient } from '@prisma/client'

const ID = 'cmppis0kv0000oczhvlhieb9j'

async function main() {
  const p = new PrismaClient()
  try {
    const allChannels = await p.chatChannel.findMany({
      select: { id: true, name: true, members: { select: { userId: true } } },
    })
    const inChannels = allChannels.filter(c => c.members.some(m => m.userId === ID))
    const notIn = allChannels.filter(c => !c.members.some(m => m.userId === ID))
    const onboardingTemplates = await p.onboardingTemplate.count()
    const otherUsersInChannels = allChannels.map(c => ({ name: c.name, memberCount: c.members.length }))
    console.log(JSON.stringify({
      inChannels: inChannels.map(c => c.name),
      notInChannels: notIn.map(c => c.name),
      otherUsersInChannels,
      onboardingTemplates,
    }, null, 2))
  } finally {
    await p.$disconnect()
  }
}
main()
