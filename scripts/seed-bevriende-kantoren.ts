// Idempotent: vult Bevriende Kantoren met initiële data uit Excel.
// Voert alleen seeds in als de tabel leeg is — wijzigingen via UI blijven dus bewaard.

import { PrismaClient } from '@prisma/client'

const NATIONAL: Array<Omit<{ type: string; category: string; naam: string; adres?: string | null; plaats?: string | null; email?: string | null; telefoon?: string | null; contactDaar?: string | null; contactWorkx?: string | null; bijzonderheden?: string | null; sortOrder: number }, 'type'>> = [
  // Toevoeging - alle rechtsgebieden
  { category: 'Toevoegingen / alle rechtsgebieden', naam: 'Spuistraat 10 Advocaten', adres: 'Spuistraat 10', plaats: 'Amsterdam', email: 'info@spuistraat10.nl', telefoon: '020 5205100', sortOrder: 0 },
  { category: 'Toevoegingen / alle rechtsgebieden', naam: 'Legalloyd', adres: 'Meeuwenlaan 98-100', plaats: 'Amsterdam', email: 'info@legalloyd.com', telefoon: '020 3032024', sortOrder: 1 },
  { category: 'Toevoegingen / alle rechtsgebieden', naam: 'Loos en Boukema advocaten', adres: 'Marnixstraat 144', plaats: 'Amsterdam', email: 'info@loosboukema.nl', telefoon: '020 3200046', contactDaar: 'Sara Van Eck', contactWorkx: 'Maaike', bijzonderheden: 'Doen ook toevoegingen', sortOrder: 2 },
  // Ondernemingsrecht
  { category: 'Ondernemingsrecht', naam: 'Stek', adres: 'Vijzelstraat 72', plaats: 'Amsterdam', email: 'info@stek.com', telefoon: '020 530 5200', sortOrder: 0 },
  { category: 'Ondernemingsrecht', naam: 'De Roos advocaten', adres: 'Hamerstraat 19-1', plaats: 'Amsterdam', telefoon: '020 303 8880', sortOrder: 1 },
  { category: 'Ondernemingsrecht', naam: 'Strauswolfs advocaten', adres: 'Jollemanhof 150/152', plaats: 'Amsterdam', email: 'jl@strauswolfs.nl', telefoon: '020 238 41 50', contactDaar: 'Jonathan Lugg', contactWorkx: 'Bas', bijzonderheden: 'Schakelt ons in voor arbeidsrecht', sortOrder: 2 },
  // Fiscaal
  { category: 'Fiscaal recht', naam: 'Van Loman', adres: 'De Boelelaan 7', plaats: 'Amsterdam', email: 'info@loman.com', telefoon: '020 760 4500', contactDaar: 'Laurens Lor, Marc Oostenbroek', sortOrder: 0 },
  { category: 'Fiscaal recht', naam: 'Tax at Work', adres: 'Condensatorweg 54 (Level 1)', plaats: 'Amsterdam', email: 'wanningen@taxatwork.nl', telefoon: '020 240 22 09', contactDaar: 'Raymond Wanningen of Martijn van de Koolwijk', contactWorkx: 'Bas', sortOrder: 1 },
  { category: 'Fiscaal recht', naam: 'KWPS', adres: 'kwps.nl', plaats: 'Amsterdam', email: 'info@kwps.nl', telefoon: '020 5891818', contactDaar: 'Natasja Winter, Jan-Olivier Kuijkhoven', bijzonderheden: 'Focus op pensioen, kostbaarder dan Van Loman voor fiscaal advies', sortOrder: 2 },
  // IE
  { category: 'IE-recht', naam: 'Brinkhof', adres: 'De Lairessestraat 111-115', plaats: 'Amsterdam', email: 'info@brinkhof.com', telefoon: '020 3053200', sortOrder: 0 },
  // Bestuursrecht
  { category: 'Bestuursrecht / ambtenarenrecht', naam: 'Rohe advocaten', adres: 'Herengracht 514', plaats: 'Amsterdam', email: 'wyke@roheadvocaten.nl', telefoon: '020 737 0128', contactDaar: 'Wyke de Vos', contactWorkx: 'Maaike', sortOrder: 0 },
  { category: 'Bestuursrecht / ambtenarenrecht', naam: 'WinthagenMensink Advocaten', adres: 'Sarphatistraat 370', plaats: 'Amsterdam', email: 'mensink@winthagenmensink.nl', telefoon: '+31 20 261 89 22', contactDaar: 'Leon Mensink', contactWorkx: 'Bas', bijzonderheden: 'Klein kantoor. Leuk contactpersoon. Voormalig Allen & Overy.', sortOrder: 1 },
  // Immigratierecht
  { category: 'Immigratierecht', naam: 'Kroes Advocaten', adres: 'De Ruijterkade 112', plaats: 'Amsterdam', email: 'info@kroesadvocaten.nl', telefoon: '020 520 7050', contactDaar: 'Jelle Kroes of Sander Groen', bijzonderheden: 'Prettig en snel om mee te werken. Sturen af en toe een zaak door naar ons.', sortOrder: 0 },
  // Huurrecht
  { category: 'Huurrecht en onroerend goed', naam: 'Six advocaten', plaats: 'Amsterdam', contactDaar: 'Irma vd Berg, Femke Borst', bijzonderheden: 'Sturen ook zaken aan ons door.', sortOrder: 0 },
  // Familie- en Erfrecht
  { category: 'Familie- en Erfrecht', naam: 'Fam. Advocaten', adres: 'Strawinskylaan 1799', plaats: 'Amsterdam', email: 'stammes@famadvocaten.nl', telefoon: '020 261 3770', contactDaar: 'Martijn Stammes', contactWorkx: 'Martine', sortOrder: 0 },
]

const INTERNATIONAL = [
  // België
  { category: 'België', naam: 'Taquet, Cless & Van Eeckhoutte', adres: 'Terhulpsesteenweg 166, 1170', plaats: 'Brussel', email: 'a.vandenabeele@bellaw.eu', telefoon: '+32 2 660 69 00', contactDaar: 'Mr. Antoine Vanden Abeele', bijzonderheden: 'Advocaat-vennoot / avocat associé', sortOrder: 0 },
  { category: 'België', naam: 'Curia', adres: 'curia.be', plaats: 'Leuven en Brussel', email: 'els.leenaerts@curia.be', telefoon: '+32 16 31 41 18', contactDaar: 'Els Leenaerts', contactWorkx: 'Maaike', sortOrder: 1 },
  // Duitsland
  { category: 'Duitsland', naam: 'Altenburg Fachanwälte für Arbeitsrecht', adres: 'Unterer Anger 3, 80331', plaats: 'München', email: 'info@altenburg.net', telefoon: '+49 89 540 42 52 25', contactDaar: 'Mr. Andreas Ege (Partner) — a.ege@altenburg.net', sortOrder: 0 },
  // Frankrijk
  { category: 'Frankrijk', naam: 'Harvey Avocats', adres: '83, boulevard Haussmann, 75008', plaats: 'Paris', email: 'fdavid@harlaylaw.com', telefoon: '+33 145 01 45 01', contactDaar: 'Mrs. Frédérique David', sortOrder: 0 },
  { category: 'Frankrijk', naam: 'Flichy Grangé Avocats', adres: '66 avenue d’Iéna, 75773', plaats: 'Paris', email: 'Grange@flichy.com / chafai@flichy.com', telefoon: '+33 156 62 30 00', contactDaar: 'Mr. Joël Grangé (Partner) + Mrs. Meryem Chafai El Alaoui (Associate)', contactWorkx: 'Maaike', bijzonderheden: 'Assistant: Mélanie Chappey, +33 156 62 75 33', sortOrder: 1 },
  // Italië
  { category: 'Italië', naam: 'Lexellent', adres: 'Via Borghetto 3, 20121', plaats: 'Milano', telefoon: '+39 02 87 25 171', contactDaar: 'Mr. Sergio Barozzi (Founding partner) — sergiobarozzi@lexellent.it, +39 335 83 99 786\nMrs. Sofia Bargellini (Lawyer) — SofiaBargellini@lexellent.it', sortOrder: 0 },
  // Spanje
  { category: 'Spanje', naam: 'Ecija Abogados', adres: 'Avda. Diagonal, 458, 8ª planta, 08006', plaats: 'Barcelona', email: 'info@ecija.com', contactDaar: 'Mr. Alfonso Maria Autuori (Lawyer) — aautuori@ecijalegal.com\nMrs. Stella Raventós Calvo (Tax partner) — sraventos@ecijalegal.com', sortOrder: 0 },
  // Portugal
  { category: 'Portugal', naam: 'FCB Sociedade de Advogados', adres: 'Av. da Liberdade, 249 – 1º, 1250-143', plaats: 'Lisbon', telefoon: '+351 213 587 500', contactDaar: 'Mr. Pedro Guimarães (Partner) — pgg@fcblegal.com', sortOrder: 0 },
  // Polen
  { category: 'Polen', naam: 'Łaszczuk i Wspólnicy sp.k.', adres: 'Plac. Marszałka Józefa Piłsudskiego 2, 00-073', plaats: 'Warschau', email: 'warsaw@laszczuk.pl', telefoon: '+48 22 351 00 67', contactDaar: 'Mr. Michał Chodkowski (Lawyer) — michal.chodkowski@laszczuk.pl', sortOrder: 0 },
  // Finland
  { category: 'Finland', naam: 'Castrén & Snellman Attorneys Ltd', adres: 'Eteläesplanadi 14, PO BOX 233, 00130', plaats: 'Helsinki', telefoon: '+358 20 776 57 65', contactDaar: 'Mr. Hannu Häkkänen (Senior Associate) — hannu.hakkanen@castren.fi', bijzonderheden: 'Assistant: Krista Nieminen — krista.nieminen@castren.fi, +358 20 776 53 24', sortOrder: 0 },
  // Saudi-Arabië
  { category: 'Saudi-Arabië', naam: 'Norton Rose Fulbright', adres: 'Mawhiba Center 3rd Floor, Olaya Main Street, PO Box 52681', plaats: 'Riyadh 11573', telefoon: '+966 11 279 5400', contactDaar: 'Richard Tyner (Senior Counsel) — richard.tyner@nortonrosefulbright.com, +966 11 279 5401\nAl-Nakhlah Tower, 17th Floor, King Fahad Road, As Sahafah', sortOrder: 0 },
  // Servië
  { category: 'Servië', naam: 'BDK Advokati', adres: 'Majke Jevrosime 23, 11000', plaats: 'Beograd', telefoon: '+381 11 3284 212', contactDaar: 'Mrs. Ana Jankov (Partner) — Ana.Jankov@bdkadvokati.com, +381 69 651 168', sortOrder: 0 },
  // Zweden
  { category: 'Zweden', naam: 'Advokatfirman Vinge KB', adres: 'Nordstadstorget 6, Box 11025, 404 21', plaats: 'Göteborg', email: 'charlotte.forssander@vinge.se', telefoon: '+46 10 614 1000', contactDaar: 'Charlotte Forssander (Partner) — +46 10 614 1588, +46 72 179 1588', sortOrder: 0 },
  // Zwitserland
  { category: 'Zwitserland', naam: 'Prager Dreifuss AG', adres: 'Mühlebachstrasse 6, 8008', plaats: 'Zürich', telefoon: '+41 44 254 55 55', contactDaar: 'Mr. Ralph Butz (Partner) — ralph.butz@prager-dreifuss.com\nMrs. Corinne Nobs (Counsel) — corinne.nobs@prager-dreifuss.com', sortOrder: 0 },
]

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-bevriende-kantoren] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    const existing = await prisma.bevriendKantoor.count()
    if (existing > 0) {
      console.log(`[seed-bevriende-kantoren] tabel heeft al ${existing} entries — geen seed`)
      return
    }
    const rows = [
      ...NATIONAL.map(r => ({ ...r, type: 'national' as const })),
      ...INTERNATIONAL.map(r => ({ ...r, type: 'international' as const })),
    ]
    await prisma.bevriendKantoor.createMany({ data: rows })
    console.log(`[seed-bevriende-kantoren] ${rows.length} kantoren geseed (${NATIONAL.length} NL + ${INTERNATIONAL.length} intl)`)
  } catch (err) {
    console.error('[seed-bevriende-kantoren] mislukt:', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()