'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

// Document types
interface Chapter {
  id: string
  title: string
  icon: string
  content: string
  subsections?: { id: string; title: string }[]
}

interface Document {
  id: string
  title: string
  description: string
  icon: string
  chapters: Chapter[]
  lastUpdated?: string
}

// The Way it Workx document - full content from PDF
const THE_WAY_IT_WORKX: Document = {
  id: 'the-way-it-workx',
  title: 'The Way it Workx',
  description: 'Het personeelshandboek van Workx Advocaten',
  icon: '📘',
  lastUpdated: '2024',
  chapters: [
    {
      id: 'welkom',
      title: 'Welkom bij Workx',
      icon: '👋',
      content: `
        <p class="text-white/70 mb-6">Vanaf vandaag ben je onderdeel van Team Workx, welkom!</p>
        <p class="text-white/70 mb-4">Workx is een energiek en bevlogen advocatenkantoor. Wij zijn gespecialiseerd in het mooiste vakgebied; arbeidsrecht. Onze klanten zijn voornamelijk werkgevers, maar wij vertegenwoordigen en adviseren ook ondernemingsraden, (statutair) bestuurders en werknemers. Wij zijn een modern kantoor, waar we graag op een informele en betrokken manier met elkaar samenwerken.</p>
        <p class="text-white/70">Advocaten houden van regels. Maar regels kunnen in de praktijk ook tot bureaucratie en inflexibiliteit leiden. Dat willen wij niet. Dit document is daarom vooral bedoeld als hulpmiddel. Lees het rustig door en laat het ons vooral weten als je vragen hebt.</p>
      `,
    },
    {
      id: 'start',
      title: 'Start',
      icon: '🚀',
      content: `
        <h3>1.1 Start</h3>
        <p class="text-white/70 mb-4">Je krijgt van ons een laptop en telefoon ter beschikking. Onze IT ondersteuning zal er voor zorgen dat de laptop is geïnstalleerd, je beschikt over een 365 Office licentie en toegang hebt tot Basenet. Je krijgt een eigen Workx e-mailadres en alle dingen die je nodig hebt om je werk te kunnen doen. Als er iets ontbreekt aan advocaatgereedschap laat het ons dan weten, dan denken wij met je mee wat er moet worden aangevuld of wat vernieuwing nodig heeft.</p>
        <p class="text-white/70 mb-6">Wij zorgen er voor dat je wegwijs wordt gemaakt in onze systemen en werkwijze.</p>

        <h3>1.2 Werkdag</h3>
        <p class="text-white/70 mb-4">Als referentiekader gelden kantoortijden van 9.00 tot 17.30 uur, maar je mag zelf weten hoe laat je de werkdag wilt starten en beëindigen. We verwachten alleen wel dat je ergens voor 10.00 uur start en er rekening wordt gehouden met bereikbaarheid voor klanten. Dus als je in de ochtend een keer wilt sporten dan houden wij je zeker niet tegen. Dan werk je in de avond gewoon wat langer door. En andersom kan natuurlijk ook. Als je een ochtendmens bent dan kun je ook vroeger starten en eerder naar huis.</p>
        <p class="text-white/70">We vinden het prettig te weten waar je bent tijdens werktijd. Als je bijvoorbeeld later op kantoor bent of naar de dokter moet; laat even een berichtje achter in de Workx appgroep of Slack, of bij één van de partners in een situatie dat je de reden niet met iedereen wilt delen.</p>
      `,
    },
    {
      id: 'lunch',
      title: 'Lunch',
      icon: '🍽️',
      content: `
        <h3>2.1 Lunch en fruit</h3>
        <p class="text-white/70">Wij regelen iedere dag een lekkere lunch rond 12.00 uur. Hiervoor hoef je niet te betalen. Dat geldt ook voor fruit. Iedere week wordt een krat met vers fruit bezorgd, boordevol vitaminen voor een gezond leven.</p>
      `,
    },
    {
      id: 'werkplek',
      title: 'Werkplek',
      icon: '💼',
      content: `
        <h3>3.1 Kantoor</h3>
        <p class="text-white/70 mb-4">Wij zijn trots op ons kantoor in hartje Amsterdam aan de Herengracht. De Bary, tuin en ruimtes zijn een prettige plek om te zijn. Ons uitgangspunt is dat iedereen graag op kantoor komt werken en minimaal twee keer per week op kantoor is.</p>
        <p class="text-white/70 mb-4">Tegelijkertijd vinden wij het ook belangrijk dat je de vrijheid voelt om zelf een keuze te maken en je werkplek kunt afwisselen. Dat kan thuis, in het park, bibliotheek of museum zijn; waar jij het prettig vindt. Zolang je maar op een plek zit waar je je werk goed kunt doen.</p>
        <p class="text-white/70 mb-4">Wij geloven dat het gezond is ook op kantoor af en toe van werkplek te veranderen; voor geest en de band met het hele Team. Daarom werken we met flexibele werkplekken.</p>
        <p class="text-white/70 mb-4">Als je van plan bent op kantoor te werken, vul dat dan van tevoren in via de app: <strong>Appjeplekje</strong>. Als alle werkplekken bezet zijn en je toch naar kantoor wilt komen, dan kun je altijd ruilen met een collega.</p>
        <p class="text-white/70 mb-6">Degene die aan het einde van de werkdag als laatste vertrekt (zowel beneden als boven):</p>
        <ul class="list-disc list-inside text-white/70 mb-6 space-y-1">
          <li>controleert of alle ramen dicht zijn</li>
          <li>doet de lichten uit</li>
          <li>zet de afwasmachine aan</li>
          <li>sluit kantoor af</li>
          <li>stuurt een berichtje in Slack om te laten weten dat beneden of boven niemand meer aanwezig is</li>
        </ul>

        <h3>3.2 Clean-Desk</h3>
        <p class="text-white/70 mb-4">Zorg dat je werkplek aan het einde van de dag is opgeruimd, zodat de volgende dag een collega op die plek kan werken.</p>
        <p class="text-white/70 mb-6">In de printerruimte heeft iedereen een postvak. Controleer regelmatig of er post voor je is en help de verloren printjes in de postvakken te doen. Eén keer per week komen de schoonmakers. We waarderen het als iedereen helpt om kantoor netjes te houden.</p>

        <h3>3.3 Workxation</h3>
        <p class="text-white/70 mb-4">We bieden graag de mogelijkheid voor een Workxation: werken op een andere locatie in binnen- of buitenland. We vinden het alleen wel belangrijk dat er een duidelijk scheiding blijft tussen werk en vakantie en verbinding blijft met collega's. Daarom zijn hier wat meer voorwaarden aan verbonden:</p>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li>Een Workxation duurt maximaal 3 weken per jaar</li>
          <li>De tijdszone verschilt niet van Nederland</li>
          <li>Je bent de gebruikelijke uren bereikbaar en aan het werk</li>
          <li>Je hebt in die periode geen zittingen of zaken waarvoor aanwezigheid in Nederland nodig is</li>
        </ul>
        <p class="text-white/70">Laat het ons weten als je een Workxation overweegt dan bespreken we samen de mogelijkheden.</p>
      `,
    },
    {
      id: 'team',
      title: 'Team',
      icon: '🤝',
      content: `
        <h3>4.1 We are Workx</h3>
        <p class="text-white/70 mb-6">Het beroep van advocaat is vaak solistisch. Wij willen dat anders doen. We zijn er voor elkaar, door dik en dun. We willen zorgen voor een goede en veilige werkomgeving waar iedereen op een prettige en duurzame manier kan werken. Als je ergens tegen aan loopt, blijf er dan niet mee zitten. Je kan altijd bij de partners, preventiemedewerker of vertrouwenspersoon terecht.</p>

        <h3>4.2 Overleg</h3>
        <p class="text-white/70 mb-4">Iedere dinsdagochtend hebben we een teammeeting. Voor de teammeeting wordt een voorzitter aangewezen, die twee keer het werkoverleg zal leiden en zal vragen of een collega notuleert. De notulen bestaan uit een actielijst.</p>
        <p class="text-white/70 mb-4">De agenda ziet er op hoofdlijnen als volgt uit:</p>
        <ol class="list-decimal list-inside text-white/70 mb-6 space-y-1">
          <li>Actielijst vorige keer</li>
          <li>Terugkoppeling partneroverleg maandag</li>
          <li>Mededelingen Hanna</li>
          <li>Nieuw ingebrachte onderwerpen</li>
        </ol>

        <h3>4.3 Mentor</h3>
        <p class="text-white/70">Als medewerker van Workx heb je een mentor. Een mentor is één van de partners bij wie je terecht kunt en die een vinger aan de pols houdt. Voel je ook vrij om na verloop van tijd een andere mentor te kiezen. Het is de bedoeling om regelmatig af te spreken met de mentor, bijvoorbeeld door eens per maand een kop koffie te drinken of een rondje te lopen. Voel je vrij om alles tegen je mentor te zeggen, ook de dingen die je minder leuk vindt. Workx vindt een open sfeer, waar iedereen zich op zijn gemak voelt, ontzettend belangrijk!</p>
      `,
    },
    {
      id: 'ontwikkelen',
      title: 'Ontwikkelen',
      icon: '📚',
      content: `
        <h3>5.1 Coach</h3>
        <p class="text-white/70 mb-6">Iedereen krijgt de mogelijkheid zich verder te ontwikkelen door gebruik te maken van een eigen externe coach. Hiervoor wordt in ieder geval per periode van drie jaar een budget van <strong>€ 1.500 ex btw</strong> beschikbaar gesteld. Voor coaching tijdens werktijd kun je in totaal 2 vrije dagen krijgen gedurende de periode van drie jaar, om te stimuleren dat je hier ook daadwerkelijk gebruik van maakt.</p>

        <h3>5.2 Plan</h3>
        <p class="text-white/70 mb-6">Voor iedere medewerker zal een persoonlijk ontwikkelplan worden opgesteld. We vinden het belangrijk dat iedereen op verschillende manieren kan groeien. Workx hanteert het adagium; stilstaan is achteruitgang. Het ontwikkelplan is onder andere bedoeld als ondersteuning op het gebied van inhoudelijke kennis, ervaring en ondernemerschap.</p>

        <h3>5.3 Opleiding</h3>
        <p class="text-white/70 mb-4">We zorgen ervoor dat je meerdere cursussen per jaar kunt volgen op kantoor. Hiervoor worden externe sprekers uitgenodigd. Probeer daar zoveel mogelijk bij aanwezig te zijn. Je kunt ook zeker een voorstel indienen voor een onderwerp of docent. Naast de interne cursussen bestaat de mogelijkheid om externe opleidingen te volgen om de benodigde PO-punten te behalen.</p>
        <p class="text-white/70 mb-4">Eén keer in de drie weken bespreken we op kantoor de Jurisprudentie Arbeidsrecht (JAR), doorgaans op donderdag van 16.00 - 17.15 uur. We bereiden dit om de beurt voor. Probeer hier ook zo veel mogelijk bij aanwezig te zijn.</p>
        <p class="text-white/70 mb-6">Voor de beroepsopleiding krijgt een advocaat-stagiair één studiedag voor een tentamen van Workx.</p>

        <h3>5.4 Intervisie</h3>
        <p class="text-white/70">Intervisie is onderdeel van de verplichte jaarlijkse PO-punten. Uiteraard kun je altijd bij ons terecht met je vragen en dilemma's. Tegelijkertijd leert de ervaring dat je sommige zaken liever met anderen bespreekt en een blik buiten Workx ook verfrissend kan werken. We stimuleren je dan ook om je bij een leuke intervisiegroep aan te sluiten.</p>
      `,
    },
    {
      id: 'veilig-werken',
      title: 'Veilig Werken',
      icon: '🛡️',
      content: `
        <h3>6.1 Arbeidsbelasting</h3>
        <p class="text-white/70 mb-4">In ons werk als advocaat kan het voorkomen dat je druk ervaart. Het is belangrijk om tijdig te laten weten als de druk te veel oploopt. Bespreek in dat geval met één van de partners, de preventiemedewerker of de vertrouwenspersoon de situatie zodat we een oplossing kunnen vinden. Onthoud ook: het is geen teken van zwakte om hulp te vragen.</p>
        <p class="text-white/70 mb-6">Daarnaast hebben we iedere week gesprekken over de werkverdeling en kun je via Slack aangeven hoe druk je bent.</p>

        <h3>6.2 Preventiemedewerker</h3>
        <p class="text-white/70 mb-6">De preventiemedewerker van Workx is onze officemanager (<strong>Hanna</strong>). De taken van de preventiemedewerker bestaan uit het onderhouden van contact met externe diensten, zoals met de arbodienst (op dit moment ArboDuo) of de Arbeidsinspectie. De preventiemedewerker zorgt onder andere voor het implementeren van het arbeidsomstandighedenbeleid, het opvolgen van de RI&E en BHV coördinatie.</p>

        <h3>6.3 Verzuimprotocol</h3>
        <p class="text-white/70 mb-4">Bij ziekte: bel één van de partners of meld je via de app of Slack. Bij de ziekmelding benoem je het volgende:</p>
        <ol class="list-decimal list-inside text-white/70 mb-4 space-y-1">
          <li>dat je wegens ziekte niet in staat bent om te werken</li>
          <li>wat de verwachte duur van het verzuim zal zijn</li>
          <li>wat Workx kan doen om te helpen</li>
          <li>op welk adres en telefoonnummer je te bereiken bent</li>
          <li>welke werkzaamheden nog wel uitgevoerd kunnen worden</li>
        </ol>
        <p class="text-white/70 mb-6">Blijf bereikbaar voor contact met Workx en de arbodienst. We zijn er voor elkaar en vinden het belangrijk dat je deel blijft uitmaken van Workx. Daarom houden we graag vaak contact met je.</p>

        <h3>6.6 Vertrouwenspersoon</h3>
        <p class="text-white/70 mb-4">Mocht je iets kwijt willen aan onze interne vertrouwenspersoon, dan kan je altijd bij <strong>Marlieke</strong> terecht.</p>
        <p class="text-white/70 mb-2">Voor de externe vertrouwenspersoon kunnen jullie terecht bij:</p>
        <ul class="list-disc list-inside text-white/70 mb-6 space-y-1">
          <li>Marcel Boshuizen of Sjakkelien Marlet</li>
          <li>Tel: 085 065 92 70</li>
          <li>Email: mboshuizen@uwvertrouwenspersoon.nl / smarlet@uwvertrouwenspersoon.nl</li>
        </ul>

        <h3>6.8 Eén van allen, allen voor één</h3>
        <p class="text-white/70 mb-6">Het spreekt voor zich maar we willen het toch benoemen. Pesten, ongewenst gedrag en agressie (oftewel: grensoverschrijdend gedrag) is op geen enkele manier toegestaan. Meldingen hiervan kunnen altijd gedaan worden bij de preventiemedewerker, één van de partners, interne of externe vertrouwenspersoon.</p>

        <h3>6.10 Bedrijfshulpverlening (BHV)</h3>
        <p class="text-white/70 mb-6">De BHV'ers van ons kantoor zijn <strong>Marnix</strong>, <strong>Justine</strong> en <strong>Hanna</strong>. Zij hebben een BHV cursus gedaan en hun certificaat behaald.</p>

        <h3>6.14 Fit Workx</h3>
        <p class="text-white/70">Sporten is gezond! Twee tot drie keer in de week een uur sporten/bewegen (kan ook wandelen zijn) is optimaal. De Workx wandelingen na de lunch zijn hier perfect voor.</p>
      `,
    },
    {
      id: 'vrije-dagen',
      title: 'Vrije Dagen',
      icon: '🏖️',
      content: `
        <h3>7.1 Vakantieplannen</h3>
        <p class="text-white/70 mb-4">"Geef me werk dat bij me past en ik hoef nooit meer te werken", aldus de filosoof Confucius. Toch kunnen we ons voorstellen dat je af en toe op vakantie wilt gaan. Stem je vakantieplannen tijdig af met Jochem. We willen voorkomen dat iedereen tegelijk op vakantie gaat.</p>
        <p class="text-white/70 mb-6">Een losse vrije dag kun je wat ons betreft ook op het laatste moment aanvragen. We vertrouwen er volledig op dat je zelf het beste de inschatting kunt maken dat het geen problemen met werk of collega's oplevert. Voor een bezoek aan de tandarts of dokter hoef je geen vrije dag op te nemen.</p>

        <h3>7.2 Bijkopen</h3>
        <p class="text-white/70 mb-6">Als je toe bent aan meer vakantie dan kun je per kalenderjaar maximaal <strong>5 vakantiedagen</strong> (op basis van fulltime) bijkopen. Dit wordt dan verrekend met je salaris.</p>

        <h3>7.3 Feestdagen</h3>
        <p class="text-white/70 mb-4">Hoe graag je ook naar kantoor komt, we zijn helaas gesloten op de volgende dagen:</p>
        <ul class="list-disc list-inside text-white/70 mb-6 space-y-1">
          <li>Nieuwjaarsdag</li>
          <li>Pasen (eerste en tweede paasdag)</li>
          <li>Koningsdag</li>
          <li>Eens in de 5 jaar op Bevrijdingsdag</li>
          <li>Hemelvaartsdag</li>
          <li>Pinksteren (eerste en tweede pinksterdag)</li>
          <li>Kerstmis (eerste en tweede kerstdag)</li>
        </ul>
        <p class="text-white/70 mb-6">Als je parttime werkt en er een onevenredig aantal feestdagen op jouw vaste parttime dag valt, dan compenseren wij je voor het verschil ten opzichte van een collega die fulltime werkt.</p>

        <h3>7.4 Verhuizen</h3>
        <p class="text-white/70 mb-6">Als je gaat verhuizen krijg je een vrije dag van Workx (eens per 3 jaar).</p>

        <h3>7.5 Trouwen</h3>
        <p class="text-white/70">Als je gaat trouwen, krijg je ook een vrije dag van Workx.</p>
      `,
    },
    {
      id: 'waarneming',
      title: 'Waarneming',
      icon: '🔄',
      content: `
        <h3>8.1 Afspraken waarneming</h3>
        <p class="text-white/70 mb-4">Tijdens afwezigheid krijgt een waarnemer allerlei extra zaken bovenop de eigen praktijk. Het zijn ook meestal lopende zaken, waardoor het overnemen meer moeite kost dan het werken op een "eigen zaak". Uitgangspunt is daarom dat bij kort verlof (minder dan 1 week) zoveel als mogelijk met de klant wordt afgesproken dat de zaak tijdens dit korte verlof stil ligt.</p>
        <p class="text-white/70 mb-4">Indien waarneming nodig is, moet de waarnemer zo goed mogelijk worden geholpen om de belasting van het waarnemen zo veel als mogelijk te beperken. Hiervoor gelden de volgende kaders:</p>

        <h4 class="text-white font-semibold mt-4 mb-2">1. Waarnemer-teams</h4>
        <p class="text-white/70 mb-4">We proberen de belasting van het waarnemen zoveel mogelijk te spreiden door te werken met waarnemer-teams. Lopende zaken worden overgedragen aan collega's A&B. Collega's C&D komen in de out of office te staan.</p>

        <h4 class="text-white font-semibold mt-4 mb-2">2. Out of office</h4>
        <p class="text-white/70 mb-4">In de out of office komt duidelijk te staan welke datum de afwezige weer op kantoor is en dat de gezonden email gedurende zijn/haar afwezigheid niet zal worden gelezen of worden doorgestuurd.</p>

        <h4 class="text-white font-semibold mt-4 mb-2">3. Dossiers op orde</h4>
        <p class="text-white/70 mb-2">De afwezige zorgt ervoor dat het dossiers volledig op orde is:</p>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li>Zorg ervoor dat alle relaties goed zijn opgeslagen in Basenet</li>
          <li>Zorg ervoor dat alle stukken goed in Basenet staan. Bijlagen apart opslaan</li>
          <li>Zorg ervoor dat de belangrijkste e-mails/documenten goed te vinden zijn</li>
        </ul>

        <h4 class="text-white font-semibold mt-4 mb-2">5. Overdrachtsdocument</h4>
        <p class="text-white/70">Gebruik ons standaard overdrachtsdocument (zie bijlage) en vul dit document zo compleet mogelijk in. Neem daarna de tijd om het document nader toe te lichten aan de waarnemer.</p>
      `,
    },
    {
      id: 'beloning',
      title: 'Beloning',
      icon: '💰',
      content: `
        <h3>9.1 Salaris</h3>
        <p class="text-white/70 mb-6">We maken tussen de 25ste en de laatste dag van de maand je salaris over. Je salarisstrook wordt digitaal toegezonden.</p>

        <h3>9.2 Bonusregeling eigen omzet</h3>
        <p class="text-white/70 mb-4">Voor de bonusregeling over de eigen omzet verwijzen we naar de afspraken in je arbeidsovereenkomst.</p>
        <p class="text-white/70 mb-6">Voor de uitvoering van de regeling is het van belang om gebruik te maken van het standaard Excel-bestand, waarin je de eigen klanten en bijbehorende omzet kunt opnemen. Stuur dit overzicht na ieder kwartaal aan Jochem.</p>
        <p class="text-white/70 mb-6"><em>In de bijlage "Toelichting bonusregeling" kun je verdere uitleg van de regeling en voorbeelden vinden.</em></p>

        <h3>9.3 Discretionaire bonus</h3>
        <p class="text-white/70 mb-6">We zijn van mening dat zich situaties kunnen voordoen waarbij een extra beloning op zijn plaats kan zijn. Daarom bestaat de mogelijkheid om een individuele discretionaire bonus toe te kennen, met een duidelijke en transparante uitleg waarom iemand wel of niet voor een discretionaire bonus in aanmerking komt. Dit zullen we tijdens de jaarlijkse beoordelingen toelichten.</p>

        <h3>9.4 Ziekte</h3>
        <p class="text-white/70 mb-6">Tijdens ziekte betalen we de eerste 12 maanden <strong>100%</strong> van je vaste basissalaris. Daarna is het percentage 70% conform de wettelijke regeling.</p>

        <h3>9.6 Winstdeling</h3>
        <p class="text-white/70 mb-4">We geloven in het belang van onze gezamenlijke inspanningen voor Workx. Daarom willen we je (de advocaten en office manager) graag laten delen in de winst van Workx. Deze jaarlijkse winstdeling bedraagt een bruto uitkering ter waarde van maximaal het dividend op <strong>1% van de aandelen</strong> in Workx, op basis van winst na belastingen.</p>

        <h3>9.7 Detacheringstoeslag</h3>
        <p class="text-white/70 mb-6">Als je wordt gedetacheerd, kun je niet of minder aan een eigen praktijk bouwen. We willen dat compenseren en een detachering financieel aantrekkelijk maken. Deze toeslag is <strong>EUR 1.000 bruto per maand</strong> bij een fulltime detachering.</p>

        <h3>9.8 Jubileum</h3>
        <p class="text-white/70 mb-6">Als je 5 jaar bij ons werkt, ontvang je een jubileumbonus van <strong>EUR 5.000 bruto</strong>. Bij 10 jaar ga je ook zeker een passende bonus krijgen.</p>

        <h3>9.9 Last but not least</h3>
        <p class="text-white/70">Je krijgt van ons de legendarische <strong>Workx fiets</strong>!</p>
      `,
    },
    {
      id: 'financieel-gezond',
      title: 'Financieel Gezond',
      icon: '📊',
      content: `
        <h3>10.1 Geen urennorm, wel aandacht voor goed tijdschrijven</h3>
        <p class="text-white/70 mb-4">Workx doet niet aan urennormen. Wij vinden een urennorm een perverse prikkel meebrengen. Niet goed voor de advocaat. Niet goed voor de klant. Dat was het uitgangspunt bij de start in 2011 en zal zo blijven.</p>
        <p class="text-white/70 mb-6">De afwezigheid van een urennorm betekent niet dat uren niet belangrijk zijn. Uiteindelijk zijn wij met elkaar verantwoordelijk voor dat Workx financieel gezond is en blijft. Goed tijd schrijven is in dit verband absoluut cruciaal.</p>

        <h3>10.2 Bewust werken</h3>
        <p class="text-white/70 mb-4">Probeer in je werk bewust te zijn van het doel en zoveel mogelijk het gehele plaatje te overzien. Handvatten:</p>
        <ul class="list-disc list-inside text-white/70 mb-6 space-y-1">
          <li>Bepaal voor jezelf vooraf hoeveel tijd je bezig zou moeten zijn met bepaalde werkzaamheden</li>
          <li>Denk daar waar mogelijk als ondernemer; commercieel</li>
          <li>Gebruik Slack actief voor goede werkverdeling</li>
          <li>Bij acquisitie hoort soms het gratis laten "ruiken" aan onze diensten - doe dit bewust</li>
        </ul>

        <h3>10.3 Tijd schrijven</h3>
        <p class="text-white/70 mb-4">Zorg ervoor dat je je tijd goed schrijft. Zie dit als een belangrijk onderdeel van je werk, niet als een vervelende bijzaak. Om Workx goed te laten draaien, moet alle tijd worden geschreven.</p>
        <p class="text-white/70 mb-4">Schrijf minimaal de tijd die je bezig bent geweest. Nooit jezelf afboeken omdat je vond dat je er te lang over hebt gedaan.</p>
        <p class="text-white/70 mb-4">Tijdseenheden schrijven we in principe vanaf <strong>0,2 uur</strong>.</p>
        <p class="text-white/70 mb-4">Richtlijnen voor de kleurcode in Slack (de 'Slackstatus'):</p>
        <ul class="list-disc list-inside text-white/70 mb-6 space-y-1">
          <li><span class="text-yellow-400">Geel:</span> minder dan 4 uur declarabel per dag</li>
          <li><span class="text-orange-400">Oranje:</span> 4 - 5 uur declarabel per dag</li>
          <li><span class="text-red-400">Rood:</span> meer dan 5 uur declarabel per dag</li>
          <li><span class="text-red-500">Stoplicht:</span> alleen ruimte voor korte, afgebakende opdrachten</li>
        </ul>

        <h3>10.5 Factureren</h3>
        <p class="text-white/70 mb-4">Zorg er voor dat al je tijd goed is gefactureerd en dat er geen tijd in het systeem achterblijft. Zorg er ook voor dat je zelf actief achter je debiteuren aanzit.</p>
        <p class="text-white/70">Overleg met een van de partners over de factuur voordat deze uitgaat. Dit geldt voor iedereen.</p>
      `,
    },
    {
      id: 'bonusregeling-toelichting',
      title: 'Toelichting Bonusregeling',
      icon: '💎',
      content: `
        <h3>Doel bonusregeling</h3>
        <p class="text-white/70 mb-2">De bonusregeling is bedoeld om:</p>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li>Te stimuleren om te ondernemen</li>
          <li>Eigen praktijk en netwerk opbouwen</li>
        </ul>
        <p class="text-white/70 mb-6"><strong>Niet:</strong> afschermen van klanten of onderlinge concurrentie.</p>

        <h3>Inhoud bonusregeling</h3>
        <p class="text-white/70 mb-6">Onder een door Werknemer zelf aangebracht zaak/cliënt wordt verstaan een zaak/cliënte afkomstig uit het netwerk van Werknemer. Wanneer een directe doorverwijzing naar Werknemer afkomstig is van een door Werknemer bijgestane kantoor cliënt (bijvoorbeeld via een eerder bijgestane werknemer), geldt dit als een zelf aangebrachte cliënt.</p>

        <h3>Toelichting</h3>
        <p class="text-white/70 mb-4"><strong>Uitgangspunt:</strong> de bonusregeling geldt voor "zelf aangebrachte zaak/client uit het netwerk van Werknemer".</p>
        <p class="text-white/70 mb-6"><strong>Aanvulling:</strong> geldt voor een client die nog niet eerder in beeld was bij Workx en die op basis van een directe doorverwijzing (van een Workx client) expliciet vraagt om met een bepaalde advocaat te werken.</p>

        <h3>Voorbeelden</h3>
        <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
          <p class="text-green-400 font-semibold mb-2">Voorbeeld 1 - Telt WEL mee</p>
          <p class="text-white/70">Advocaat staat op een borrel en raakt in contact met de eigenaar van een onderneming. Na een week mailt de eigenaar de betreffende advocaat over een nieuwe zaak.</p>
        </div>

        <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
          <p class="text-green-400 font-semibold mb-2">Voorbeeld 2 - Telt WEL mee</p>
          <p class="text-white/70">Een advocaat staat een werknemer bij, die zich heeft gemeld via de website. De werknemer (dan client) is zeer tevreden. De buurman van de betreffende client wordt ontslagen en neemt na een directe doorverwijzing van client contact op met dezelfde advocaat met het verzoek hem bij te staan.</p>
        </div>

        <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
          <p class="text-red-400 font-semibold mb-2">Voorbeeld 3 - Telt NIET mee</p>
          <p class="text-white/70">Nieuwe klant belt naar algemeen kantoornummer of info e-mailadres van Workx. Advocaat pakt zaak op.</p>
        </div>

        <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
          <p class="text-red-400 font-semibold mb-2">Voorbeeld 4 - Telt NIET mee</p>
          <p class="text-white/70">Nieuwe klant belt direct naar specifieke advocaat op basis van de website.</p>
        </div>

        <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
          <p class="text-red-400 font-semibold mb-2">Voorbeeld 5 - Telt NIET mee</p>
          <p class="text-white/70">Een relatie uit het netwerk van kantoor verwijst een client door aan een specifieke advocaat. Ter illustratie; Niels (Zilver advocaten) verwijst een werknemer naar Annieck.</p>
        </div>

        <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <p class="text-red-400 font-semibold mb-2">Voorbeeld 6 - Telt NIET mee</p>
          <p class="text-white/70">Stek Advocaten vraagt ons te helpen bij een due diligence. De betrokken onderneming of aandeelhouder is tevreden over het werk van de advocaat en benadert later rechtstreeks de betreffende advocaat met een nieuwe zaak.</p>
        </div>

        <h3>Aandachtspunten</h3>
        <ul class="list-disc list-inside text-white/70 space-y-2">
          <li>Van belang dat iedereen direct meldt als sprake is van een nieuwe aangebrachte zaak/client uit het eigen netwerk. Zodat we meteen kunnen vaststellen of het wel of niet onder de bonusregeling valt.</li>
          <li>Duidelijk afspraken maken voordat samen acquisitie wordt gevoerd en nieuwe klant wordt binnengehaald.</li>
        </ul>
      `,
    },
  ],
}

// All available documents
const DOCUMENTS: Document[] = [
  THE_WAY_IT_WORKX,
]

// Icon mapping for documents
const documentIcons: Record<string, typeof Icons.home> = {
  'the-way-it-workx': Icons.books,
}

// Icon mapping for chapters
const chapterIcons: Record<string, typeof Icons.home> = {
  '👋': Icons.smile,
  '📋': Icons.fileText,
  '💼': Icons.briefcase,
  '🏖️': Icons.sun,
  '💰': Icons.euro,
  '🏥': Icons.heart,
  '📚': Icons.fileText,
  '🔒': Icons.lock,
  '⚖️': Icons.shield,
  '🎯': Icons.target,
  '🤝': Icons.users,
  '📝': Icons.fileText,
  '🚀': Icons.zap,
  '💡': Icons.sparkles,
  '🎉': Icons.star,
  '🍽️': Icons.coffee,
  '🛡️': Icons.shield,
  '🔄': Icons.refresh,
  '📊': Icons.chart,
  '💎': Icons.award,
  '📎': Icons.paperclip,
}

export default function HRDocsPage() {
  const { data: session } = useSession()
  const [activeDoc, setActiveDoc] = useState<string>(DOCUMENTS[0].id)
  const [activeChapter, setActiveChapter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showMobileToc, setShowMobileToc] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const mobileNavRef = useRef<HTMLDivElement>(null)
  const isManualScrolling = useRef(false)

  // Edit state
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [savedChapters, setSavedChapters] = useState<Record<string, Chapter>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Check if user can edit (Partner or Admin/Head of Office)
  const canEdit = session?.user?.role === 'PARTNER' || session?.user?.role === 'ADMIN'

  // Fetch saved chapters from API
  useEffect(() => {
    const fetchSavedChapters = async () => {
      try {
        const res = await fetch(`/api/hr-docs?documentId=${activeDoc}`)
        if (res.ok) {
          const chapters = await res.json()
          const chaptersMap: Record<string, Chapter> = {}
          chapters.forEach((ch: any) => {
            chaptersMap[ch.chapterId] = {
              id: ch.chapterId,
              title: ch.title,
              icon: ch.icon,
              content: ch.content,
            }
          })
          setSavedChapters(chaptersMap)
        }
      } catch (error) {
        console.error('Error fetching saved chapters:', error)
      }
    }
    fetchSavedChapters()
  }, [activeDoc])

  // Get current document with saved edits applied
  const currentDoc = useMemo(() => {
    const doc = DOCUMENTS.find(d => d.id === activeDoc) || DOCUMENTS[0]
    // Apply saved edits to chapters
    const chaptersWithEdits = doc.chapters.map(chapter => {
      if (savedChapters[chapter.id]) {
        return savedChapters[chapter.id]
      }
      return chapter
    })
    return { ...doc, chapters: chaptersWithEdits }
  }, [activeDoc, savedChapters])

  // Open edit modal
  const openEditModal = (chapter: Chapter) => {
    setEditingChapter(chapter)
    setEditTitle(chapter.title)
    setEditContent(chapter.content)
    setEditIcon(chapter.icon)
  }

  // Save chapter edits to API
  const saveChapterEdit = async () => {
    if (!editingChapter) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/hr-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: activeDoc,
          chapterId: editingChapter.id,
          title: editTitle,
          icon: editIcon,
          content: editContent,
        }),
      })

      if (!res.ok) {
        throw new Error('Kon niet opslaan')
      }

      // Update local state
      setSavedChapters(prev => ({
        ...prev,
        [editingChapter.id]: {
          id: editingChapter.id,
          title: editTitle,
          icon: editIcon,
          content: editContent,
        }
      }))

      toast.success('Hoofdstuk opgeslagen')
      setEditingChapter(null)
    } catch (error) {
      toast.error('Kon hoofdstuk niet opslaan')
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel edit
  const cancelEdit = () => {
    setEditingChapter(null)
    setEditTitle('')
    setEditContent('')
    setEditIcon('')
  }

  // Set initial active chapter
  useEffect(() => {
    if (currentDoc.chapters.length > 0 && !activeChapter) {
      setActiveChapter(currentDoc.chapters[0].id)
    }
  }, [currentDoc, activeChapter])

  // Track which chapter is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Don't update if user is manually scrolling via click
        if (isManualScrolling.current) return

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const chapterId = entry.target.id.replace('chapter-', '')
            setActiveChapter(chapterId)
          }
        })
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    )

    currentDoc.chapters.forEach((chapter) => {
      const element = document.getElementById(`chapter-${chapter.id}`)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [currentDoc.chapters])

  // Scroll mobile nav to show active chapter
  useEffect(() => {
    if (mobileNavRef.current && activeChapter) {
      const activeButton = mobileNavRef.current.querySelector(`[data-chapter="${activeChapter}"]`) as HTMLElement
      if (activeButton) {
        activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [activeChapter])

  // Filter chapters based on search
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return currentDoc.chapters
    const query = searchQuery.toLowerCase()
    return currentDoc.chapters.filter(chapter =>
      chapter.title.toLowerCase().includes(query) ||
      chapter.content.toLowerCase().includes(query)
    )
  }, [currentDoc.chapters, searchQuery])

  // Get current chapter
  const currentChapter = useMemo(() => {
    return currentDoc.chapters.find(c => c.id === activeChapter)
  }, [currentDoc.chapters, activeChapter])

  // Scroll to chapter
  const scrollToChapter = (chapterId: string) => {
    // Prevent IntersectionObserver from overriding while scrolling
    isManualScrolling.current = true
    setActiveChapter(chapterId)
    setShowMobileToc(false)

    // Small delay to ensure state updates first
    setTimeout(() => {
      const element = document.getElementById(`chapter-${chapterId}`)
      if (element) {
        const headerOffset = 100 // Account for fixed headers
        const elementPosition = element.getBoundingClientRect().top
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        })
      }

      // Re-enable observer after scroll completes
      setTimeout(() => {
        isManualScrolling.current = false
      }, 1000)
    }, 50)
  }

  // Highlight search matches in content
  const highlightContent = (content: string) => {
    if (!searchQuery.trim()) return content
    const regex = new RegExp(`(${searchQuery})`, 'gi')
    return content.replace(regex, '<mark class="bg-workx-lime/30 text-white px-1 rounded">$1</mark>')
  }

  return (
    <div className="fade-in pb-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center">
            <Icons.books className="text-blue-400" size={18} />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white">The Way it Workx</h1>
        </div>
        <p className="text-gray-400 text-sm sm:text-base hidden sm:block">Het personeelshandboek van Workx Advocaten</p>
      </div>

      {/* Document Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {DOCUMENTS.map((doc) => {
          const DocIcon = documentIcons[doc.id] || Icons.fileText
          return (
            <button
              key={doc.id}
              onClick={() => {
                setActiveDoc(doc.id)
                setActiveChapter('')
                setSearchQuery('')
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeDoc === doc.id
                  ? 'bg-workx-lime text-workx-dark'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              <DocIcon size={18} />
              <span>{doc.title}</span>
            </button>
          )
        })}

        {canEdit && (
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-dashed border-white/10 transition-all"
          >
            <Icons.plus size={16} />
            <span>Document toevoegen</span>
          </button>
        )}
      </div>

      {/* Mobile Chapter Navigation - Always visible on mobile */}
      <div className="lg:hidden mb-4">
        <div className="card p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Hoofdstukken</p>
            <button
              onClick={() => setShowMobileToc(true)}
              className="text-xs text-workx-lime flex items-center gap-1"
            >
              <Icons.list size={14} />
              Alle hoofdstukken
            </button>
          </div>
          <div ref={mobileNavRef} className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
            {currentDoc.chapters.map((chapter) => (
              <button
                key={chapter.id}
                data-chapter={chapter.id}
                onClick={() => scrollToChapter(chapter.id)}
                className={`chapter-btn flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  activeChapter === chapter.id
                    ? 'bg-workx-lime text-workx-dark font-medium'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="chapter-emoji text-base">{chapter.icon}</span>
                <span className="whitespace-nowrap">{chapter.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex gap-6 relative">
        {/* Sidebar - Table of Contents */}
        <aside className="hidden lg:block w-72 flex-shrink-0 self-start sticky top-4">
          <div className="card p-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {/* Search */}
            <div className="relative mb-4">
              <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                type="text"
                placeholder="Zoeken in document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-10 text-sm"
              />
            </div>

            {/* Document Info */}
            <div className="mb-4 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center">
                  {(() => {
                    const DocIcon = documentIcons[currentDoc.id] || Icons.fileText
                    return <DocIcon className="text-blue-400" size={22} />
                  })()}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{currentDoc.title}</h3>
                  <p className="text-xs text-gray-400">{currentDoc.description}</p>
                </div>
              </div>
              {currentDoc.lastUpdated && (
                <p className="text-xs text-white/30 mt-2">Laatst bijgewerkt: {currentDoc.lastUpdated}</p>
              )}
            </div>

            {/* Chapters */}
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mb-2 px-2">
                Inhoudsopgave
              </p>
              {filteredChapters.map((chapter, index) => {
                const IconComponent = chapterIcons[chapter.icon] || Icons.fileText
                const isActive = activeChapter === chapter.id
                return (
                  <button
                    key={chapter.id}
                    onClick={() => scrollToChapter(chapter.id)}
                    className={`chapter-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
                      isActive
                        ? 'bg-workx-lime/10 text-workx-lime border border-workx-lime/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="chapter-emoji text-lg flex-shrink-0">{chapter.icon}</span>
                    <span className="flex-1 truncate">{chapter.title}</span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-workx-lime" />}
                  </button>
                )
              })}
            </div>

            {filteredChapters.length === 0 && searchQuery && (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Icons.search size={24} className="mx-auto mb-2 opacity-50" />
                <p>Geen resultaten voor "{searchQuery}"</p>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile TOC Drawer */}
        {showMobileToc && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileToc(false)}>
            <div
              className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] bg-workx-gray border-l border-white/10 p-4 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Inhoudsopgave</h3>
                <button onClick={() => setShowMobileToc(false)} className="p-2 text-gray-400 hover:text-white">
                  <Icons.x size={20} />
                </button>
              </div>

              {/* Mobile Search */}
              <div className="relative mb-4">
                <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input
                  type="text"
                  placeholder="Zoeken..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10 text-sm"
                />
              </div>

              {/* Mobile Chapters */}
              <div className="space-y-1">
                {filteredChapters.map((chapter) => (
                  <button
                    key={chapter.id}
                    onClick={() => scrollToChapter(chapter.id)}
                    className={`chapter-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
                      activeChapter === chapter.id
                        ? 'bg-workx-lime/10 text-workx-lime'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="chapter-emoji text-lg">{chapter.icon}</span>
                    <span className="flex-1">{chapter.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0" ref={contentRef}>
          {currentDoc.chapters.map((chapter) => (
            <section
              key={chapter.id}
              id={`chapter-${chapter.id}`}
              className="card p-6 sm:p-8 mb-6"
            >
              {/* Chapter Header */}
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center text-2xl">
                  {chapter.icon}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-white">{chapter.title}</h2>
                  {chapter.subsections && chapter.subsections.length > 0 && (
                    <p className="text-sm text-gray-400">{chapter.subsections.length} onderdelen</p>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => openEditModal(chapter)}
                    className="ml-auto p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    title="Hoofdstuk bewerken"
                  >
                    <Icons.edit size={16} />
                  </button>
                )}
              </div>

              {/* Chapter Content */}
              <div
                className="prose prose-invert prose-sm max-w-none
                  prose-headings:text-white prose-headings:font-semibold
                  prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                  prose-h4:text-base prose-h4:mt-4 prose-h4:mb-2
                  prose-p:text-white/70 prose-p:leading-relaxed
                  prose-li:text-white/70 prose-li:marker:text-workx-lime
                  prose-strong:text-white prose-strong:font-semibold
                  prose-a:text-workx-lime prose-a:no-underline hover:prose-a:underline
                  prose-ul:my-4 prose-ol:my-4
                  prose-blockquote:border-l-workx-lime prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
                "
                dangerouslySetInnerHTML={{
                  __html: highlightContent(chapter.content)
                }}
              />
            </section>
          ))}

          {/* Empty state */}
          {currentDoc.chapters.length === 0 && (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Icons.fileText className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Nog geen inhoud</h3>
              <p className="text-gray-400 text-sm mb-4">Dit document heeft nog geen hoofdstukken.</p>
              {canEdit && (
                <button className="btn-primary">
                  <Icons.plus size={16} />
                  <span>Hoofdstuk toevoegen</span>
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Edit Chapter Modal */}
      {editingChapter && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={cancelEdit}>
          <div className="card p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center">
                  <Icons.edit className="text-blue-400" size={18} />
                </div>
                <h2 className="font-semibold text-white text-lg">Hoofdstuk bewerken</h2>
              </div>
              <button
                onClick={cancelEdit}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Icons.x size={18} />
              </button>
            </div>

            {/* Edit Form */}
            <div className="space-y-4">
              {/* Icon & Title Row */}
              <div className="flex gap-4">
                <div className="w-20">
                  <label className="block text-sm text-gray-400 mb-2">Icoon</label>
                  <input
                    type="text"
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value)}
                    className="input-field text-center text-2xl"
                    maxLength={2}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-2">Titel</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="input-field"
                    placeholder="Titel van het hoofdstuk"
                  />
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Inhoud (HTML)
                  <span className="text-white/30 ml-2">• Gebruik &lt;h3&gt; voor koppen, &lt;p&gt; voor paragrafen, &lt;ul&gt;/&lt;li&gt; voor lijsten</span>
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="input-field font-mono text-sm resize-none"
                  rows={16}
                  placeholder="<p>Paragraaf tekst...</p>"
                />
              </div>

              {/* HTML Help */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-gray-400 mb-2 font-semibold">Veelgebruikte HTML tags:</p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="text-white/50">
                    <code className="text-workx-lime">&lt;h3&gt;</code> Subkop
                  </div>
                  <div className="text-white/50">
                    <code className="text-workx-lime">&lt;p class="text-white/70 mb-4"&gt;</code> Paragraaf
                  </div>
                  <div className="text-white/50">
                    <code className="text-workx-lime">&lt;strong&gt;</code> Vetgedrukt
                  </div>
                  <div className="text-white/50">
                    <code className="text-workx-lime">&lt;ul&gt;&lt;li&gt;</code> Opsomming
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-white/5">
              <button
                onClick={cancelEdit}
                disabled={isSaving}
                className="flex-1 btn-secondary"
              >
                Annuleren
              </button>
              <button
                onClick={saveChapterEdit}
                disabled={isSaving}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="w-4 h-4 border-2 border-workx-dark border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Icons.check size={16} />
                    Opslaan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
