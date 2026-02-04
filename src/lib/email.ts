import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface ZaakEmailData {
  to: string
  userName: string
  zaakDescription: string
  urgency: string
  createdByName: string
  clientName?: string
  startsQuickly: boolean
  dashboardUrl: string
}

export async function sendZaakOfferEmail(data: ZaakEmailData) {
  if (!resend) {
    console.warn('Email not configured - skipping send to:', data.to)
    return { success: false, error: 'Email not configured' }
  }

  const urgencyColors: Record<string, string> = {
    LOW: '#22c55e',
    NORMAL: '#3b82f6',
    HIGH: '#f59e0b',
    URGENT: '#ef4444',
  }

  const urgencyLabels: Record<string, string> = {
    LOW: 'Laag',
    NORMAL: 'Normaal',
    HIGH: 'Hoog',
    URGENT: 'Urgent',
  }

  try {
    const response = await resend.emails.send({
      from: 'Workx Dashboard <onboarding@resend.dev>',
      to: data.to,
      subject: `Nieuwe zaak voor jou: ${data.zaakDescription.substring(0, 50)}${data.zaakDescription.length > 50 ? '...' : ''}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1a1a1a;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; background: #f9ff85; padding: 12px 24px; border-radius: 8px;">
        <span style="font-size: 24px; font-weight: 600; color: #1a1a1a;">Workx</span>
        <span style="display: block; font-size: 10px; letter-spacing: 2px; color: #1a1a1a;">ADVOCATEN</span>
      </div>
    </div>

    <!-- Main Card -->
    <div style="background: #262626; border-radius: 16px; padding: 32px; border: 1px solid #333;">
      <h1 style="color: #f9ff85; font-size: 24px; margin: 0 0 8px 0;">
        Nieuwe zaak voor jou!
      </h1>
      <p style="color: #9ca3af; margin: 0 0 24px 0;">
        Hoi ${data.userName}, er is een nieuwe zaak die bij jou past.
      </p>

      <!-- Zaak Details -->
      <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h2 style="color: #fff; font-size: 18px; margin: 0 0 16px 0;">
          ${data.zaakDescription}
        </h2>

        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <!-- Urgentie badge -->
          <span style="display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${urgencyColors[data.urgency]}20; color: ${urgencyColors[data.urgency]};">
            ${urgencyLabels[data.urgency]}
          </span>

          ${data.startsQuickly ? `
          <span style="display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #f59e0b20; color: #f59e0b;">
            Start snel
          </span>
          ` : ''}
        </div>

        ${data.clientName ? `
        <p style="color: #9ca3af; margin: 16px 0 0 0; font-size: 14px;">
          <strong style="color: #fff;">Klant:</strong> ${data.clientName}
        </p>
        ` : ''}

        <p style="color: #9ca3af; margin: 8px 0 0 0; font-size: 14px;">
          <strong style="color: #fff;">Van:</strong> ${data.createdByName}
        </p>
      </div>

      <!-- Timer Warning -->
      <div style="background: #422006; border: 1px solid #f59e0b40; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #fbbf24; margin: 0; font-size: 14px;">
          <strong>Let op:</strong> Je hebt 2 uur om te reageren. Daarna gaat de zaak automatisch naar de volgende collega.
        </p>
      </div>

      <!-- CTA Button -->
      <a href="${data.dashboardUrl}" style="display: block; text-align: center; background: #f9ff85; color: #1a1a1a; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Bekijk in dashboard
      </a>
    </div>

    <!-- Footer -->
    <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px;">
      Workx Advocaten Dashboard
    </p>
  </div>
</body>
</html>
      `,
    })

    return { success: true, data: response }
  } catch (error) {
    console.error('Failed to send email:', error)
    return { success: false, error: String(error) }
  }
}

export async function sendZaakAssignedEmail(data: {
  to: string
  userName: string
  zaakDescription: string
  assigneeName: string
}) {
  if (!resend) {
    console.warn('Email not configured - skipping assignment notification to:', data.to)
    return { success: false, error: 'Email not configured' }
  }

  try {
    const response = await resend.emails.send({
      from: 'Workx Dashboard <onboarding@resend.dev>',
      to: data.to,
      subject: `Zaak toegewezen: ${data.zaakDescription.substring(0, 40)}...`,
      html: `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1a1a1a;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: #262626; border-radius: 16px; padding: 32px; border: 1px solid #333;">
      <h1 style="color: #22c55e; font-size: 24px; margin: 0 0 16px 0;">
        Zaak is toegewezen
      </h1>
      <p style="color: #fff; margin: 0 0 8px 0;">
        <strong>${data.assigneeName}</strong> heeft de volgende zaak opgepakt:
      </p>
      <p style="color: #9ca3af; margin: 0;">
        ${data.zaakDescription}
      </p>
    </div>
  </div>
</body>
</html>
      `,
    })

    return { success: true, data: response }
  } catch (error) {
    console.error('Failed to send assignment email:', error)
    return { success: false, error: String(error) }
  }
}

export async function sendAllDeclinedEmail(data: {
  to: string
  zaakDescription: string
  responses: { name: string; reason?: string }[]
}) {
  if (!resend) {
    console.warn('Email not configured - skipping all-declined notification to:', data.to)
    return { success: false, error: 'Email not configured' }
  }

  try {
    const response = await resend.emails.send({
      from: 'Workx Dashboard <onboarding@resend.dev>',
      to: data.to,
      subject: `Actie vereist: Niemand beschikbaar voor zaak`,
      html: `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1a1a1a;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: #262626; border-radius: 16px; padding: 32px; border: 1px solid #ef4444;">
      <h1 style="color: #ef4444; font-size: 24px; margin: 0 0 16px 0;">
        Handmatige toewijzing nodig
      </h1>
      <p style="color: #fff; margin: 0 0 24px 0;">
        Alle medewerkers hebben de volgende zaak afgewezen of niet gereageerd:
      </p>
      <div style="background: #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #f9ff85; margin: 0; font-weight: 600;">${data.zaakDescription}</p>
      </div>

      <h3 style="color: #fff; margin: 0 0 12px 0;">Reacties:</h3>
      <ul style="margin: 0; padding: 0 0 0 20px; color: #9ca3af;">
        ${data.responses.map(r => `
          <li style="margin-bottom: 8px;">
            <strong style="color: #fff;">${r.name}</strong>
            ${r.reason ? `: ${r.reason}` : ' (geen reden opgegeven)'}
          </li>
        `).join('')}
      </ul>
    </div>
  </div>
</body>
</html>
      `,
    })

    return { success: true, data: response }
  } catch (error) {
    console.error('Failed to send all-declined email:', error)
    return { success: false, error: String(error) }
  }
}
