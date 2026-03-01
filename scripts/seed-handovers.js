const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const wiesId = 'cml1u6kar000h4ehqi31a0w4j';
  const emmaId = 'cml1u6kcn000k4ehqw2uqlmya';
  const now = new Date();

  // ═══════════════════════════════════════════════════
  // WIES VAN PESCH — Overdracht vakantie en verlof
  // ═══════════════════════════════════════════════════
  const wiesStart = new Date();
  const wiesEnd = new Date();
  wiesEnd.setDate(wiesEnd.getDate() + 28);

  const wiesHandover = await p.handover.create({
    data: {
      userId: wiesId,
      periodStart: wiesStart,
      periodEnd: wiesEnd,
      note: 'Overdracht vakantie en verlof Wies',
      cases: {
        create: [
          {
            dossiernaam: 'Dura Vermeer Divisie Infra / advies',
            contactpersoon: 'Lotte Meerdink Veldboom, Anouk Krabbendam, Renske van Heijst, Anneloes van den Berg',
            beschrijving: 'Geen lopende zaken -- ik mail mijn contactpersonen dat ze bij Julia/Justine terecht kunnen in mijn afwezigheid',
            waarnemers: 'Julia Groen, Justine Schellekens',
            updatedAt: now,
          },
          {
            dossiernaam: 'Booking.com / Tymms',
            contactpersoon: 'Yvette, Taken Julie',
            beschrijving: 'In onderhandeling over VSO met werknemer Ben Tymms nav verstoring in de arbeidsrelatie. Momenteel in afwachting van reactie Tymms op voorstel namens Booking. Marlieke kent de zaak, overdracht na morgen/donderdag aan Julia',
            waarnemers: 'Julia Groen',
            updatedAt: now,
          },
          {
            dossiernaam: 'RWE Generation NL / Kruit',
            contactpersoon: 'Jolanda de Wit-Lemmens, Arjan van der Velt',
            beschrijving: 'Ontbindingsverzoek RWE afgewezen, in overleg met RWE over hoe nu verder.',
            waarnemers: 'Marnix Ritmeester',
            updatedAt: now,
          },
          {
            dossiernaam: 'Ncardia B.V. / employment advice',
            contactpersoon: 'Veronique Deswaef',
            beschrijving: 'Korte vraag Veronique over voorwaarden \'normale\' parttime arbeidsovereenkomst met student -- heb ik beantwoord en verwacht geen opvolging. Ik heb Veronique laten weten dat ze Jochem kunnen mailen in geval van vragen (Jochems klant en dan kan hij het weer herverdelen).',
            waarnemers: 'Jochem de Roos',
            updatedAt: now,
          },
          {
            dossiernaam: 'MODIFI B.V. / employment issues',
            contactpersoon: 'Larisa Holzner',
            beschrijving: 'Loopt nu niets. Komt soms in de lucht met verzoek bijstand in boventalligheidszaken nav reorganisatie -- Larisa weet een beetje hoe het zit met NL arbeidsrecht, dat er een A-formulier (door ons) moet worden ingediend voordat ze het gesprek aangaan en dat er een goed verhaal moet zijn. Gewoon naar info@workx.nl',
            waarnemers: '',
            updatedAt: now,
          },
          {
            dossiernaam: 'Teero B.V. / employment issues',
            contactpersoon: 'Christian Wicks',
            beschrijving: 'Amerikaanse start/scale-up, platformbedrijf voor mondhygienisten. Werken sinds een paar jaar met ong 15 man in NL. 0,0 kennis van NL arbeidsrecht. Hadden oa geen basiscontract met arbo/bedrijfsarts tot ze zich bij ons meldden. Willen nu met 0 dossier af van werknemer Frank Koelewijn. Frank heeft nogal wat priveproblemen (gehad), o.a. sterfgevallen en zorg voor kleine kinderen, communiceert daar niet goed over en komt zijn afspraken niet na over wanneer wel/niet werken. Christian heeft hem een beeindigingsvoorstel gedaan, daar heeft Frank tot nu toe niet op gereageerd. Ik heb uitgelegd dat Frank alles kan vragen (en ook kan besluiten niet te willen onderhandelen) en dat dan het enige alternatief is wel alles goed bijhouden qua afwezigheid en daar bovenop zitten als het niet goed gaat. Christian doet de onderhandelingen zelf maar komt af en toe in de lucht voor overleg.',
            waarnemers: 'Heleen Pesser',
            updatedAt: now,
          },
          {
            dossiernaam: 'ITS Hendrion B.V. / advies arbeidsrecht',
            contactpersoon: 'Tjade Dieker',
            beschrijving: 'Concurrentiezaak -- ITS zit in de heftrucks en hoogwerkers. Ex-werknemer Sjoerd Barten heeft in december 2025 opgezegd en wordt nu aan zijn (in principe geldige) concurrentiebeding gehouden. Hij wilde per 1 februari jl. bij Motrac Linde in dienst treden en dat wil ITS voorkomen. ITS is \'banger\' voor het misbruiken van haar ex-werknemers door Motrac Linde dan voor deze werknemer zelf. Het gaat ITS erom dat ze niet willen dat Motrac al hun werknemers wegtrekt. Sjoerd is onderhoudsmonteur -- heb al uitvoerig met Tjade besproken dat de kans heel groot is dat hij in rechte wordt ontheven uit het beding. Maar het is een principekwestie voor ITS. ITS heeft zelf geprobeerd afspraken te maken met Motrac Linde maar daar is tot nu toe niet op gereageerd. Sjoerd heeft een advocaat die niet (mede) namens Motrac Linde optreedt. Er is een schikkingsvoorstel gekomen vanuit Sjoerd aan ITS waarop moet worden gereageerd.',
            waarnemers: 'Justine Schellekens',
            updatedAt: now,
          },
          {
            dossiernaam: 'Zig Software B.V. / advies arbeidsrecht',
            contactpersoon: 'Kiyomi Wong A Ton, Stephanie Saltzherr',
            beschrijving: 'Zaak werknemer Christine Sigmund-Moll; boventallige werknemer, wordt hopelijk deze week getekend. Kwestie informeren/handtekeningen vragen werknemers vanwege nieuwe bonusregeling: heeft OR blijkbaar mee ingestemd, nu is de vraag of ze handtekeningen gaan verzamelen of piepsysteem toepassen. Ze neigen naar het tweede. Nu geen actie vereist maar mogelijk wenst Kiyomi overleg.',
            waarnemers: 'Julia Groen',
            updatedAt: now,
          },
          {
            dossiernaam: 'BDR Thermea Group B.V. / advies arbeidsrecht',
            contactpersoon: 'Daphne Dumoulin, Charlotte Ruminak, Robert-Jan van Berckel',
            beschrijving: 'Zaak "Ozlem": Turkse werknemer in Finance team van BDR. Willen afscheid van haar nemen zonder dossier. Werkt al een paar jaar naar tevredenheid van BDR maar recent niet meer. Geadviseerd te beginnen met negatieve performance review en uitgelegd dat er geen reden is voor ontbinding. Werknemer heeft bovendien net een huis gekocht in NL en heeft de 30%-regeling. Maar haar functie komt mogelijk ook te vervallen; er is echter een werknemer met een uitwisselbare functie met een langer dienstverband. Geen actie nu vereist.\n\nZaak werknemer Martijn Haak: zitten ze mee in mediation. Haak kwam na sessie 1 met 3 opties: 1) kijken of de arbeidsrelatie toch nog kan worden hersteld op de werkvloer (ziet BDR niet zitten), 2) herplaatsing binnen BDR (is BDR nu aan het onderzoeken), 3) VSO (hiervoor concept aan Robert-Jan van Berckel gestuurd). BDR heeft op advies via mediator voorgesteld om opties 2 en 3 simultaan te verkennen. In afwachting reactie werknemer Haak hierop. Mogelijk moet waarnemer geheimhoudingsverklaring van mediator tekenen.',
            waarnemers: 'Maaike de Jong',
            updatedAt: now,
          },
          {
            dossiernaam: 'Legacy Brands Holding / arbeidsrecht advies',
            contactpersoon: 'Cees van den Heuvel',
            beschrijving: 'Geen lopende zaken maar Kay kent de client (legale wietplantteler). Ik laat Cees weten dat hij Kay kan benaderen in mijn afwezigheid.',
            waarnemers: 'Kay Maes',
            updatedAt: now,
          },
          {
            dossiernaam: 'NVD Beveiligingen / advies arbeidsrecht',
            contactpersoon: 'Koen van Zelst',
            beschrijving: 'Onderhandelingen met werknemer Jeffrey Talen hoop ik deze week af te ronden. Verder loopt er niets, Erika kent de klant dus ik laat hen weten dat ze Erika kunnen mailen in mijn afwezigheid.',
            waarnemers: 'Erika van Zadelhof',
            updatedAt: now,
          },
          {
            dossiernaam: 'Incision / employment issues',
            contactpersoon: 'Ilaria Cortassa, Luca Takacz',
            beschrijving: 'Incision heeft heel vaak korte vragen; Ilaria en Luca zitten in Duitsland en weten globaal wat van NL arbeidsrecht maar niet veel. Fijn als zij vast aanspreekpunt bij ons hebben. Lopende zaak van werknemer die na zwangerschaps- en bevallingsverlof nu onbetaald verlof heeft, van wie de functie is komen te vervallen. Werknemer heeft geen interesse in haar aangeboden passende functie en heeft zelf gesprek aangevraagd om te bespreken hoe nu verder. Besloten geen A-formulier in te dienen wegens eigen initiatief werknemer -- eerst aankijken waar zij mee komt voordat er een procedure in gang wordt gezet. Fijn als iemand dit kan overnemen want zal niet klaar zijn.',
            waarnemers: 'Heleen Pesser',
            updatedAt: now,
          },
          {
            dossiernaam: 'Kruithof / BeOne Medicines B.V.',
            contactpersoon: 'Ronnart Kruithof',
            beschrijving: 'Ronnart is Medical Director NL en in december 2025 benoemd tot statutair directeur na een aantal jaar werknemer te zijn geweest. Er is voor komende dinsdag 4 maart 2026 een ava gepland om hem te ontslaan wegens bedrijfseconomische redenen. Ronnart is van mening dat er 1) geen reden is voor boventalligheid, want er is een nieuwe functie (Medical Director Benelux) waarop hij heeft moeten solliciteren en niet is aangenomen die wel passend is voor hem, 2) hij uitsluitend is benoemd tot directeur om hem makkelijk te kunnen ontslaan, omdat reorganisatie al bekend was ttv zijn benoeming. Brief aan BeOne met reactie op voorgenomen ontslag en schikkingsvoorstel verstuurd.',
            waarnemers: 'Julia Groen',
            updatedAt: now,
          },
          {
            dossiernaam: 'Van de Wall / Brex',
            contactpersoon: 'Kalle van de Wall',
            beschrijving: 'Kalle is boventallig als gevolg van een reorganisatie. Meegedacht over reactie op beeindigingsvoorstel namens Kalle dat hij zelf vorige week heeft verstuurd. Ik laat hem weten bij wie hij terecht kan voor overleg tijdens mijn verlof.',
            waarnemers: 'Alain Heunen',
            updatedAt: now,
          },
          {
            dossiernaam: 'Harzing / Studytube',
            contactpersoon: 'Nick Harzing',
            beschrijving: 'Ontbindingsverzoek werkgever toegewezen onder toekenning van billijke vergoeding aan Nick, nog discussie over uitvoering vonnis en kosten Workx.',
            waarnemers: 'Heleen Pesser',
            updatedAt: now,
          },
          {
            dossiernaam: 'Aharon(-Bass) / Nike',
            contactpersoon: 'Ella Aharon',
            beschrijving: 'Zaak van Emma overgenomen -- werknemer is langdurig ziek, direct uitgevallen na terugkeer na zwangerschapsverlof wegens druk vanuit manager. Partijen hebben in december 1 mediationsessie gehad in aanwezigheid van Emma. Begin februari laten weten dat Ella graag elders in de organisatie zou willen worden herplaatst. Volgens Nike staat het haar vrij te solliciteren maar faciliteert Nike dit niet als onderdeel van een oplossing van de situatie. Toen gevraagd om VSO -- Nike heeft extreem terughoudend voorstel gedaan (einde aovk per 28 februari a.s. voorgesteld). Reactie verstuurd maar vraag me af of partijen hieruit komen in onderhandelingen. Nike vindt dat er een eenzijdig arbeidsconflict wordt ervaren dat nog prima kan worden opgelost en Ella ziet dat niet voor zich.',
            waarnemers: 'Alain Heunen',
            updatedAt: now,
          },
          {
            dossiernaam: 'Brightwell / Parochie Sint Nicolaas',
            contactpersoon: 'Giles Brightwell',
            beschrijving: 'Giles is muziekdirecteur in de Sint Nicolaaskerk. Aangezegd dat zijn functie zou komen te vervallen in najaar 2024 tijdens langdurige ziekte. Nu recent begin januari 2026 volledig hersteld, wordt niet toegelaten tot werk (daarover vindt 13 maart a.s. kg plaats), UWV-procedure gestart door werknemer en daar moet deze week op worden gereageerd door ons namens Giles. Kay en Heleen zijn volledig op de hoogte.',
            waarnemers: 'Heleen Pesser, Kay Maes',
            updatedAt: now,
          },
          {
            dossiernaam: 'Artikel ArbeidsRecht',
            contactpersoon: 'Yillis Smit',
            beschrijving: 'Eerste versie artikel over loondoorbetaling tijdens zwangerschapsverlof 18 februari 2026 ingeleverd, Erika gevraagd om eventuele vragen/input op artikel te verwerken.',
            waarnemers: 'Erika van Zadelhof',
            updatedAt: now,
          },
        ],
      },
    },
  });
  console.log('Wies handover created:', wiesHandover.id, '- cases:', 18);

  // ═══════════════════════════════════════════════════
  // EMMA VAN DER VOS — Overzicht overdracht Emma
  // ═══════════════════════════════════════════════════
  const emmaStart = new Date();
  const emmaEnd = new Date('2026-05-10');

  const emmaHandover = await p.handover.create({
    data: {
      userId: emmaId,
      periodStart: emmaStart,
      periodEnd: emmaEnd,
      note: 'Overzicht overdracht Emma. Justine beschikbaar tot ~25 april 2026, Emma terug ~10 mei 2026. In de tussenliggende weken neemt Bas of een senior over.\n\nOpmerking Emma: "Ik heb liever even een appje met een vraag als er iets onduidelijk is, dan dat jullie ploeteren, zuchten of steunen om duidelijk te krijgen wat ik bedoel/wat er speelt met een client of in een dossier! Voel je vrij om even in te checken, als het niet uitkomt dan app ik gewoon wat later terug, komt echt goed!"',
      cases: {
        create: [
          {
            dossiernaam: 'Tesla',
            contactpersoon: null,
            beschrijving: 'Arbeidsrechtzaken. Justine neemt waar tot ongeveer 25 april 2026. Emma komt terug ongeveer 10 mei 2026. In de tussenliggende weken, Bas of een senior.',
            waarnemers: 'Justine Schellekens',
            updatedAt: now,
          },
          {
            dossiernaam: 'Bekoba / Tesla',
            contactpersoon: null,
            beschrijving: 'Hoger beroep loopt. Wederpartij en Tesla zijn op de hoogte.',
            waarnemers: 'Justine Schellekens',
            updatedAt: now,
          },
          {
            dossiernaam: 'Triodos',
            contactpersoon: 'Avner',
            beschrijving: 'Julia neemt het waar, zij neemt contact op met Avner en zal de reorganisatie die is aangekondigd leiden.',
            waarnemers: 'Julia Groen',
            updatedAt: now,
          },
          {
            dossiernaam: 'Assured (Britse company)',
            contactpersoon: null,
            beschrijving: 'Geeft aan dat ze met veel werk in januari zullen komen. Is onduidelijk of het echt zoveel werk gaat zijn. Lijkt absoluut van niet. Gewoon iets als een template ofzo maar dan speciaal op hen afgestemd.',
            waarnemers: 'Justine Schellekens',
            updatedAt: now,
          },
          {
            dossiernaam: 'INDG',
            contactpersoon: 'Lianne',
            beschrijving: 'Softwarebedrijf met 300 werknemers. Contactpersoon is Lianne.',
            waarnemers: 'Marlieke Schipper',
            updatedAt: now,
          },
          {
            dossiernaam: 'Exodus',
            contactpersoon: 'Leen, Khadija, Regina',
            beschrijving: 'Vergeten vast dienstverband aan te bieden in 2021/22, meneer is anderhalf jaar niet beschikbaar geweest en had een andere baan maar claimt nu salaris met wettelijke verhoging. Er zijn onderhandelingen gaande want de wind waait niet goed gezien hoge raad uitspraak. Op 6 januari 2026 is er een bod gedaan door Olbina (werknemer). Rechtbank heeft verhinderdata ontvangen MAAR nog geen datum vastgesteld. Vraag aan waarnemer om daar achteraan te gaan en zich te stellen. Exodus wil de hele tijd evalueren omdat ze balen dat het zo is gegaan, zijn kritische klant en je moet ze in de gaten houden. Dus altijd contactpersoon Leen, Khadija en Regina in de AAN houden. Ze begrijpen niet veel van het recht en vertellen elkaar soms net de onjuiste versie door van wat ik heb verteld. Alles schriftelijk bevestigen voor de zekerheid. Ze mailen nu niet terug. Update: Khadija is uitgevallen.',
            waarnemers: 'Julia Groen',
            updatedAt: now,
          },
          {
            dossiernaam: 'Pieter Bon en SCR',
            contactpersoon: 'Marlies Crok',
            beschrijving: 'Leuke klant, Marlies Crok is vast contactpersoon en Bas kent Guido, de CEO. Ze hebben nu een zaak lopen met een werknemer die volgens de bedrijfsarts een driegesprek moet hebben met werkgever en de arbodienst. De arbodienst heeft toen een KOMPAS gesprek geinitieerd (een soort mediationgesprek maar dat heet geen mediation en is daar net voor) dat heeft de werknemer afgezegd. Nu is hij dus in strijd met de aanbevelingen van de bedrijfsarts aan het handelen. We overwogen een loonstop maar dat is alleen natuurlijk na waarschuwing en eerst moet de arbodienst weer een nieuwe afspraak inplannen. Ze doen daar heel irritant over, zeggen dat Kompasgesprek vrijwillig is en dus geen gepaste oplossing nu de werknemer daar niets in ziet, maar wij willen gewoon een driegesprek, hoeft geen KOMPAS gesprek te zijn gelijk. Ook leuk detail, de werknemer wordt bijgestaan door zijn vrouw die student rechten is (bestuursrecht) en zij stuurt vrij aparte e-mails. Marlies is interim HR en heb ik hoog zitten qua intelligentie, ze snapt soms het verschil tussen mediation en kompas niet. Marlies binnenkort contact met de bedrijfsarts en het is even de vraag of ze dan wel met een duidelijk advies komt. Wat mij betreft moet er gewoon een driegesprek komen met de arbodienst en een waarschuwingsbrief naar de werknemer dat hij dit keer moet meewerken en er anders een loonstop volgt. Er is al twee keer (of misschien 1 keer) een loonopschorting uitgevoerd bij deze werknemer en opgeheven (zonder onze inmenging).',
            waarnemers: 'Justine Schellekens',
            updatedAt: now,
          },
          {
            dossiernaam: 'Capcade',
            contactpersoon: 'Alex Zito',
            beschrijving: 'Erg relaxte vibe client. Alex Zito, amerikaan in Nederland die probeert de Nederlandse BV af te ronden voor Capcade. Op dit moment rond ik de werkzaamheden af voor mijn verlof. Ze starten een onderdeel van hun bedrijf in Nederland en wilden een arbeidsovereenkomst. Dat heb ik gedaan. Er is een kans dat ze in de toekomst meer willen. En er is ook een kans dat de man die ons inschakelt die werkt voor verschillende opdrachtgevers ons wil hebben voor een andere klant.',
            waarnemers: 'Marlieke Schipper',
            updatedAt: now,
          },
          {
            dossiernaam: 'A.S. Watson / Schoonderbeek',
            contactpersoon: 'Valentine (werkneemster/client)',
            beschrijving: 'Werkneemster is gezegd dat haar arbeidsovereenkomst tot een einde komt wegens niet goed functioneren. Valentine is de werkneemster en dat is de client. Er is geen verbetertraject geweest en zij heeft al een schriftelijke opzegtermijn van vier maanden. Watson biedt vijf maanden oid en ons eerste bod was een jaar. Nu ineens willen ze mediation, daar is absoluut geen aanleiding voor want er is geen conflict en Watson wil dit gebruiken om de ontslaggronden aan te vullen. Dus niet akkoord gaan. Vermoedelijke uitkomst wordt iets van 8 maanden (4 maanden opzegtermijn, zes maanden verbetertraject maar dan trek je er 2 af voor vrijstelling van werk, gehele kostenvergoeding juridische kosten, outplacement etc). Nu dus terugduwen op het stomme mediationplan. Ze dreigen overigens met het starten van een verbetertraject als ze niet akkoord gaat. Gezegd dat ze dat niet gaat doen omdat Watson al heeft laten weten dat ze weg moet dus dat er voor haar niets te winnen is, en dat er ook nog risico is dat dit haar mentale gezondheid schaadt, en dat het ook nog daarna vier maanden duurt voordat ze van haar afkunnen. Dus dat het logischer is om nu te dealen ipv van over een jaar. Helaas lijkt Watson een echte prijsvechter en nog niet geinteresseerd. Laatste mail stamt van 23 december en Valentine heeft geen haast dus we laten de situatie ook een beetje aanmodderen. Volgende actie is e-mail aan werkgever dat niet duidelijk is waarvoor mediation nodig is. Ze zijn wel al akkoord met 2500 ex BTW advocaatkosten.',
            waarnemers: 'Julia Groen',
            updatedAt: now,
          },
          {
            dossiernaam: 'Aharon / Nike',
            contactpersoon: 'Ella Aharon',
            beschrijving: 'Hele lieve, israelische vrouw waarmee ik mediation heb gedaan. Het idee is dat zij nu de mediator laat weten wat zij "wil". Ze wil weg, maar ze is ook erg ziek en er was veel toxic gaslighting. Plan is, brief volgende week met boodschap: het moet inderdaad eindigen maar cliente is ziek. Werden tijdens mediation nare dingen gezegd die onwaar waren (Ella kan daar lijstje van maken) en Ella is heel lang, meer dan een jaar in het duister gehouden over welke functie ze zou mogen terugkeren en nu is er ineens een functie voor haar waar ze morgen mag beginnen. Vertrouwen is helemaal weg. Er is ook een zwangerschapsdiscriminatieaspect, er wordt de hele tijd verweten dat zij een hele normale vorm van zwangerschapsverlof en ouderschapsverlof heeft aangevraagd. Er moet volgende week iets gebeuren. Emma belt Wies wanneer zij terug is.',
            waarnemers: 'Wies van Pesch',
            updatedAt: now,
          },
          {
            dossiernaam: 'Ticketswap',
            contactpersoon: null,
            beschrijving: 'College voor de rechten van de mens. Ze hebben aanbod ingetrokken van een vrouwelijke werkneemster die net daarvoor een aantal keer wees op haar moederschapsrechten. Zij heeft klacht ingediend college. Ticketswap zegt dat het een financiele beslissing was om haar aanbod in te trekken. Zie dossier met analyse.',
            waarnemers: 'Erika van Zadelhof',
            updatedAt: now,
          },
          {
            dossiernaam: 'Kino',
            contactpersoon: null,
            beschrijving: 'Status: niet echt iets veranderd, done.',
            waarnemers: 'Wies van Pesch',
            updatedAt: now,
          },
          {
            dossiernaam: 'OR CEAD Delft',
            contactpersoon: null,
            beschrijving: 'Nieuwe client, volgende stap is inschatting kosten. Via app gebeurd, Julia is op de hoogte. Mag altijd in overleg met partner.',
            waarnemers: 'Julia Groen',
            updatedAt: now,
          },
          {
            dossiernaam: 'Jaarsma / engnekken B.V.',
            contactpersoon: 'Jaarsma',
            beschrijving: 'Afwachting vonnis. Kay gaat bellen naar Hof om vonnis te verkrijgen, zes weken na 5 dec. Jaarsma moet nog geappt worden.',
            waarnemers: 'Kay Maes',
            updatedAt: now,
          },
          {
            dossiernaam: 'Norrsken B.V.',
            contactpersoon: 'Ekdahl',
            beschrijving: 'Hele leuke klant, is de klant die ooit is gekomen via Hemwood en de baas heeft ooit Klarna opgericht maar enorme spijt en probeert iets goeds te doen voor de wereld. Scandinavisch bedrijf. Een ding goed om te weten, ze houden van snel schakelen. Alle medewerkers komen namelijk uit een corporate wereld. Ze zijn ook extreem aardig. Op dit moment staan er geen vragen open. Ze kunnen in de lucht komen voor aanpassing arbeidsovereenkomst of opstellen handboek ofzo. Alles staat in dossier.',
            waarnemers: 'Marlieke Schipper',
            updatedAt: now,
          },
          {
            dossiernaam: 'Cursussen',
            contactpersoon: 'Matthijs Schonewille',
            beschrijving: 'Inplannen cursussen 2026. Matthijs Schonewille komt dinsdag met de lunch. Marlieke weet ervan.',
            waarnemers: 'Marlieke Schipper',
            updatedAt: now,
          },
          {
            dossiernaam: 'Plug and Play',
            contactpersoon: null,
            beschrijving: 'Enig bedrijf, hebben hun hele remuneratiesysteem omgegooid en eerlijkheidshalve is het wel zo dat mensen er ook een beetje op achteruit lijken te gaan dus we zijn gegaan voor addendums en voor de mensen die niet tekenen doen we nog een piepsysteem. Ze weten van de risico\'s. Er is geen OR dus daar hoef je je geen zorgen over te maken.',
            waarnemers: 'Bas den Ridder, Marlieke Schipper',
            updatedAt: now,
          },
          {
            dossiernaam: 'Breatec B.V.',
            contactpersoon: 'Pie van Lith',
            beschrijving: 'Pie van Lith is contactpersoon, loopt nu niets maar gewoon voor het geval dat hij weer in de lucht komt.',
            waarnemers: 'Julia Groen',
            updatedAt: now,
          },
          {
            dossiernaam: 'CBRE OR',
            contactpersoon: null,
            beschrijving: 'OR, komen af en toe in de lucht. Geen openstaande vragen.',
            waarnemers: 'Marlieke Schipper',
            updatedAt: now,
          },
          {
            dossiernaam: 'Picnic',
            contactpersoon: null,
            beschrijving: 'Komen zelden door maar soms ineens wel.',
            waarnemers: 'Wies van Pesch',
            updatedAt: now,
          },
          {
            dossiernaam: 'Booking',
            contactpersoon: null,
            beschrijving: 'Spreekt voor zich.',
            waarnemers: 'Team Booking',
            updatedAt: now,
          },
          {
            dossiernaam: 'Hyfen',
            contactpersoon: 'Hidde Terpoorten',
            beschrijving: 'Hidde Terpoorten is CEO, aardige vent, is al een lange tijd niet met een zaak geweest maar dat kan nog wel gebeuren. Marlieke heeft eerder voor deze klant gewerkt. Nog even een aardig afscheidsbericht sturen.',
            waarnemers: 'Marlieke Schipper',
            updatedAt: now,
          },
          {
            dossiernaam: 'Employor',
            contactpersoon: null,
            beschrijving: 'Lieverds, payrollbedrijf. Zijn goed in 30% regelingen aanvragen voor klanten en die klanten doorsturen naar ons. Wij kunnen ook nieuwe klanten doorsturen naar hen. In principe breng ik kleine vraagjes niet in rekening (ze stellen dan ook een vraag die max 4 minuten denkwerk kost ofzo of we helpen met hun standaard template). Soms komen ze over de brug met een client van hen en dan gaan wij direct een relatie aan met die client, dat brengen we natuurlijk wel in rekening en die facturen sturen we ofwel via Employor ofwel rechtstreeks aan de client, allebei hebben we wel gedaan en hangt af van de afspraken.',
            waarnemers: 'Justine Schellekens',
            updatedAt: now,
          },
          {
            dossiernaam: 'Niels van Tamelen',
            contactpersoon: 'Niels van Tamelen',
            beschrijving: 'Is contact van Hemwood advocaten. Wij sturen dingen naar hem door voor vastgoed. Hij stuurt soms iets naar ons door. Hij kent Erika van het IDFA diner. Tot nu toe heeft hij zelf geen zaken maar Erika is contactpersoon als hij zijn eigen clienten nog aan ons wil doorsturen.',
            waarnemers: 'Erika van Zadelhof',
            updatedAt: now,
          },
        ],
      },
    },
  });
  console.log('Emma handover created:', emmaHandover.id, '- cases:', 24);

  await p.$disconnect();
}

main().catch(console.error);
