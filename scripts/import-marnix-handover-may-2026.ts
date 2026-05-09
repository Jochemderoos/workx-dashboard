// Eenmalige idempotente import van Marnix' overdrachtsdocument voor
// 11-15 mei 2026 (uit Word-bestand). Bij volgende builds: skip als
// handover voor exact deze periode al bestaat. Veilig om te laten
// staan; mag verwijderd worden zodra duidelijk dat de import is gedaan.

import { PrismaClient } from '@prisma/client'

const PERIOD_START = new Date('2026-05-11')
const PERIOD_END = new Date('2026-05-15')
const NOTE =
  'Kay neemt mijn zaken waar, Juliette de corporate zaken. Ik lees mijn mails niet, bij vragen graag even een appje sturen. Succes!'

interface CaseInput {
  dossiernaam: string
  contactpersoon?: string
  beschrijving?: string
  waarnemers?: string
}

const CASES: CaseInput[] = [
  { dossiernaam: 'Accenture/hotline', contactpersoon: 'Elina Peetermans, Jorn Derny', beschrijving: 'Vragen over loontransparantierichtlijn en implementatie in Nederland', waarnemers: 'Julia' },
  { dossiernaam: 'Accenture/Algemeen', contactpersoon: 'Elina/Jorn', waarnemers: 'Bas' },
  { dossiernaam: 'Amazon OR', contactpersoon: 'Kris Nielander', beschrijving: 'Algemeen dossier' },
  { dossiernaam: 'All Options (ook: All trading en All Capital)', contactpersoon: 'Fabian Streefland (legal)', beschrijving: 'Algemeen dossier, discussie over zieke werknemer die zich niet aan de regels houdt.' },
  { dossiernaam: 'BakerMcKenzie', contactpersoon: 'Jantien Fennema, Vincent van den Boogert, Jackie van Geldrop', beschrijving: 'Adviesaanvraag met deels negatief advies OR, besluit moet nu worden opgesteld. Plus evt inzetten UWV procedures', waarnemers: 'Juliette' },
  { dossiernaam: 'Battolyser', contactpersoon: 'Maike Beekman/Merel van Ockenburg', beschrijving: 'Ovo, VDL naar Battolyser' },
  { dossiernaam: 'BDR Thermea', contactpersoon: 'Daphne Dumoulin (HR)/Nienke Groen', beschrijving: 'Algemeen dossier', waarnemers: 'Maaike' },
  { dossiernaam: 'Booking / Rodriguez Silva', contactpersoon: 'Irina Itu', beschrijving: 'Rodriguez Silva: discussie over absentie, vanwege oorlog was terugvlucht lastig. Stap van Booking te drastisch, maar ondanks advies willen ze vasthouden. Bericht aan advocaat gestuurd.', waarnemers: 'Erika' },
  { dossiernaam: 'Brinkhof', contactpersoon: 'Eliane de Vilder, Mayke Boetes', beschrijving: 'Algemeen dossier', waarnemers: 'Maaike' },
  { dossiernaam: 'Bugaboo ondernemingsraad', contactpersoon: 'Melanie Wijnands', beschrijving: 'Algemene vragen van OR, integratie Bugaboo/Joolz', waarnemers: 'Juliette' },
  { dossiernaam: 'Calcasa', contactpersoon: 'Tijs Pellemans, Dave Vis', beschrijving: 'Algemene vragen', waarnemers: 'Kay, Maaike' },
  { dossiernaam: 'Com4Care', contactpersoon: 'Gérard Thaens', beschrijving: 'Algemeen dossier. CAO VVT, zorg en welzijn pensioen' },
  { dossiernaam: 'Committed Capital', contactpersoon: 'Wai, Vincent', beschrijving: 'Investeringsclub, vragen over deelnemingen en reorganisatie intern' },
  { dossiernaam: 'Deep Blue Capital', contactpersoon: 'Wido te Brake, Robin de Vilder', beschrijving: 'Algemeen dossier' },
  { dossiernaam: 'EVS', contactpersoon: 'Nicolas Bayers, Marie Renard', beschrijving: 'Algemeen dossier, dossier disfunctionerende werknemer' },
  { dossiernaam: 'EyeWish', contactpersoon: 'Femke Swaan, Martijn Reijmers', beschrijving: 'Algemeen dossier, DD Woudenberg', waarnemers: 'Juliette, Kay' },
  { dossiernaam: 'Foresco', contactpersoon: 'Wim van Dijk, Esther Bloeming', beschrijving: 'Algemeen dossier' },
  { dossiernaam: 'Foresco-Nahar', contactpersoon: 'Wim van Dijk, Esther Bloeming', beschrijving: 'Procedure, wordt datum gezocht voor comparitie, verhinderdata doorgegeven' },
  { dossiernaam: 'Funda OR', contactpersoon: 'Melvin Zehl', beschrijving: 'Algemeen' },
  { dossiernaam: 'Genmab works council', contactpersoon: 'Madelon, Leon', beschrijving: 'Ondernemingsraad bijstaan; bij een reorganisatie voor integratie met Merus', waarnemers: 'Julia, Jochem' },
  { dossiernaam: 'Golden Arrow Oil/Shipping', contactpersoon: 'Gerrit Versteeg, Lisette Versteeg, Myron van den Berg', beschrijving: 'Algemeen dossier', waarnemers: 'Kay' },
  { dossiernaam: 'Harver', contactpersoon: 'Wouter Pastoor, Layne, Laura Stanley', beschrijving: 'Algemeen dossier. Advies' },
  { dossiernaam: 'Janssen-Fritsen / Schelde / Bosan', contactpersoon: 'Sasja Maasakkers, John van der Horst, Karen Schreuder', beschrijving: 'Algemeen dossier, recent advies over ZZP' },
  { dossiernaam: 'Cornelis Klok / Action', contactpersoon: 'Cornelis Klok (particulier, supply director)', beschrijving: 'Onderzoek vanwege apk-problemen trailers, werknemer afgesloten van systeem. Vragen gesteld en inzage door ons geëist. - vragen onderzoek beantwoorden - toegang tot systemen - onderhandelingen regeling. Allard Bekius is wederpartij.', waarnemers: 'Kay' },
  { dossiernaam: 'Kraft Europe BV', contactpersoon: 'Dick Roest / Werner Eyskens', beschrijving: 'Algemeen dossier, ruzie met legal counsel, ingewikkeld dossier, bij voorkeur laten wachten tot ik terug ben' },
  { dossiernaam: 'Lama / ACFO', contactpersoon: 'Hans van der Veen', beschrijving: 'Algemeen dossier', waarnemers: 'Kay' },
  { dossiernaam: 'Lemstra van der Korst', contactpersoon: 'Jaron, Flip', beschrijving: 'Algemeen dossier', waarnemers: 'Maaike, Jochem' },
  { dossiernaam: 'Lineage', contactpersoon: 'Angelique de Kruif, Heleen Koggink, Annegien Kooij', beschrijving: 'Algemeen dossier', waarnemers: 'Bas, Julia' },
  { dossiernaam: 'Longevity', contactpersoon: 'Roger Toussaint', beschrijving: 'Algemeen dossier' },
  { dossiernaam: 'Luiten Greenhouses / Van Rijsoort', contactpersoon: "Richard Luiten, Albert 't Hart", beschrijving: 'Oosv, werknemer is procedure begonnen: berust in het ontslag maar vraagt hoge vergoeding. Advocaat werknemer: Peter Paul Elshof. Onderhandelingen lopen, met name over aandelen: als Van Rijsoort bad leaver is, verliest hij 5 ton inleg; bij good leaver verliest hij 2 ton. Stek (Gerben Smit) betrekken voor corporate kant.' },
  { dossiernaam: 'Medical Measurement Systems BV (Laborie)', contactpersoon: 'Andrea Cline, Carl Paulsen (HR), Alex English (legal)', beschrijving: 'Algemeen dossier; plus een zaak: Dana Koopman, ziek, mogelijk reorganisatie', waarnemers: 'Jochem, Kay' },
  { dossiernaam: 'Nebras', contactpersoon: 'Breck en Ali AlAhbabi', beschrijving: 'Olie/gas uit Qatar, algemeen dossier, bonus discussies werknemers', waarnemers: 'Julia' },
  { dossiernaam: 'Nok5 OR', contactpersoon: 'Michel Compas, Koen Heeringa, Lucas Brabers (JB law)', beschrijving: 'Advies OR. Advies bij overname Bos, discussie SER (FNV)' },
  { dossiernaam: 'Parkbee', contactpersoon: 'Liana Rais', beschrijving: 'Algemeen dossier' },
  { dossiernaam: 'Recharge', contactpersoon: 'Wouter van Groeningen, Leanne Lochtenberg', beschrijving: 'Algemeen dossier, zaak gelijke behandeling', waarnemers: 'Juliette, Erika' },
  { dossiernaam: 'RWE', contactpersoon: 'Mirjam van Dijk (legal), Peter Dekkers, Jolanda de Wit, Rosalie van Hoek (HR), Do Meinesz (HR), Marielle Schuurmans', beschrijving: '- Heynen (ziek, lang in dienst, PIP)\n- Geuze (veroordeeld tot celstraf)' },
  { dossiernaam: 'Seacube', contactpersoon: 'Sara, Kristen', beschrijving: 'Algemeen dossier.' },
  { dossiernaam: 'Shiva (pro deo zaak, via Dierik Cras)', contactpersoon: 'Judith Meijer, Lode Wiegersma', beschrijving: 'Onderhandelingen vertrek directeur stichting, uren-discussie. Kan wachten tot ik terug ben' },
  { dossiernaam: 'Sligro', contactpersoon: 'Joost van Willigenborg (hoofd HR NL), Titia Schweitzer (beleid)', beschrijving: 'Algemeen dossier. CAO Gil' },
  { dossiernaam: 'Smit / Landal', contactpersoon: 'Tjalling Smit (CCO)', beschrijving: 'Discussie over andere rol of vertrek. Broer van Gerben Smit van Stek.', waarnemers: 'Bas' },
  { dossiernaam: 'Suit Supply', contactpersoon: 'Kirstina, Ethel Warwick, Fokke de Jong, Michel van der Lingen, Sofie van der Hoef', beschrijving: 'Algemeen dossier, zieke werknemer', waarnemers: 'Kay' },
  { dossiernaam: 'Taxture', contactpersoon: 'Boian Popoc, Brenda Kroeze', beschrijving: 'Disfunctionerende werknemer, dossier niet perfect op orde, ondanks mijn aandringen' },
  { dossiernaam: 'Tetra Pak BV', contactpersoon: 'Ginny Maynard, Agnes Kallo, Peter Csizmadia-Honigh, Tiny Post (voor CPS/Laude)', beschrijving: 'Zaken: - samenvoeging Tetra Pak BV en Tetra Pak Processing Systems BV: harmonisatie', waarnemers: 'Maaike' },
  { dossiernaam: 'Tetra Pak Processing Systems BV', contactpersoon: 'Ginny Maynard, Agnes Kallo', beschrijving: 'Algemeen dossier', waarnemers: 'Maaike' },
  { dossiernaam: 'Tetra Pak Cheese and Powder Systems BV', contactpersoon: 'Tiny Post, Ginny Maynard, Agnes Kallo', beschrijving: 'Algemeen dossier, vso zaak Henk de Kort, twee jaar ziekte. CAO Metalektro, eerdere onderhandelingen met bonden over eigen beloningssysteem (conform cao)', waarnemers: 'Maaike' },
  { dossiernaam: 'Tetra Pak CPS - Laude', contactpersoon: 'Tiny Post', beschrijving: 'Algemeen dossier. CAO Metaal en Techniek', waarnemers: 'Maaike' },
  { dossiernaam: 'Van Dijk Banket', contactpersoon: 'Hermien Mulder, Gijsbert van Dijk', beschrijving: 'Algemeen dossier. CAO Zoetwaren, standaard arbeidsovereenkomst', waarnemers: 'Erika' },
  { dossiernaam: 'Winter / VNAB', contactpersoon: 'Maarten Winter', beschrijving: 'Particulier (via Mark Philips). Vso, wil zelf ook vooral weg; maar nu eerst gevraagd om beter voorstel' },
  { dossiernaam: 'Wrist Klevenberg', contactpersoon: 'Anne', waarnemers: 'Kay, Jochem', beschrijving: 'Kay primair, evt. Jochem' },
  { dossiernaam: 'Ysquare', contactpersoon: 'Robbert Jan van der Weijden', beschrijving: 'Advies aan Ysquare over zieke werknemer en re-integratie', waarnemers: 'Juliette' },
  { dossiernaam: 'Zorgservice XL', contactpersoon: 'Alexandra van Leeuwen / Gina Lemmens', waarnemers: 'Julia' },

  // Stek-zaken
  { dossiernaam: 'Stek (algemeen)', beschrijving: 'Diverse Stek-zaken — zie subzaken hieronder', waarnemers: 'Juliette, Maaike' },
  { dossiernaam: 'Stek - HPI liquidatie', contactpersoon: 'Kelly Visser, Dawid van Stek', beschrijving: 'WMCO-melding. Sociaal plan, CNV heeft zich gemeld. Gedeeltelijke overname naar Ducona (meer dan 1,5 uur rijden enkele reis).', waarnemers: 'Kay, Juliette' },
  { dossiernaam: 'Stek - Minho (Fitz / Dirk de Graef)', beschrijving: 'DD', waarnemers: 'Juliette, Lodewijk' },
  { dossiernaam: 'Stek - Kantooradvies', contactpersoon: 'Bernadette van den Broek', beschrijving: 'Advies kantoor: lopende zaak advocaat-stagiair', waarnemers: 'Maaike, Bas' },
  { dossiernaam: 'Stek - BD Concepts B.V. (financial lease)', beschrijving: 'Advies over CEO (Dirk de Graeff, Lappain)', waarnemers: 'Juliette' },
  { dossiernaam: 'Stek - Algarve, nieuwe DD (Fitz / Rim Roomberg)', beschrijving: 'DD', waarnemers: 'Maaike' },
  { dossiernaam: 'Stek - Tata Steel (project Dynamo)', contactpersoon: 'Ruben Tros', beschrijving: 'HR-commitments. Mogelijk ontslag/herplaatsing werknemer.', waarnemers: 'Juliette' },
]

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[import-marnix-handover] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    const marnix = await prisma.user.findFirst({
      where: { name: { startsWith: 'Marnix' } },
      select: { id: true },
    })
    if (!marnix) {
      console.log('[import-marnix-handover] Marnix niet gevonden — overslaan')
      return
    }

    const existing = await prisma.handover.findFirst({
      where: {
        userId: marnix.id,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      },
      select: { id: true },
    })
    if (existing) {
      console.log(`[import-marnix-handover] al uitgevoerd (${existing.id}) — overslaan`)
      return
    }

    const handover = await prisma.handover.create({
      data: {
        userId: marnix.id,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        note: NOTE,
        cases: {
          create: CASES.map((c) => ({
            dossiernaam: c.dossiernaam,
            contactpersoon: c.contactpersoon || null,
            beschrijving: c.beschrijving || null,
            waarnemers: c.waarnemers || '',
          })),
        },
      },
      select: { id: true },
    })
    console.log(`[import-marnix-handover] ${CASES.length} zaken aangemaakt (${handover.id})`)
  } catch (err) {
    console.error('[import-marnix-handover] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
