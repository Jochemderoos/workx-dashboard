import { WebClient } from '@slack/web-api'

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

export interface SlackUser {
  id: string
  email: string
  name: string
  realName: string
}

// Cache for Slack users (email -> Slack user ID)
let userCache: Map<string, SlackUser> | null = null
let cacheTimestamp = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

/**
 * Get all Slack users and cache them
 */
export async function getSlackUsers(): Promise<Map<string, SlackUser>> {
  const now = Date.now()

  // Return cache if still valid
  if (userCache && now - cacheTimestamp < CACHE_TTL) {
    return userCache
  }

  try {
    const result = await slack.users.list({})
    const users = new Map<string, SlackUser>()

    if (result.members) {
      for (const member of result.members) {
        if (member.profile?.email && !member.deleted && !member.is_bot) {
          users.set(member.profile.email.toLowerCase(), {
            id: member.id!,
            email: member.profile.email.toLowerCase(),
            name: member.name || '',
            realName: member.real_name || member.name || '',
          })
        }
      }
    }

    userCache = users
    cacheTimestamp = now
    return users
  } catch (error) {
    console.error('Error fetching Slack users:', error)
    return userCache || new Map()
  }
}

/**
 * Find Slack user by email
 */
export async function findSlackUserByEmail(email: string): Promise<SlackUser | null> {
  const users = await getSlackUsers()
  return users.get(email.toLowerCase()) || null
}

/**
 * Send a direct message to a user by email
 */
export async function sendDirectMessage(
  email: string,
  message: string,
  blocks?: any[]
): Promise<boolean> {
  try {
    const user = await findSlackUserByEmail(email)
    if (!user) {
      console.warn(`Slack user not found for email: ${email}`)
      return false
    }

    // Open DM channel with user
    const conversation = await slack.conversations.open({
      users: user.id,
    })

    if (!conversation.channel?.id) {
      console.error('Could not open DM channel')
      return false
    }

    // Send message
    await slack.chat.postMessage({
      channel: conversation.channel.id,
      text: message,
      blocks: blocks,
    })

    return true
  } catch (error) {
    console.error('Error sending Slack DM:', error)
    return false
  }
}

/**
 * Send a message to a channel
 */
export async function sendChannelMessage(
  channelName: string,
  message: string,
  blocks?: any[]
): Promise<boolean> {
  try {
    // Find channel by name
    const channels = await slack.conversations.list({
      types: 'public_channel,private_channel',
    })

    const channel = channels.channels?.find(
      (c) => c.name === channelName || c.name === channelName.replace('#', '')
    )

    if (!channel?.id) {
      console.warn(`Slack channel not found: ${channelName}`)
      return false
    }

    await slack.chat.postMessage({
      channel: channel.id,
      text: message,
      blocks: blocks,
    })

    return true
  } catch (error) {
    console.error('Error sending Slack channel message:', error)
    return false
  }
}

/**
 * Send notification for new Zaak assignment
 */
export async function notifyNewZaakAssignment(
  userEmail: string,
  zaak: {
    id: string
    title: string
    clientName?: string
    createdByName: string
    expiresAt: Date
  }
): Promise<boolean> {
  const dashboardUrl = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'
  const zaakUrl = `${dashboardUrl}/dashboard/werk`

  const expiresIn = Math.round((zaak.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
  const expiresText = expiresIn > 1 ? `${expiresIn} uur` : 'minder dan een uur'

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📋 Nieuwe zaak voor jou!',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${zaak.title}*${zaak.clientName ? `\nKlant: ${zaak.clientName}` : ''}\nVan: ${zaak.createdByName}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⏰ Reageer binnen *${expiresText}*`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✅ Bekijk in Dashboard',
            emoji: true,
          },
          url: zaakUrl,
          style: 'primary',
        },
      ],
    },
  ]

  const fallbackMessage = `📋 Nieuwe zaak: ${zaak.title}\nVan: ${zaak.createdByName}\nReageer binnen ${expiresText}\n${zaakUrl}`

  return sendDirectMessage(userEmail, fallbackMessage, blocks)
}

/**
 * Send notification when zaak is accepted
 */
export async function notifyZaakAccepted(
  creatorEmail: string,
  zaak: {
    title: string
    acceptedByName: string
  }
): Promise<boolean> {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `✅ *${zaak.acceptedByName}* heeft de zaak geaccepteerd:\n_${zaak.title}_`,
      },
    },
  ]

  return sendDirectMessage(
    creatorEmail,
    `✅ ${zaak.acceptedByName} heeft de zaak "${zaak.title}" geaccepteerd`,
    blocks
  )
}

/**
 * Send notification when zaak is declined
 */
export async function notifyZaakDeclined(
  creatorEmail: string,
  zaak: {
    title: string
    declinedByName: string
    reason?: string
  }
): Promise<boolean> {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `❌ *${zaak.declinedByName}* heeft de zaak afgewezen:\n_${zaak.title}_${zaak.reason ? `\nReden: ${zaak.reason}` : ''}`,
      },
    },
  ]

  return sendDirectMessage(
    creatorEmail,
    `❌ ${zaak.declinedByName} heeft de zaak "${zaak.title}" afgewezen`,
    blocks
  )
}

/**
 * Test Slack connection
 */
export async function testSlackConnection(): Promise<{
  ok: boolean
  team?: string
  bot?: string
  error?: string
}> {
  try {
    const auth = await slack.auth.test({})
    return {
      ok: true,
      team: auth.team,
      bot: auth.user,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get channel history from Slack
 */
export async function getChannelHistory(
  channelId: string,
  limit: number = 20
): Promise<Array<{
  user: string
  text: string
  ts: string
  userInfo?: SlackUser
}>> {
  try {
    const result = await slack.conversations.history({
      channel: channelId,
      limit,
    })

    if (!result.messages) return []

    // Get user info for each unique user
    const users = await getSlackUsers()
    const usersArray = Array.from(users.values())

    return result.messages
      .filter((msg) => msg.type === 'message' && !msg.subtype)
      .map((msg) => {
        // Find user info by Slack ID
        const userInfo = usersArray.find((u) => u.id === msg.user)

        return {
          user: msg.user || 'unknown',
          text: msg.text || '',
          ts: msg.ts || '',
          userInfo,
        }
      })
      .reverse() // Oldest first
  } catch (error) {
    console.error('Error fetching Slack channel history:', error)
    return []
  }
}

/**
 * List all Slack channels (public + private where bot is member)
 */
export async function listSlackChannels(): Promise<Array<{
  id: string
  name: string
  isPrivate: boolean
  isMember: boolean
  memberCount?: number
}>> {
  try {
    const result = await slack.conversations.list({
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 200,
    })

    if (!result.channels) return []

    return result.channels.map((c) => ({
      id: c.id!,
      name: c.name || '',
      isPrivate: c.is_private || false,
      isMember: c.is_member || false,
      memberCount: c.num_members,
    }))
  } catch (error) {
    console.error('Error listing Slack channels:', error)
    return []
  }
}

/**
 * Join a Slack channel
 */
export async function joinChannel(channelId: string): Promise<boolean> {
  try {
    await slack.conversations.join({ channel: channelId })
    return true
  } catch (error) {
    console.error('Error joining Slack channel:', error)
    return false
  }
}

/**
 * Post message to Slack channel by ID
 */
export async function postToChannel(
  channelId: string,
  message: string,
  senderName?: string
): Promise<boolean> {
  try {
    await slack.chat.postMessage({
      channel: channelId,
      text: senderName ? `*${senderName}:* ${message}` : message,
    })
    return true
  } catch (error) {
    console.error('Error posting to Slack channel:', error)
    return false
  }
}

export { slack }
