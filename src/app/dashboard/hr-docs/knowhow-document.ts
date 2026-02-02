import { Document } from './documents'

// Knowhow Officemanagement document
export const KNOWHOW_OFFICEMANAGEMENT: Document = {
  id: 'knowhow-officemanagement',
  title: 'Knowhow Officemanagement',
  description: 'Praktische handleidingen voor kantoorprocessen',
  icon: '📂',
  lastUpdated: '2024',
  chapters: [
    {
      id: 'contactgegevens',
      title: 'Contactgegevens',
      icon: '📞',
      content: `
        <h3>Belangrijkste telefoonnummers</h3>
        <div class="grid gap-3 mt-4">
          <div class="bg-white/5 rounded-lg p-3 flex justify-between items-center">
            <span class="text-white">Workx Advocaten (kantoor)</span>
            <span class="text-workx-lime font-mono">020 308 0320</span>
          </div>
          <div class="bg-white/5 rounded-lg p-3 flex justify-between items-center">
            <span class="text-white">BaseNet</span>
            <span class="text-workx-lime font-mono">020 685 5031</span>
          </div>
          <div class="bg-white/5 rounded-lg p-3 flex justify-between items-center">
            <span class="text-white">Constant IT</span>
            <span class="text-workx-lime font-mono">020 760 8700</span>
          </div>
          <div class="bg-white/5 rounded-lg p-3 flex justify-between items-center">
            <span class="text-white">De Bary</span>
            <span class="text-workx-lime font-mono">020 240 3000</span>
          </div>
          <div class="bg-white/5 rounded-lg p-3 flex justify-between items-center">
            <span class="text-white">Doxflow</span>
            <span class="text-workx-lime font-mono">020 331 7171</span>
          </div>
          <div class="bg-white/5 rounded-lg p-3 flex justify-between items-center">
            <span class="text-white">Fietskoerier</span>
            <span class="text-workx-lime font-mono">020 612 6700</span>
          </div>
          <div class="bg-white/5 rounded-lg p-3 flex justify-between items-center">
            <span class="text-white">Printer Canon (PCI-Groep)</span>
            <span class="text-workx-lime font-mono">088 543 08 08</span>
          </div>
        </div>

        <h3 class="mt-6">E-mailadressen</h3>
        <ul class="list-disc list-inside text-white/70 space-y-1 mt-2">
          <li>BaseNet: servicedesk@basenet.nl</li>
          <li>Constant IT: support@constant.it</li>
          <li>De Bary: info@debary.nl</li>
          <li>Doxflow: david@doxflow.nl / lennon@doxflow.nl</li>
          <li>Fietskoerier: spoed@fietskoerier.nl</li>
          <li>Graphic Design (Joeri): joeri@ttwwoo.nl</li>
        </ul>
      `,
    },
    {
      id: 'inloggegevens',
      title: 'Inloggegevens',
      icon: '🔐',
      content: `
        <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
          <p class="text-yellow-400 font-semibold">Let op: Vertrouwelijke gegevens</p>
          <p class="text-white/70 text-sm">Deel deze gegevens niet buiten het kantoor.</p>
        </div>

        <h3>Wifi</h3>
        <div class="bg-white/5 rounded-lg p-4 mb-4">
          <p class="text-white/70">Netwerk: <span class="text-white font-mono">4042</span></p>
          <p class="text-white/70">Wachtwoord: <span class="text-white font-mono">w0rkX@020</span></p>
        </div>

        <h3>Systemen</h3>
        <p class="text-white/70 mb-2">Vraag de actuele inloggegevens aan Hanna voor:</p>
        <ul class="list-disc list-inside text-white/70 space-y-1">
          <li>Trifact</li>
          <li>Exact</li>
          <li>KPN (klantnr: 20204524722)</li>
          <li>KVK</li>
          <li>Viking</li>
          <li>Albert Heijn</li>
          <li>Mailchimp</li>
          <li>Bol.com / Coolblue</li>
          <li>PCI-Groep printer portal</li>
        </ul>
      `,
    },
    {
      id: 'telefoon',
      title: 'Telefoon & Stroomschema',
      icon: '📱',
      content: `
        <p class="text-white/70 mb-4">Het is aan iedereen om de kantoortelefoon op te nemen en naar de ingang te lopen wanneer de bel gaat.</p>

        <h3>Nieuwe cliënt</h3>
        <p class="text-white/70 mb-4">Wanneer de telefoon gaat en het betreft een potentiële nieuwe cliënt, vraag dan naar:</p>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li>Naam</li>
          <li>Werkgever/Bedrijf</li>
          <li>Telefoonnummer waarop teruggebeld kan worden</li>
          <li>Korte schets van de situatie</li>
        </ul>

        <p class="text-white/70 mb-4">Geef aan dat diegene zo snel mogelijk wordt teruggebeld door een collega die gaat kijken in hoeverre Workx iets voor hem/haar kan betekenen.</p>

        <div class="bg-workx-lime/10 border border-workx-lime/20 rounded-lg p-4 mb-4">
          <p class="text-workx-lime font-semibold mb-2">In Slack</p>
          <p class="text-white/70">Geef bovenstaande gegevens door in het team voor potentiële nieuwe cliënten met het verzoek om teruggebeld te worden.</p>
        </div>

        <h3>Doorverwijzen</h3>
        <ul class="list-disc list-inside text-white/70 space-y-1">
          <li>Financieel niet toereikend → Juridisch Loket (0900-8020)</li>
          <li>Geen arbeidsrecht → Verwijs naar bevriende kantoren</li>
        </ul>

        <h3 class="mt-4">Bestaande cliënt</h3>
        <ol class="list-decimal list-inside text-white/70 space-y-2">
          <li>Vraag of diegene het mobiele telefoonnummer van de advocaat al heeft geprobeerd</li>
          <li>Zo niet: geef het mobiele nummer</li>
          <li>Wel geprobeerd maar niet bereikbaar: noteer naam en nummer, geef terugbelverzoek door via Slack</li>
        </ol>
      `,
    },
    {
      id: 'printlades',
      title: 'Printlades',
      icon: '🖨️',
      content: `
        <h3>Lade-indeling</h3>
        <div class="grid gap-2 mt-4">
          <div class="bg-white/5 rounded-lg p-3 flex items-center gap-4">
            <span class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">1</span>
            <span class="text-white/70">Normaal wit papier (standaard)</span>
          </div>
          <div class="bg-yellow-500/10 rounded-lg p-3 flex items-center gap-4">
            <span class="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">2</span>
            <span class="text-white/70">Gele productievellen</span>
          </div>
          <div class="bg-workx-lime/10 rounded-lg p-3 flex items-center gap-4">
            <span class="w-8 h-8 rounded-full bg-workx-lime/20 flex items-center justify-center text-workx-lime font-bold">3</span>
            <span class="text-white/70">Workx papier (processtukken etc)</span>
          </div>
          <div class="bg-blue-500/10 rounded-lg p-3 flex items-center gap-4">
            <span class="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">4</span>
            <span class="text-white/70">Briefpapier</span>
          </div>
        </div>

        <h3 class="mt-6">Printlade selecteren</h3>
        <p class="text-white/70 mb-2">Methode 1:</p>
        <p class="text-white/70 mb-4">Bestand → Afdrukken → Printereigenschappen → Papierbron → Selecteer de juiste printlade</p>

        <p class="text-white/70 mb-2">Methode 2 (als bovenstaande niet werkt):</p>
        <p class="text-white/70">Indeling (in horizontale balk) → Pagina-instelling (pijltje) → Papier → Papierinvoer wijzigen</p>

        <div class="bg-white/5 rounded-lg p-4 mt-4">
          <p class="text-white font-semibold mb-2">Printer info</p>
          <p class="text-white/70">Model: Canon iR-ADV C477</p>
          <p class="text-white/70">IP adres: 10.4.42.51</p>
          <p class="text-white/70">Serienummer: 28Q00700</p>
        </div>
      `,
    },
    {
      id: 'basenet',
      title: 'BaseNet Tips & Tricks',
      icon: '💻',
      content: `
        <h3>Koppelen aan relaties en projecten</h3>
        <p class="text-white/70 mb-4">Alles in BaseNet kan terug gevonden worden zolang het aan relaties of projecten gekoppeld wordt. Typ een deel van de naam in om te zoeken.</p>

        <h3>Inkomende e-mails opslaan</h3>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-2">
          <li>Open de mail</li>
          <li>Voer de relatie of het project in bovenaan de mail</li>
          <li>Druk op de blauwe knop "Bewaar"</li>
          <li>De mail verdwijnt uit je mailbox maar is opgeslagen in het dossier</li>
        </ol>

        <h3>Nieuwe relatie of project aanmaken</h3>
        <p class="text-white/70 mb-2">Klik op "+Nieuw" in het beginscherm en selecteer:</p>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li><strong>Bedrijf/Particulier/Contactpersoon</strong> - voor nieuwe relaties</li>
          <li><strong>Project (algemeen)</strong> - voor interne projecten, opslagplaats</li>
          <li><strong>Dossier</strong> - voor daadwerkelijke cliëntendossiers waar op gefactureerd wordt</li>
        </ul>

        <h3>Templates in e-mails</h3>
        <p class="text-white/70 mb-4">Klik op het template-icoontje aan de rechterkant van het scherm om beschikbare templates te zien.</p>

        <h3>Out of Office instellen</h3>
        <ol class="list-decimal list-inside text-white/70 space-y-2">
          <li>Open je mail</li>
          <li>Rechtermuisknop op je mailadres → "afwezigheid"</li>
          <li>Vul onderwerp in (vaak: out of office + naam)</li>
          <li>Geef periode aan</li>
          <li>Klik op "Bewaar en sluit"</li>
          <li><strong>Test dit altijd!</strong> Stuur een testmail naar jezelf.</li>
        </ol>

        <h3 class="mt-4">Mail naar heel team Workx</h3>
        <p class="text-white/70">Zoek "Team Workx" in de ontvangers. Vergeet niet te selecteren en te sluiten!</p>
      `,
    },
    {
      id: 'facturatie',
      title: 'Facturatie',
      icon: '💶',
      content: `
        <h3>Declaratievoorstellen downloaden</h3>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-2">
          <li>Ga naar Advocatuur → Dossierfacturatie</li>
          <li>Typ je naam in bij "Behandelend advocaat"</li>
          <li>Vul de datum in tot wanneer je wilt declareren</li>
          <li>Druk op het zoekteken</li>
          <li>Selecteer alle dossiers (vakje links bovenin)</li>
          <li>Druk op het printteken → "Declaratievoorstel Workx Advocaten"</li>
        </ol>

        <div class="bg-white/5 rounded-lg p-4 mb-6">
          <p class="text-white font-semibold mb-2">Opmerkingen bij declaratievoorstel:</p>
          <p class="text-white/70"><strong>F</strong> = factureren</p>
          <p class="text-white/70"><strong>A</strong> = afboeken</p>
          <p class="text-white/70"><strong>D</strong> = doorschuiven</p>
        </div>

        <h3>Fixed Price</h3>
        <p class="text-white/70 mb-2">Open het dossier → Financieel → Financiële afspraken → Financieel algemeen</p>
        <p class="text-white/70 mb-4">Vul bij "Fixed price" het bedrag exclusief BTW in. Bij tweede fixed price: verhoog het bestaande bedrag.</p>

        <h3>Uurtarieven</h3>
        <p class="text-white/70 mb-2">Standaard uurtarieven per ervaringsjaar:</p>
        <ul class="list-disc list-inside text-white/70 space-y-1">
          <li>Partners: € 350</li>
          <li>Juridisch medewerker: € 150</li>
          <li>1e-2e jaars: € 200-225</li>
          <li>3e-5e jaars: € 230-275</li>
          <li>6e-9e jaars: € 275-320</li>
        </ul>

        <h3 class="mt-4">Factuur aanmaken</h3>
        <ol class="list-decimal list-inside text-white/70 space-y-2">
          <li>Ga naar Advocatuur → Dossierfacturatie</li>
          <li>Zoek het dossier</li>
          <li>Selecteer en klik op "Maken/Bijwerken van factuur"</li>
          <li>Klik op "Open factuur" om aan te passen</li>
          <li>Check alles: factuurrelatie, adres, urenspecificatie</li>
          <li>Drie streepjes → Voorbeeld Email → Verstuur</li>
          <li>Drie streepjes → Verwerk en print (= DEFINITIEF!)</li>
        </ol>
      `,
    },
    {
      id: 'trifact',
      title: 'Trifact',
      icon: '📄',
      content: `
        <p class="text-white/70 mb-4">Trifact wordt gebruikt om ontvangen facturen te verwerken.</p>

        <h3>Inloggen</h3>
        <p class="text-white/70 mb-4">Ga naar <a href="https://www.trifact365.com" target="_blank" class="text-workx-lime hover:underline">trifact365.com</a> en log in (vraag gegevens aan Hanna).</p>

        <h3>Facturen uploaden</h3>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-2">
          <li>Klik op "Uploaden"</li>
          <li>Selecteer administratie "Workx Advocaten"</li>
          <li>Selecteer documenttype (meestal inkoopfactuur)</li>
          <li>Geef aan of het 1 factuur is of meerdere</li>
          <li>Selecteer bestanden en klik op "Afronden"</li>
        </ol>

        <h3>Facturen verwerken</h3>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-2">
          <li>Ga naar "Controleren"</li>
          <li>Klik op een factuur</li>
          <li>Controleer: leverancier, factuurnummer, datum, grootboekrekening, bedrag, BTW</li>
          <li>Klik op "Verzenden" als alles klopt</li>
        </ol>

        <h3>Nieuwe leverancier</h3>
        <p class="text-white/70">Als Trifact een leverancier niet herkent: maak deze eerst aan in Exact, dan in Trifact op "Stamgegevens bijwerken" klikken.</p>
      `,
    },
    {
      id: 'exact',
      title: 'Exact',
      icon: '📊',
      content: `
        <p class="text-white/70 mb-4">Exact is de omgeving waar alle onderdelen van de administratie liggen opgeslagen.</p>

        <h3>Inloggen</h3>
        <p class="text-white/70 mb-4">Ga naar <a href="https://start.exactonline.nl" target="_blank" class="text-workx-lime hover:underline">start.exactonline.nl</a> (vraag gegevens aan Hanna). Soms is een verificatiecode nodig - vraag deze aan Hanna.</p>

        <h3>Leverancier aanmaken</h3>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-2">
          <li>Ga naar Relaties → Leveranciers → Aanmaken</li>
          <li>Zoek via "Zoek een bedrijf op basis van naam en adres"</li>
          <li>Of klik op "Handmatig" en voer gegevens in (naam, adres, postcode)</li>
          <li>Opslaan</li>
        </ol>

        <h3>Afletteren</h3>
        <p class="text-white/70 mb-4">Afletteren = betalingen koppelen aan facturen. Ga naar Financieel → Bank en kas → Afschriften → Af te handelen.</p>
        <ul class="list-disc list-inside text-white/70 space-y-1">
          <li><span class="text-red-400">Rood bolletje</span> = klaar om af te letteren</li>
          <li><span class="text-orange-400">Oranje bolletje</span> = actie vereist (factuur niet gevonden of meerdere opties)</li>
        </ul>
      `,
    },
    {
      id: 'doxflow',
      title: 'Doxflow',
      icon: '📁',
      content: `
        <p class="text-white/70 mb-4">Doxflow wordt gebruikt voor het voorbereiden van processtukken. Inloggen via: <span class="text-workx-lime font-mono">http://10.4.42.80/login</span></p>

        <h3>Nieuwe zaak aanmaken</h3>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-2">
          <li>Klik op "+ nieuwe zaak aanmaken"</li>
          <li>Typ de dossiernaam in</li>
          <li>Selecteer je naam bij "Procesadvocaat"</li>
          <li>Selecteer "Arbeidsrecht" bij groep</li>
          <li>Klik op "Opslaan"</li>
        </ol>

        <h3>Bestanden toevoegen</h3>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li>Klik op "+ Bestanden Toevoegen"</li>
          <li>Kies vanuit BaseNet of je computer</li>
          <li>Sleep documenten om volgorde te wijzigen</li>
          <li>Rechtermuisknop op pagina om te verwijderen/omdraaien</li>
        </ul>

        <h3>Tabbladen toevoegen</h3>
        <p class="text-white/70 mb-4">Klik bovenin op "Tabbladen" om alle tabbladen in één keer toe te voegen. De titel van producties kan je aanpassen in de balk boven elke productie.</p>

        <h3>Processtuk benoemen</h3>
        <p class="text-white/70 mb-4">Upload het verzoekschrift/verweerschrift → Klik op drie puntjes → "Benoem als processtuk". Het document komt automatisch bovenaan met de letter P.</p>

        <h3>Scannen/Downloaden</h3>
        <p class="text-white/70">Opslaan → Als PDF. Het hele stuk wordt in één keer gedownload.</p>

        <h3 class="mt-4">Printen</h3>
        <p class="text-white/70">Klik op "Afdrukken" → Check dat het naar Canon iR-ADV C477 gaat → Afdrukken. De printer weet zelf welke lades te gebruiken!</p>
      `,
    },
    {
      id: 'processtuk-indienen',
      title: 'Processtuk indienen',
      icon: '⚖️',
      content: `
        <h3>Stappen voor indienen</h3>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-2">
          <li>Print het processtuk via Doxflow (overleg met advocaat over aantal exemplaren)</li>
          <li>Zorg voor plastic bladen aan voor- en achterkant</li>
          <li>Maak gaatjes met de grote perforator (in kleine delen)</li>
          <li>Bind in met jalema clip</li>
          <li>Voeg tabjes toe aan productiebladen (gele plastic index tabjes met zwarte sharpie)</li>
          <li>Laat procesinleiding ondertekenen door de advocaat</li>
          <li>Doe in bruine enveloppe met begeleidende brief</li>
        </ol>

        <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
          <p class="text-yellow-400 font-semibold mb-2">Let op bij brieven!</p>
          <ul class="list-disc list-inside text-white/70 space-y-1">
            <li>Stukken naar wederpartij = brief wederpartij + brief rechtbank bijvoegen</li>
            <li>Stukken naar rechtbank = alleen brief rechtbank</li>
          </ul>
        </div>

        <h3>Koerier regelen</h3>
        <p class="text-white/70 mb-2">Mail naar: <span class="text-workx-lime">spoed@fietskoerier.nl</span></p>
        <div class="bg-white/5 rounded-lg p-4">
          <p class="text-white/70 italic">"Hi, Is het mogelijk om [datum] [x aantal] stukken bij ons op te halen op Herengracht 448, 1017 CA Amsterdam en deze voor [aflevertijd] af te leveren bij [adres] inclusief ontvangstbevestiging?"</p>
        </div>

        <p class="text-white/70 mt-4">Sla de ontvangstbevestiging op in het dossier!</p>
      `,
    },
    {
      id: 'onboarding',
      title: 'Onboarding werknemer',
      icon: '👋',
      content: `
        <h3>Checklist nieuwe medewerker</h3>
        <div class="space-y-2 mt-4">
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Laptop bestellen bij Constant IT</p>
              <p class="text-white/50 text-sm">support@constant.it of 020 760 8700</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Account aanmaken in systemen</p>
              <p class="text-white/50 text-sm">Email, Office, Slack, Teams, Basenet</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Telefoon aanvragen bij KPN</p>
              <p class="text-white/50 text-sm">Klantnummer: 20204524722</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Foto inplannen</p>
              <p class="text-white/50 text-sm">Bram: bramwillems@gmail.com</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Kaartje voor LinkedIn laten maken</p>
              <p class="text-white/50 text-sm">Joeri: joeri@ttwwoo.nl / 0652540083</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Melden bij Advocatie.nl</p>
              <p class="text-white/50 text-sm">redactie@advocatie.nl</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Aanmaken in Basenet</p>
              <p class="text-white/50 text-sm">Incl. uurtarief en kostenplaats</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Aanmelden verzekeringen</p>
              <p class="text-white/50 text-sm">Diks (beroepsaansprakelijkheid), A.S.R., Bright Pensioen</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Toegangsbadge en sleutel</p>
              <p class="text-white/50 text-sm">Badge: beheer@obidos.nl / Sleutel: Luk's Schoenmakerij</p>
            </div>
          </div>
        </div>
      `,
    },
    {
      id: 'offboarding',
      title: 'Offboarding werknemer',
      icon: '👋',
      content: `
        <h3>Checklist vertrekkende medewerker</h3>
        <div class="space-y-2 mt-4">
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Laptop regelen</p>
              <p class="text-white/50 text-sm">Privé gebruiken of account verwijderen via Constant IT</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Out of office instellen</p>
              <p class="text-white/50 text-sm">"Vanaf [datum] niet meer werkzaam bij Workx"</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Dossiers overdragen</p>
              <p class="text-white/50 text-sm">Overdrachtslijst maken, behandelend advocaat aanpassen in Basenet</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Openstaande facturen</p>
              <p class="text-white/50 text-sm">Reminders versturen voor verantwoordelijke dossiers</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Sleutel en tag inleveren</p>
            </div>
          </div>
          <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
            <input type="checkbox" disabled class="mt-1" />
            <div>
              <p class="text-white font-medium">Van website afhalen + afscheidsbericht LinkedIn</p>
            </div>
          </div>
        </div>
      `,
    },
    {
      id: 'seminar',
      title: 'Organiseren Seminar',
      icon: '🎤',
      content: `
        <h3>Voorbereidingen</h3>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-2">
          <li>Datum prikken en afstemmen met De Bary (info@debary.nl)</li>
          <li>Onderwerp en tekst uitnodiging opstellen</li>
          <li>Vormgever Joeri vragen om ontwerp in Mailchimp (joeri@ttwwoo.nl / 0652540083)</li>
          <li>Presentatie maken en eventueel oefenen</li>
          <li>Uitnodiging via Mailchimp versturen</li>
        </ol>

        <h3>Aan team vragen</h3>
        <ul class="list-disc list-inside text-white/70 mb-6 space-y-1">
          <li>Bepaalde klanten gericht uitnodigen</li>
          <li>Aangemelde klanten persoonlijk berichtje sturen</li>
        </ul>

        <h3>Naamtags</h3>
        <p class="text-white/70">Maak naamtags met naam en bedrijf. Op kantoor liggen plastic naamtags.</p>
      `,
    },
    {
      id: 'inhousesessies',
      title: 'In-house sessies',
      icon: '📚',
      content: `
        <h3>Voorbereidingen</h3>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-2">
          <li>Datum afstemmen met docent</li>
          <li>Zaal huren bij De Bary (Rode of Groene kamer)</li>
          <li>Certificaten voorbereiden voor alle deelnemers</li>
          <li>Check of docent PowerPoint heeft en of opname mag</li>
          <li>Plan Teams meeting in voor opname</li>
        </ol>

        <h3>Dag van de sessie</h3>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li>TV in de zaal (verzorgd door De Bary)</li>
          <li>Laptop gekoppeld aan TV voor presentatie + Teams</li>
          <li>Tweede laptop voor opname (camera uit, geluid aan)</li>
          <li>Vergeet de opname niet te stoppen en op te slaan!</li>
        </ul>

        <h3>Na de sessie</h3>
        <ul class="list-disc list-inside text-white/70 space-y-1">
          <li>Certificaten laten ondertekenen door docent</li>
          <li>Certificaat voor lesgeven aan docent geven</li>
          <li>Wie er niet bij was: opname terugkijken + 3 meerkeuzevragen beantwoorden</li>
        </ul>
      `,
    },
    {
      id: 'website',
      title: 'Website beheer',
      icon: '🌐',
      content: `
        <h3>Artikel plaatsen</h3>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-2">
          <li>Kopieer tekst uit Word naar Kladblok (verwijdert opmaak)</li>
          <li>Ga naar <span class="text-workx-lime">workxadvocaten.nl/admin</span></li>
          <li>Log in (vraag gegevens aan Hanna)</li>
          <li>Klik op "Berichten" → "Nieuw bericht toevoegen"</li>
          <li>Voeg titel en tekst toe vanuit Kladblok</li>
          <li>Pas opmaak handmatig aan (tussenkopjes: koptekst 4)</li>
          <li>Voeg links toe en onderstreep ze (ctrl+u)</li>
        </ol>

        <h3>Afbeelding toevoegen</h3>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-2">
          <li>Zoek afbeelding op <a href="https://unsplash.com" target="_blank" class="text-workx-lime hover:underline">Unsplash</a></li>
          <li>Download en upload bij "Uitgelichte afbeelding"</li>
          <li>Vul alt-tekst in met titel/trefwoorden</li>
        </ol>

        <h3>SEO (Yoast)</h3>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li>Slug: onderwerp van het artikel</li>
          <li>Metabeschrijving: max 75 woorden (mag via ChatGPT)</li>
          <li>Check leesbaarheid - geen rood bolletje</li>
        </ul>

        <h3>Publiceren</h3>
        <ol class="list-decimal list-inside text-white/70 space-y-2">
          <li>Klik op "Voorbeeld bekijken" → stuur link naar advocaat</li>
          <li>Na goedkeuring: klik op "Publiceren"</li>
          <li>Deel op LinkedIn en vraag collega's te liken/delen</li>
        </ol>
      `,
    },
  ],
}
