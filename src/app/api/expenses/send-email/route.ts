import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    if (!resend) {
      return NextResponse.json(
        { error: 'E-mail is niet geconfigureerd. Neem contact op met de beheerder.' },
        { status: 500 }
      )
    }

    const { pdfBase64, fileName, employeeName, invoiceNumber, totalAmount, holdingName } = await req.json()

    if (!pdfBase64 || !fileName) {
      return NextResponse.json({ error: 'PDF data is verplicht' }, { status: 400 })
    }

    const subject = invoiceNumber
      ? `Declaratie ${invoiceNumber} - ${employeeName}${holdingName ? ` (${holdingName})` : ''}`
      : `Declaratie - ${employeeName}${holdingName ? ` (${holdingName})` : ''}`

    const response = await resend.emails.send({
      from: 'Workx Dashboard <onboarding@resend.dev>',
      to: 'officemanagement@workxadvocaten.nl',
      subject,
      html: `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1a1a1a;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="display: inline-block; background: #f9ff85; padding: 12px 24px; border-radius: 8px;">
        <span style="font-size: 24px; font-weight: 600; color: #1a1a1a;">Workx</span>
        <span style="display: block; font-size: 10px; letter-spacing: 2px; color: #1a1a1a;">ADVOCATEN</span>
      </div>
    </div>
    <div style="background: #262626; border-radius: 16px; padding: 32px; border: 1px solid #333;">
      <h1 style="color: #f9ff85; font-size: 24px; margin: 0 0 16px 0;">
        Nieuwe declaratie ontvangen
      </h1>
      <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #9ca3af; padding: 4px 0; font-size: 14px;">Medewerker:</td>
            <td style="color: #fff; padding: 4px 0; font-size: 14px; font-weight: 600;">${employeeName}</td>
          </tr>
          ${invoiceNumber ? `
          <tr>
            <td style="color: #9ca3af; padding: 4px 0; font-size: 14px;">Factuurnummer:</td>
            <td style="color: #fff; padding: 4px 0; font-size: 14px; font-weight: 600;">${invoiceNumber}</td>
          </tr>
          ` : ''}
          ${holdingName ? `
          <tr>
            <td style="color: #9ca3af; padding: 4px 0; font-size: 14px;">Holding:</td>
            <td style="color: #fff; padding: 4px 0; font-size: 14px; font-weight: 600;">${holdingName}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="color: #9ca3af; padding: 4px 0; font-size: 14px;">Totaalbedrag:</td>
            <td style="color: #f9ff85; padding: 4px 0; font-size: 18px; font-weight: 600;">${totalAmount}</td>
          </tr>
        </table>
      </div>
      <p style="color: #9ca3af; margin: 0; font-size: 13px;">
        Het declaratieformulier is bijgevoegd als PDF.
      </p>
    </div>
    <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px;">
      Verstuurd via Workx Dashboard
    </p>
  </div>
</body>
</html>
      `,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
        },
      ],
    })

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error('Error sending expense email:', error)
    return NextResponse.json(
      { error: 'Kon e-mail niet versturen' },
      { status: 500 }
    )
  }
}
