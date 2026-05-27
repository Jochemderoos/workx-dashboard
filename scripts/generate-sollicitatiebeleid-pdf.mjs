// Genereert de Sollicitatiebeleid-PDF met Workx-logo en zet 'm in Downloads.
import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'
import os from 'os'

const RONDES = [
  {
    nummer: 1,
    titel: 'Kennismaking en introductie',
    karakter: 'Formeel / informatief',
    betrokkenen: ['Maaike of Bas', 'Andere partner'],
    doel:
      'Workx informeert de kandidaat over het kantoor, de organisatiestructuur en de procedure. Tegelijk maakt Workx kennis met de persoon, de motivatie en de algemene werkbeleving van de kandidaat.',
    inhoud: [
      {
        label: 'Introductie Workx',
        punten: [
          'Geschiedenis — oprichting, groei en positionering van Workx in de markt',
          'Werkwijze — hoe het kantoor is georganiseerd, de samenwerking tussen medewerkers en de werkcultuur',
          'Clienten — de aard en het profiel van de clientenkring',
          'Soort werk — de praktijkgebieden, met bijzondere nadruk op arbeidsrecht',
        ],
      },
      {
        label: 'Motivatie en werkbeleving kandidaat',
        punten: [
          'Waarom solliciteert de kandidaat bij Workx?',
          'Wat trekt hem/haar aan in juridisch werk, en in arbeidsrecht in het bijzonder?',
          'Wat vindt de kandidaat belangrijk in een werkomgeving?',
        ],
      },
      {
        label: 'Persoonlijk profiel',
        punten: [
          'Persoonlijke interesses en wat de kandidaat drijft buiten het werk',
          'Loopbaanwensen op de middellange termijn',
        ],
      },
      {
        label: 'Uitleg vervolg en afsluiting',
        punten: [
          'Workx legt de opzet en het vervolg van de selectieprocedure helder uit, inclusief doorlooptijden en verwachtingen',
          'Gelegenheid voor de kandidaat om vragen te stellen',
          'Workx geeft aan wanneer de kandidaat bericht kan verwachten',
        ],
      },
    ],
    voorbeeldvragen: [
      'Wat heeft u ertoe bewogen te solliciteren bij Workx, en wat weet u al over ons kantoor?',
      'Wat trekt u aan in de arbeidsrechtpraktijk en welke aspecten van het vak spreken u het meest aan?',
      'Wat vindt u belangrijk in de samenwerking met collega\'s en leidinggevenden?',
      'Hoe ziet uw ideale werkomgeving eruit?',
      'Waar wilt u over vijf jaar staan in uw carriere?',
    ],
  },
  {
    nummer: 2,
    titel: 'Inhoudelijk selectiegesprek',
    karakter: 'Formeel / toetsend',
    betrokkenen: ['Maaike of Bas', 'Andere partner'],
    doel:
      'Beoordeling van de juridisch-inhoudelijke kwaliteiten van de kandidaat. Er wordt getoetst op praktijkervaring, vakinhoudelijke kennis van het arbeidsrecht en het analytisch vermogen om een concrete casus te beoordelen. Herhaling van het eerste gesprek wordt bewust vermeden.',
    inhoud: [
      {
        label: 'Korte introductie',
        punten: [
          'Beknopte warming-up; geen herhaling van de onderwerpen uit gesprek 1. De focus ligt op de inhoud.',
        ],
      },
      {
        label: 'Ervaring en soort zaken',
        punten: [
          'Bespreking van de eerdere praktijkervaring van de kandidaat',
          'Welke typen zaken heeft de kandidaat behandeld?',
          'Wat was zijn/haar rol daarin en welke verantwoordelijkheden droeg de kandidaat?',
        ],
      },
      {
        label: 'Casus arbeidsrecht',
        punten: [
          'Een concrete, ongedwongen gepresenteerde arbeidsrechtelijke casus wordt mondeling aan de kandidaat voorgelegd',
          'Toetsing op: juridisch analytisch denkvermogen, structuur en helderheid in redeneren, praktische aanpak en clientgerichtheid',
          'Voorbeeldthema\'s: ontslag op staande voet, non-concurrentiebeding, re-integratieverplichtingen of arbeidsvoorwaardelijke wijziging',
          'Het gaat om het denkproces — er is niet een correct antwoord',
        ],
      },
      {
        label: 'Ontwikkelingen in het arbeidsrecht',
        punten: [
          'Wat zijn volgens de kandidaat de belangrijkste actuele ontwikkelingen in het arbeidsrecht?',
          'Hoe houdt de kandidaat zijn/haar kennis up-to-date?',
        ],
      },
    ],
    voorbeeldvragen: [
      'Kunt u een complexe zaak beschrijven die u recentelijk heeft behandeld? Wat was uw aanpak en wat was het resultaat?',
      'Ik leg u een situatie voor: [casus]. Hoe zou u dit juridisch beoordelen en welk advies zou u uw client geven?',
      'Welke recente uitspraken of wetswijzigingen in het arbeidsrecht hebben u het meest beziggehouden, en waarom?',
      'Op welk gebied van het arbeidsrecht wilt u zich verder ontwikkelen?',
    ],
  },
  {
    nummer: 3,
    titel: 'Informeel gesprek met het team',
    karakter: 'Informeel / wederzijds',
    duur: '30–60 minuten',
    betrokkenen: ['Twee medewerkers van Workx (bij voorkeur een gevarieerde samenstelling)'],
    doel:
      'Tweeledig doel: de kandidaat een realistisch beeld bieden van wat het betekent om bij Workx te werken vanuit het perspectief van de collega\'s zelf, en het team de gelegenheid geven een indruk te vormen van de kandidaat als persoon en potentieel toekomstige collega.',
    inhoud: [
      {
        label: 'Vertellen vanuit de medewerkers',
        punten: [
          'De dagelijkse praktijk en het type werk/aard van de zaken waaraan wordt gewerkt',
          'De samenwerking binnen het team',
          'De cultuur van het kantoor — wat maakt Workx bijzonder?',
          'Uitdagingen en groeimogelijkheden die medewerkers zelf ervaren',
          'Richtlijn: wees open en eerlijk; vermijd vertrouwelijke kantoorinformatie of lopende zaken',
        ],
      },
      {
        label: 'Wederzijdse kennismaking',
        punten: [
          'De kandidaat krijgt ruimte om vragen te stellen aan de medewerkers',
          'Informele uitwisseling over interesses, werkstijl en verwachtingen',
        ],
      },
      {
        label: 'Terugkoppeling aan partners',
        punten: [
          'Na afloop geven de betrokken medewerkers een korte, gestructureerde terugkoppeling aan de partners',
          'Vaste aandachtspunten: teamfit, communicatiestijl, enthousiasme',
        ],
      },
    ],
    voorbeeldvragen: [],
  },
]

const margin = 18
let doc, pageW, pageH, contentW, logoBuf

// ─ Helpers
function addLogo() {
  if (logoBuf) {
    // Logo proportie ~ 4:1 (breedte:hoogte), gebruik 38mm breed × ~10mm hoog
    try {
      doc.addImage(logoBuf, 'PNG', margin, 12, 38, 10, undefined, 'FAST')
    } catch (e) {
      // negeer als logo niet werkt
    }
  }
}

function sectionTitle(text, y) {
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(45, 45, 45)
  doc.text(text, margin, y)
  doc.setFillColor(249, 255, 133)
  doc.rect(margin, y + 1.8, 28, 1.2, 'F')
  return y + 10
}

function subTitle(text, y) {
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(80, 80, 80)
  doc.text(text.toUpperCase(), margin, y)
  doc.setFont('helvetica', 'normal')
  return y + 5.5
}

function paragraph(text, y) {
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  const lines = doc.splitTextToSize(text, contentW)
  doc.text(lines, margin, y)
  return y + lines.length * 4.8 + 3
}

function bullet(text, y) {
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.setFillColor(180, 180, 0)
  doc.circle(margin + 2, y - 1.2, 0.8, 'F')
  const lines = doc.splitTextToSize(text, contentW - 6)
  doc.text(lines, margin + 6, y)
  return y + lines.length * 4.8 + 1.5
}

function needNewPage(y, neededHeight = 30) {
  if (y > pageH - neededHeight - 18) {
    doc.addPage()
    addLogo()
    return 35
  }
  return y
}

function overzichtTable(y) {
  const colW = [16, 56, 70, contentW - 16 - 56 - 70]
  doc.setFillColor(245, 245, 245)
  doc.rect(margin, y, contentW, 8, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(60, 60, 60)
  doc.text('Ronde', margin + 2, y + 5.5)
  doc.text('Gesprek', margin + colW[0] + 2, y + 5.5)
  doc.text('Betrokkenen', margin + colW[0] + colW[1] + 2, y + 5.5)
  doc.text('Karakter', margin + colW[0] + colW[1] + colW[2] + 2, y + 5.5)
  y += 8

  const rows = [
    ['1', 'Kennismakingsgesprek', 'Maaike of Bas + 1 partner', 'Formeel / informatief'],
    ['2', 'Inhoudelijk selectiegesprek', 'Maaike of Bas + 1 partner', 'Formeel / toetsend'],
    ['3', 'Informeel gesprek met team', 'Twee medewerkers', 'Informeel / wederzijds'],
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const r of rows) {
    doc.text(r[0], margin + 2, y + 5.5)
    doc.text(r[1], margin + colW[0] + 2, y + 5.5)
    doc.text(r[2], margin + colW[0] + colW[1] + 2, y + 5.5)
    doc.text(r[3], margin + colW[0] + colW[1] + colW[2] + 2, y + 5.5)
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.line(margin, y + 8, margin + contentW, y + 8)
    y += 8
  }
  return y + 4
}

async function main() {
  // Probeer logo te laden (PNG)
  const logoPath = path.join(process.cwd(), 'public', 'workx-logo.png')
  if (fs.existsSync(logoPath)) {
    logoBuf = fs.readFileSync(logoPath)
  } else {
    console.warn('Logo niet gevonden op', logoPath, '— PDF zonder logo')
  }

  doc = new jsPDF({ unit: 'mm', format: 'a4' })
  pageW = doc.internal.pageSize.getWidth()
  pageH = doc.internal.pageSize.getHeight()
  contentW = pageW - margin * 2

  // ── COVER PAGE
  addLogo()

  doc.setTextColor(45, 45, 45)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 150, 150)
  doc.text('SOLLICITATIEBELEID', pageW / 2, 80, { align: 'center' })

  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(45, 45, 45)
  doc.text('Workx', pageW / 2, 95, { align: 'center' })
  doc.text('Sollicitatiebeleid', pageW / 2, 108, { align: 'center' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text('Selectieprocedure in drie gespreksrondes', pageW / 2, 122, { align: 'center' })

  // Yellow accent
  doc.setFillColor(249, 255, 133)
  doc.rect(pageW / 2 - 22, 130, 44, 2, 'F')

  doc.setFontSize(10)
  doc.setTextColor(140, 140, 140)
  const dateStr = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  doc.text(dateStr, pageW / 2, 145, { align: 'center' })

  // Korte intro op cover
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  const introLines = doc.splitTextToSize(
    'Dit beleidsdocument beschrijft de gestructureerde sollicitatieprocedure van Workx. Het doel is om op een zorgvuldige, consistente en respectvolle wijze te beoordelen of een kandidaat aansluit bij de professionele standaarden, de werkcultuur en de inhoudelijke eisen van het kantoor.',
    contentW - 30
  )
  doc.text(introLines, pageW / 2, 165, { align: 'center' })

  // ── PAGE 2 — Inleiding + Overzicht
  doc.addPage()
  addLogo()
  let y = 35
  y = sectionTitle('1. Inleiding en doelstelling', y)
  y = paragraph(
    'Dit beleidsdocument beschrijft de gestructureerde sollicitatieprocedure van Workx. Het doel van de procedure is om op een zorgvuldige, consistente en respectvolle wijze te beoordelen of een kandidaat aansluit bij de professionele standaarden, de werkcultuur en de inhoudelijke eisen van het kantoor.',
    y
  )
  y = paragraph(
    'De procedure bestaat uit drie gespreksrondes, elk met een eigen doel, samenstelling en inhoud. Workx hanteert dit document als leidraad bij elke sollicitatie, zodat alle kandidaten op gelijke wijze worden beoordeeld en de ervaringen intern geborgd zijn.',
    y
  )

  y += 4
  y = sectionTitle('2. Overzicht van de procedure', y)
  y = overzichtTable(y)

  // ── PAGES per ronde
  for (const r of RONDES) {
    doc.addPage()
    addLogo()
    y = 35
    y = sectionTitle(`${r.nummer + 2}. Gesprek ${r.nummer} — ${r.titel}`, y)

    // Karakter / duur regel
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(120, 120, 120)
    let badge = `Karakter: ${r.karakter}`
    if (r.duur) badge += `  ·  Duur: ${r.duur}`
    doc.text(badge, margin, y)
    y += 7

    y = subTitle('Doel', y)
    y = paragraph(r.doel, y)
    y += 1

    y = subTitle('Betrokkenen', y)
    for (const b of r.betrokkenen) {
      y = bullet(b, y)
    }
    y += 1

    y = needNewPage(y, 30)
    y = subTitle('Inhoud', y)
    for (let i = 0; i < r.inhoud.length; i++) {
      const item = r.inhoud[i]
      y = needNewPage(y, 25)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(45, 45, 45)
      doc.text(`${String.fromCharCode(65 + i)}. ${item.label}`, margin, y)
      y += 5.5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      for (const p of item.punten) {
        y = needNewPage(y, 15)
        y = bullet(p, y)
      }
      y += 1.5
    }

    if (r.voorbeeldvragen.length > 0) {
      y = needNewPage(y, 40)
      y = subTitle('Voorbeeldvragen', y)
      for (let i = 0; i < r.voorbeeldvragen.length; i++) {
        y = needNewPage(y, 15)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9.5)
        doc.setTextColor(80, 80, 80)
        const lines = doc.splitTextToSize(`${i + 1}.  "${r.voorbeeldvragen[i]}"`, contentW - 4)
        doc.text(lines, margin + 2, y)
        y += lines.length * 4.8 + 2.5
        doc.setFont('helvetica', 'normal')
      }
    }
  }

  // ── BESLUITVORMING
  doc.addPage()
  addLogo()
  y = 35
  y = sectionTitle('6. Besluitvorming en afronding', y)
  y = paragraph(
    'Na het derde gesprek vindt een intern overleg plaats tussen de partners. De volgende punten worden besproken:',
    y
  )
  y = bullet('Inhoudelijke geschiktheid (op basis van gesprek 2)', y)
  y = bullet('Persoonlijke fit en motivatie (op basis van gesprekken 1 en 3)', y)
  y = bullet('Eventuele openstaande vragen of aandachtspunten', y)
  y += 3
  y = paragraph(
    'Workx informeert de kandidaat kort na de laatste twee gesprekken over de uitkomst. Bij een positief besluit wordt een aanbod gedaan.',
    y
  )
  y += 3

  // Highlighted uitgangspunt box
  doc.setFillColor(249, 255, 133)
  doc.setDrawColor(180, 180, 0)
  doc.setLineWidth(0.5)
  doc.roundedRect(margin, y, contentW, 26, 3, 3, 'FD')
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(45, 45, 45)
  doc.text('Uitgangspunt', margin + 5, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(50, 50, 50)
  const ugp = doc.splitTextToSize(
    'Jaarcontract dat bij wederzijdse positieve ervaring tijdig wordt omgezet in contract voor onbepaalde tijd. In uitzonderingsgevallen kan besloten worden direct een contract voor onbepaalde tijd aan te bieden.',
    contentW - 10
  )
  doc.text(ugp, margin + 5, y + 13)

  // ── FOOTER op elke pagina (paginanummering)
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(45, 45, 45)
    doc.rect(0, pageH - 14, pageW, 14, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(220, 220, 220)
    doc.text(
      'Workx Advocaten  ·  Herengracht 448, 1017 CA Amsterdam  ·  +31 (0)20 308 03 20  ·  info@workxadvocaten.nl',
      pageW / 2,
      pageH - 7,
      { align: 'center' }
    )
    doc.text(`${p} / ${totalPages}`, pageW - margin, pageH - 7, { align: 'right' })
  }

  // Opslaan
  const outPath = path.join(os.homedir(), 'Downloads', 'Workx-Sollicitatiebeleid.pdf')
  const buf = Buffer.from(doc.output('arraybuffer'))
  fs.writeFileSync(outPath, buf)
  console.log('✅ PDF opgeslagen:', outPath, `(${(buf.length / 1024).toFixed(1)} KB)`)
}

main().catch(e => { console.error(e); process.exit(1) })
