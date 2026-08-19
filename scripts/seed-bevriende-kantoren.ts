// Idempotent: vult Bevriende Kantoren met initiële data uit Excel
// ("Lijst_bevriende_kantoren_bijgewerkt_juni_2026"). Voert alleen seeds in als
// de tabel leeg is — wijzigingen via de UI blijven dus bewaard.
//
// Bron van waarheid voor de volledige lijst. Voor een herbouw van een reeds
// gevulde tabel: gebruik een los script dat NATIONAL/INTERNATIONAL importeert.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface KantoorSeed {
  category: string
  naam: string
  adres?: string | null
  plaats?: string | null
  email?: string | null
  telefoon?: string | null
  contactDaar?: string | null
  contactWorkx?: string | null
  bijzonderheden?: string | null
  sortOrder: number
}

// type = 'national' (rechtsgebied of Mediators als categorie)
export const NATIONAL: KantoorSeed[] = [
  // Toevoegingen / alle rechtsgebieden
  { category: 'Toevoegingen / alle rechtsgebieden', naam: 'Spuistraat 10 Advocaten', adres: 'Spuistraat 10', plaats: 'Amsterdam', email: 'info@spuistraat10.nl', telefoon: '020 5205100', sortOrder: 0 },
  { category: 'Toevoegingen / alle rechtsgebieden', naam: 'Legalloyd', adres: 'Meeuwenlaan 98-100', plaats: 'Amsterdam', email: 'info@legalloyd.com', telefoon: '020 3032024', sortOrder: 1 },
  { category: 'Toevoegingen / alle rechtsgebieden', naam: 'Loos en Boukema advocaten', adres: 'Marnixstraat 144', plaats: 'Amsterdam', email: 'info@loosboukema.nl', telefoon: '020 3200046', contactDaar: 'Sara Van Eck', contactWorkx: 'Maaike', bijzonderheden: 'Doen ook toevoegingen', sortOrder: 2 },
  // Ondernemingsrecht
  { category: 'Ondernemingsrecht', naam: 'Stek', adres: 'Vijzelstraat 72', plaats: 'Amsterdam', email: 'info@stek.com', telefoon: '020 530 5200', sortOrder: 0 },
  { category: 'Ondernemingsrecht', naam: 'De Roos advocaten', adres: 'Hamerstraat 19-1', plaats: 'Amsterdam', telefoon: '020 303 8880', sortOrder: 1 },
  { category: 'Ondernemingsrecht', naam: 'Strauswolfs advocaten', adres: 'Jollemanhof 150/152', plaats: 'Amsterdam', email: 'jl@strauswolfs.nl', telefoon: '020 238 41 50', contactDaar: 'Jonathan Lugg', contactWorkx: 'Bas', bijzonderheden: 'Schakelt ons in voor arbeidsrecht', sortOrder: 2 },
  // Fiscaal recht
  { category: 'Fiscaal recht', naam: 'Van Loman', adres: 'De Boelelaan 7', plaats: 'Amsterdam', email: 'info@loman.com', telefoon: '020 760 4500', contactDaar: 'Laurens Lor, Marc Oostenbroek', sortOrder: 0 },
  { category: 'Fiscaal recht', naam: 'Tax at Work', adres: 'Condensatorweg 54 (Level 1)', plaats: 'Amsterdam', email: 'wanningen@taxatwork.nl', telefoon: '020 240 22 09', contactDaar: 'Raymond Wanningen of Martijn van de Koolwijk', contactWorkx: 'Bas', sortOrder: 1 },
  { category: 'Fiscaal recht', naam: 'KWPS', plaats: 'Amsterdam', email: 'info@kwps.nl', telefoon: '020 5891818', contactDaar: 'Natasja Winter, Jan-Olivier Kuijkhoven', bijzonderheden: 'Focus op pensioen; kostbaarder dan Van Loman voor fiscaal advies. Website: kwps.nl', sortOrder: 2 },
  // IE-recht
  { category: 'IE-recht', naam: 'Hoogenraad & Haak', adres: 'Cruquiusweg 109-B', plaats: 'Amsterdam', email: 'info@hoogenhaak.nl', telefoon: '+31 20 305 3060', contactDaar: 'Ebba Hoogenraad', contactWorkx: 'Emma van der Vos', sortOrder: 0 },
  { category: 'IE-recht', naam: 'Brinkhof', adres: 'De Lairessestraat 111-115', plaats: 'Amsterdam', email: 'info@brinkhof.com', telefoon: '020 3053200', sortOrder: 1 },
  // Bestuursrecht / ambtenarenrecht
  { category: 'Bestuursrecht / ambtenarenrecht', naam: 'Rohe advocaten', adres: 'Herengracht 514', plaats: 'Amsterdam', email: 'wyke@roheadvocaten.nl', telefoon: '020 737 0128', contactDaar: 'Wyke de Vos', contactWorkx: 'Maaike', sortOrder: 0 },
  { category: 'Bestuursrecht / ambtenarenrecht', naam: 'WinthagenMensink Advocaten', adres: 'Sarphatistraat 370', plaats: 'Amsterdam', email: 'mensink@winthagenmensink.nl', telefoon: '+31 20 261 89 22', contactDaar: 'Leon Mensink', contactWorkx: 'Bas', bijzonderheden: 'Klein kantoor. Leuk contactpersoon. Voormalig Allen & Overy.', sortOrder: 1 },
  // Immigratierecht
  { category: 'Immigratierecht', naam: 'Kroes Advocaten', adres: 'De Ruijterkade 112', plaats: 'Amsterdam', email: 'info@kroesadvocaten.nl', telefoon: '020 520 7050', contactDaar: 'Jelle Kroes of Sander Groen', bijzonderheden: 'Prettig en snel om mee te werken. Sturen af en toe een zaak door naar ons.', sortOrder: 0 },
  // Huurrecht en onroerend goed
  { category: 'Huurrecht en onroerend goed', naam: 'Six advocaten', adres: 'IJdok 25', plaats: 'Amsterdam', email: 'info@sixlegal.nl', telefoon: '020 3057410', contactDaar: 'Irma vd Berg, Femke Borst', bijzonderheden: 'Sturen ook zaken aan ons door.', sortOrder: 0 },
  // Familie- en Erfrecht
  { category: 'Familie- en Erfrecht', naam: 'Fam. Advocaten', adres: 'Strawinskylaan 1799', plaats: 'Amsterdam', email: 'stammes@famadvocaten.nl', telefoon: '020 261 3770', contactDaar: 'Martijn Stammes', contactWorkx: 'Martine', sortOrder: 0 },
  // Mediators
  { category: 'Mediators', naam: 'Youman Fischer', adres: 'Sarphatistraat 370', plaats: 'Amsterdam', email: 'secretariaat@youmanfischer.nl', telefoon: '+31 (0)20 2400 193', contactDaar: 'Mirjam Fiselier, Jan Willem Loman, Sanne Schreurs', sortOrder: 0 },
  { category: 'Mediators', naam: 'Paul Mediation', adres: 'Reyer Anslostraat 4 hs', plaats: 'Amsterdam', email: 'boontje@paulmediation.nl', telefoon: '06-21897771', contactDaar: 'Paul Boontje', sortOrder: 1 },
  { category: 'Mediators', naam: 'ReulingSchutte', adres: 'De Lairessestraat 137-143', plaats: 'Amsterdam', email: 'info@reulingschutte.nl', telefoon: '+31 (0)20 820 34 00', contactDaar: 'Eva Knipschild', sortOrder: 2 },
  { category: 'Mediators', naam: 'Mediation Amsterdam', adres: 'Johan van Hasseltweg 2C1', plaats: 'Amsterdam', email: 'info@mediationamsterdam.nl', telefoon: '020 685 33 30', contactDaar: 'Diederik Diercks', sortOrder: 3 },
]

// type = 'international' (categorie = land, voor de vlag)
export const INTERNATIONAL: KantoorSeed[] = [
  // Oostenrijk
  { category: 'Oostenrijk', naam: 'Zeiler', adres: 'Wiedner Gürtel 11, 1100 Wien', plaats: 'Wenen', email: 'office@zeiler.eu', telefoon: '+43 1 8901087-0', contactDaar: 'Lukas Wieser (AIJA)', contactWorkx: 'Juliette', bijzonderheden: 'EUR 350 per uur, prettig samengewerkt voor Polaroid', sortOrder: 0 },
  // België
  { category: 'België', naam: 'Taquet, Cless & Van Eeckhoutte', adres: 'Terhulpsesteenweg 166, 1170', plaats: 'Brussel', email: 'a.vandenabeele@bellaw.eu', telefoon: '+32 2 660 69 00', contactDaar: 'Mr. Antoine Vanden Abeele', bijzonderheden: 'Advocaat-vennoot / avocat associé', sortOrder: 0 },
  { category: 'België', naam: 'Curia', adres: 'Quinten Metsysplein 12, 3000 Leuven', plaats: 'Leuven en Brussel', email: 'els.leenaerts@curia.be', telefoon: '+32 16 31 41 18', contactDaar: 'Els Leenaerts', contactWorkx: 'Maaike', sortOrder: 1 },
  { category: 'België', naam: 'Lydian', adres: 'Arenbergstraat 23, 2000 Antwerpen', plaats: 'Antwerpen, Brussel, Hasselt', email: 'info@lydian.be', telefoon: '+32 3 304 90 00', contactDaar: 'Katrien Coenen en Kato Aarts (AIJA)', contactWorkx: 'Juliette', bijzonderheden: 'Uurtarieven tussen EUR 195 (junior) en EUR 460 (partner), prettig samenwerken (bijv. bij Pathé ingeschakeld)', sortOrder: 2 },
  // Duitsland
  { category: 'Duitsland', naam: 'Altenburg Fachanwälte für Arbeitsrecht', adres: 'Unterer Anger 3, 80331', plaats: 'München', email: 'info@altenburg.net', telefoon: '+49 89 540 42 52 25', contactDaar: 'Mr. Andreas Ege (Partner) — a.ege@altenburg.net', sortOrder: 0 },
  { category: 'Duitsland', naam: 'ADVANT Beiten', adres: 'Ganghoferstraße 33', plaats: 'München', email: 'munich@advant-beiten.com', telefoon: '+49 89 35065-0', contactDaar: 'Virginia Maurer (AIJA)', contactWorkx: 'Juliette', bijzonderheden: 'Uurtarief EUR 420, AIJA discount EUR 400, prettig samengewerkt bij Polaroid', sortOrder: 1 },
  // Letland
  { category: 'Letland', naam: 'Ellex Klavins', adres: 'K. Valdemāra iela 62', plaats: 'Riga', email: 'latvia@ellex.legal', telefoon: '+371 6781 4848', contactDaar: 'Ints Skaldis (AIJA)', contactWorkx: 'Juliette', sortOrder: 0 },
  // Estland
  { category: 'Estland', naam: 'Magnusson (Tallinn)', adres: 'Maakri tn 19/1, 7e verdieping', plaats: 'Tallinn', email: 'tallinn@magnussonlaw.com', telefoon: '+372 670 8401', contactWorkx: 'Juliette', sortOrder: 0 },
  // Frankrijk
  { category: 'Frankrijk', naam: 'Harvey Avocats', adres: '83, boulevard Haussmann, 75008', plaats: 'Paris', email: 'fdavid@harlaylaw.com', telefoon: '+33 145 01 45 01', contactDaar: 'Mrs. Frédérique David', sortOrder: 0 },
  { category: 'Frankrijk', naam: 'Flichy Grangé Avocats', adres: "66 avenue d'Iéna, 75773", plaats: 'Paris', email: 'Grange@flichy.com, chafai@flichy.com', telefoon: '+33 156 62 30 00', contactDaar: 'Mr. Joël Grangé (Partner) + Mrs. Meryem Chafai El Alaoui (Associate)', contactWorkx: 'Maaike', bijzonderheden: 'Assistant: Mélanie Chappey, +33 156 62 75 33', sortOrder: 1 },
  { category: 'Frankrijk', naam: 'Solucial Avocats', adres: '9 rue Beaujon', plaats: 'Paris', telefoon: '+33 (0)1 47 04 27 55', contactDaar: 'Caroline Barbre (AIJA)', contactWorkx: 'Juliette', sortOrder: 2 },
  { category: 'Frankrijk', naam: 'JP Karsenty & Associés', adres: '6 Place de la République Dominicaine', plaats: 'Paris', email: 'cabinet@jpkarsenty.com', telefoon: '+33 (0)1 47 63 74 75', contactDaar: 'Clemence Colin (AIJA)', contactWorkx: 'Juliette', sortOrder: 3 },
  // Hongarije
  { category: 'Hongarije', naam: 'Kapi Legal', adres: 'Árpád fejedelem útja 26-28', plaats: 'Budapest', email: 'office@kapilegal.hu', telefoon: '+36 30 244 9968', contactDaar: 'Anikó Kapi (AIJA) — kapi.aniko@kapilegal.hu', contactWorkx: 'Juliette', sortOrder: 0 },
  // Italië
  { category: 'Italië', naam: 'Lexellent', adres: 'Via Borghetto 3, 20121', plaats: 'Milano', telefoon: '+39 02 87 25 171', contactDaar: 'Mr. Sergio Barozzi (Founding partner) — sergiobarozzi@lexellent.it, +39 335 83 99 786; Mrs. Sofia Bargellini (Lawyer) — SofiaBargellini@lexellent.it', sortOrder: 0 },
  { category: 'Italië', naam: 'Target Law', plaats: 'Milano', email: 'luigipaolo.marino@targetlaw.it', telefoon: '+39 02 72008247', contactDaar: 'Luigipaolo Marino (Associate)', bijzonderheden: 'Litigation & arbitration (civil/commercial). Website: targetlaw.it', sortOrder: 1 },
  // Spanje
  { category: 'Spanje', naam: 'Ecija Abogados', adres: 'Avda. Diagonal, 458, 8ª planta, 08006', plaats: 'Barcelona', email: 'info@ecija.com', telefoon: '+34 933 808 255', contactDaar: 'Mr. Alfonso Maria Autuori (Lawyer) — aautuori@ecijalegal.com; Mrs. Stella Raventós Calvo (Tax partner) — sraventos@ecijalegal.com', sortOrder: 0 },
  { category: 'Spanje', naam: 'Cuatrecasas', adres: 'Calle Almagro 9', plaats: 'Madrid', email: 'madrid@cuatrecasas.com', telefoon: '+34 91 524 71 00', contactDaar: 'Alvaro Fernandez (AIJA)', contactWorkx: 'Juliette', sortOrder: 1 },
  // Portugal
  { category: 'Portugal', naam: 'FCB Sociedade de Advogados', adres: 'Av. da Liberdade, 249 – 1º, 1250-143', plaats: 'Lisbon', telefoon: '+351 213 587 500', contactDaar: 'Mr. Pedro Guimarães (Partner) — pgg@fcblegal.com', sortOrder: 0 },
  // Polen
  { category: 'Polen', naam: 'Łaszczuk i Wspólnicy sp.k.', adres: 'Plac Marszałka Józefa Piłsudskiego 2, 00-073', plaats: 'Warschau', email: 'warsaw@laszczuk.pl', telefoon: '+48 22 351 00 67', contactDaar: 'Mr. Michał Chodkowski (Lawyer) — michal.chodkowski@laszczuk.pl', sortOrder: 0 },
  { category: 'Polen', naam: 'Wardyński & Partners', adres: 'Al. Ujazdowskie 10', plaats: 'Warschau', email: 'warsaw@wardynski.com.pl', telefoon: '+48 22 437 82 00', contactDaar: 'Marcin Wujczyk (AIJA)', sortOrder: 1 },
  // Finland
  { category: 'Finland', naam: 'Castrén & Snellman Attorneys Ltd', adres: 'Eteläesplanadi 14, PO BOX 233, 00130', plaats: 'Helsinki', telefoon: '+358 20 776 57 65', contactDaar: 'Mr. Hannu Häkkänen (Senior Associate) — hannu.hakkanen@castren.fi', bijzonderheden: 'Assistant: Krista Nieminen — krista.nieminen@castren.fi, +358 20 776 53 24', sortOrder: 0 },
  { category: 'Finland', naam: 'Magnusson (Finland)', adres: 'Antinkatu 3 C', plaats: 'Helsinki', email: 'helsinki@magnussonlaw.com', telefoon: '+358 20 741 9500', contactDaar: 'Anu Vuori (AIJA)', contactWorkx: 'Juliette', sortOrder: 1 },
  // Saudi-Arabië
  { category: 'Saudi-Arabië', naam: 'Norton Rose Fulbright', adres: 'Mawhiba Center, 3rd Floor, Olaya Main Street, PO Box 52681, Riyadh 11573', plaats: 'Riyadh', telefoon: '+966 11 279 5400', contactDaar: 'Richard Tyner (Senior Counsel) — richard.tyner@nortonrosefulbright.com, +966 11 279 5401', sortOrder: 0 },
  // Servië
  { category: 'Servië', naam: 'BDK Advokati', adres: 'Majke Jevrosime 23, 11000', plaats: 'Beograd', email: 'office@bdkadvokati.com', telefoon: '+381 11 3284 212', contactDaar: 'Mrs. Ana Jankov (Partner) — Ana.Jankov@bdkadvokati.com, +381 69 651 168', sortOrder: 0 },
  // Zweden
  { category: 'Zweden', naam: 'Advokatfirman Vinge KB', adres: 'Nordstadstorget 6, Box 11025, 404 21', plaats: 'Göteborg', email: 'charlotte.forssander@vinge.se', telefoon: '+46 10 614 1000', contactDaar: 'Charlotte Forssander (Partner) — +46 10 614 1588, +46 72 179 1588', sortOrder: 0 },
  { category: 'Zweden', naam: 'NORMA law', adres: 'Parkgatan 49', plaats: 'Göteborg', email: 'info@normalaw.se', telefoon: '031-710 40 00', contactDaar: 'Jakob Nortoft (AIJA)', contactWorkx: 'Juliette', bijzonderheden: 'Uurtarieven tussen EUR 190 (junior) en EUR 425 (partner), AIJA referrals 15-20% discount, samengewerkt voor Polaroid', sortOrder: 1 },
  { category: 'Zweden', naam: 'Morris Law', adres: 'Vallgatan 30', plaats: 'Göteborg', telefoon: '010-722 36 00', contactDaar: 'Christoffer Erlandsson (AIJA)', bijzonderheden: 'Uurtarieven tussen EUR 200 en EUR 527', sortOrder: 2 },
  // Zwitserland
  { category: 'Zwitserland', naam: 'Prager Dreifuss AG', adres: 'Mühlebachstrasse 6, 8008', plaats: 'Zürich', email: 'info@prager-dreifuss.com', telefoon: '+41 44 254 55 55', contactDaar: 'Mr. Ralph Butz (Partner) — ralph.butz@prager-dreifuss.com; Mrs. Corinne Nobs (Counsel) — corinne.nobs@prager-dreifuss.com', sortOrder: 0 },
  { category: 'Zwitserland', naam: 'Lustenberger + Partners', adres: 'Wiesenstrasse 8', plaats: 'Zürich', email: 'office@lplegal.ch', telefoon: '+41 44 387 19 00', contactDaar: 'Monika McQuillen', contactWorkx: 'Juliette', sortOrder: 1 },
  { category: 'Zwitserland', naam: 'Lalive', adres: 'Stampfenbachplatz 4', plaats: 'Zürich', email: 'info@lalive.law', telefoon: '+41 58 105 2100', contactDaar: 'Andrea Florin (AIJA)', contactWorkx: 'Juliette', sortOrder: 2 },
  // Verenigd Koninkrijk
  { category: 'Verenigd Koninkrijk', naam: 'Fladgate', adres: '16 Great Queen Street', plaats: 'Londen', email: 'fladgate@fladgate.com', telefoon: '+44 (0)20 3036 7000', contactDaar: 'Michael McCartney', contactWorkx: 'Marnix', sortOrder: 0 },
  { category: 'Verenigd Koninkrijk', naam: 'Browne Jacobson', adres: 'Mowbray House, Castle Meadow Road', plaats: 'Nottingham', email: 'contactus@brownejacobson.com', telefoon: '+44 (0)370 270 6000', contactDaar: 'Emma Capper & Jennifer Jenkins (AIJA)', contactWorkx: 'Juliette, Maaike', bijzonderheden: 'Jennifer voor corporate employment/transactions', sortOrder: 1 },
  { category: 'Verenigd Koninkrijk', naam: 'DMH Stallard', adres: 'Wonersh House, The Guildway, Old Portsmouth Road', plaats: 'Guildford', email: 'enquiries@dmhstallard.com', telefoon: '01483 302 345', contactDaar: 'Hollie Ryan (AIJA)', contactWorkx: 'Juliette', bijzonderheden: 'Uurtarieven £237-363', sortOrder: 2 },
  // Ierland
  { category: 'Ierland', naam: 'Browne Jacobson', adres: '2 Hume Street', plaats: 'Dublin', email: 'contactus@brownejacobson.com', telefoon: '+353 (0)1 574 3910', contactDaar: 'Marie-Claire Scullion', contactWorkx: 'Juliette, Maaike', sortOrder: 0 },
  // Denemarken
  { category: 'Denemarken', naam: 'IUNO', adres: 'Njalsgade 19C, 3e verdieping', plaats: 'Kopenhagen', email: 'iuno@iuno.law', telefoon: '+45 5374 2700', contactDaar: 'Kirsten Astrup (AIJA)', contactWorkx: 'Juliette', bijzonderheden: 'Werkt ook voor Alo (door ons aanbevolen)', sortOrder: 0 },
  { category: 'Denemarken', naam: 'Jakob Johnsen (HjulmandKaptain)', adres: 'Havnepladsen 7', plaats: 'Frederikshavn', email: 'jjo@70151000.dk', telefoon: '+45 7221 1737', contactDaar: 'Jakob Johnsen — mobiel +45 2215 1174', bijzonderheden: 'HjulmandKaptain Advokatpartnerselskab', sortOrder: 1 },
  // Verenigde Staten
  { category: 'Verenigde Staten', naam: 'Morgan, Brown & Joy', adres: '54 Court St, Downtown, MA', plaats: 'Boston', telefoon: '(617) 523-6666', contactDaar: 'Jeff Siegel & Alexandra Pichette', contactWorkx: 'Juliette', bijzonderheden: 'Geen large firm fees', sortOrder: 0 },
  { category: 'Verenigde Staten', naam: 'Pinkham Busny', adres: '42 Pleasant St #1', plaats: 'Woburn', telefoon: '781-933-6840', contactDaar: 'Margaret Pinkham & Elise Busny', contactWorkx: 'Juliette', bijzonderheden: 'Geen large firm fees', sortOrder: 1 },
  { category: 'Verenigde Staten', naam: 'Fisher Phillips', adres: 'Two Logan Square, 100 N. 18th Street', plaats: 'Philadelphia', telefoon: '610.230.2150', contactDaar: 'Nan Sato, Michael Avila & Naz Afshar', contactWorkx: 'Juliette', bijzonderheden: 'Geen large firm fees, kantoren in vrijwel alle staten', sortOrder: 2 },
  // Luxemburg
  { category: 'Luxemburg', naam: 'M&S Law Firm', adres: "205, Route d'Arlon, L-1150", plaats: 'Luxembourg', email: 'info@moyal-simon.com', telefoon: '+352 28 80 18', contactDaar: 'Julie Warnecke (AIJA)', contactWorkx: 'Juliette', bijzonderheden: 'Smaller firm', sortOrder: 0 },
]

export async function main() {
  const count = await prisma.bevriendKantoor.count()
  if (count > 0) {
    console.log(`Bevriende Kantoren tabel niet leeg (${count} rijen) — seed overgeslagen.`)
    return
  }
  const data = [
    ...NATIONAL.map(k => ({ ...k, type: 'national' })),
    ...INTERNATIONAL.map(k => ({ ...k, type: 'international' })),
  ]
  await prisma.bevriendKantoor.createMany({ data })
  console.log(`Bevriende Kantoren geseed: ${data.length} rijen.`)
}

if (require.main === module) {
  main().catch(console.error).finally(() => prisma.$disconnect())
}
