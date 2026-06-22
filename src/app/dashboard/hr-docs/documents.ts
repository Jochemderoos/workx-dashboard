// Document types
export interface Chapter {
  id: string
  title: string
  icon: string
  content: string
  subsections?: { id: string; title: string }[]
}

export interface Document {
  id: string
  title: string
  description: string
  icon: string
  chapters: Chapter[]
  lastUpdated?: string
}

// The Way it Workx document - full content from PDF
export const THE_WAY_IT_WORKX: Document = {
  id: 'the-way-it-workx',
  title: 'The Way it Workx',
  description: 'Het personeelshandboek van Workx Advocaten',
  icon: '📘',
  lastUpdated: '2026',
  chapters: [
    {
      id: 'welkom',
      title: 'Welkom bij Workx',
      icon: '👋',
      content: `
        <p class="text-white/70 mb-6">Vanaf vandaag ben je onderdeel van Team Workx, welkom!</p>
        <p class="text-white/70 mb-4">Workx is een energiek en bevlogen advocatenkantoor. Wij zijn gespecialiseerd in het mooiste vakgebied; arbeidsrecht. Onze klanten zijn voornamelijk werkgevers, maar wij vertegenwoordigen en adviseren ook ondernemingsraden, (statutair) bestuurders en werknemers. Wij zijn een modern kantoor, waar we graag op een informele en betrokken manier met elkaar samenwerken.</p>
        <p class="text-white/70 mb-4">Advocaten houden van regels. Maar regels kunnen in de praktijk ook tot bureaucratie en inflexibiliteit leiden. Dat willen wij niet. Dit document is daarom vooral bedoeld als hulpmiddel. Lees het rustig door en laat het ons vooral weten als je vragen hebt.</p>
        <div class="bg-workx-lime/10 border border-workx-lime/20 rounded-lg p-4 mt-6">
          <p class="text-white/80 font-medium mb-2">Het Workx Dashboard</p>
          <p class="text-white/70 text-sm">Bijna alles wat je dagelijks nodig hebt, regel je in het Workx Dashboard waar je dit handboek nu in leest: agenda, vakanties &amp; verlof, werkplek reserveren (Appjeplekje), opleidingen &amp; PO-punten, bonus, declaraties, wachtwoorden, het team-overzicht en meer. Gebruik het overzicht (in de sidebar) om snel te zien waar je iets terugvindt.</p>
        </div>
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
        <p class="text-white/70">We vinden het prettig te weten waar je bent tijdens werktijd. Als je bijvoorbeeld later op kantoor bent of naar de dokter moet; laat even een berichtje achter in Slack, of bij één van de partners in een situatie dat je de reden niet met iedereen wilt delen.</p>
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
        <p class="text-white/70 mb-4">Als je van plan bent op kantoor te werken, vul dat dan van tevoren in via de app: <strong>Appjeplekje</strong>. Als alle werkplekken bezet zijn en je toch naar kantoor wilt komen, dan kun je altijd ruilen met een collega. Het is de bedoeling dat de bezetting op kantoor zoveel mogelijk evenredig wordt verdeeld over de werkweek.</p>
        <p class="text-white/70 mb-4">Als je last minute geen gebruik maakt van je gereserveerde plek, laat het dan even weten in de groepsapp en annuleer je reservering in Appjeplekje, zodat we weten dat je niet op kantoor bent en een collega eventueel je plek kan overnemen.</p>
        <p class="text-white/70 mb-4">Degene die aan het einde van de werkdag als laatste vertrekt (zowel beneden als boven):</p>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li>controleert of alle ramen dicht zijn</li>
          <li>doet de lichten uit</li>
          <li>zet de afwasmachine aan</li>
          <li>sluit kantoor af</li>
          <li>stuurt een berichtje in Slack om te laten weten dat beneden of boven niemand meer aanwezig is — ook belangrijk in verband met eventuele calamiteiten en voor onze BHV'ers</li>
        </ul>
        <p class="text-white/70 mb-6">Reserveringen voor de vergaderruimte op de vierde verdieping leg je zelf vast in de agenda van de 'Werkstudent' in Basenet. Zo voorkomen we dubbele boekingen.</p>

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
        <ol class="list-decimal list-inside text-white/70 mb-4 space-y-1">
          <li>Actielijst vorige keer</li>
          <li>Terugkoppeling partneroverleg maandag</li>
          <li>Mededelingen Hanna</li>
          <li>Nieuw ingebrachte onderwerpen</li>
        </ol>
        <p class="text-white/70 mb-4">Iedereen stuurt uiterlijk vrijdag vóór het werkoverleg input voor de agenda aan de voorzitter; de partners delen de input vanuit het partneroverleg van maandag. De voorzitter deelt daarna de agenda, zodat we allemaal voorbereid kunnen deelnemen. Bij het tweede overleg wijst de voorzitter een opvolger aan.</p>
        <p class="text-white/70 mb-6">De agenda, notulen en open actiepunten staan in het dashboard onder <strong>Werkoverleg</strong>. Daar kun je ook nieuwe agendapunten inbrengen en taken aan jezelf of een collega koppelen.</p>

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
        <p class="text-white/70 mb-4">Iedereen krijgt de mogelijkheid zich verder te ontwikkelen door gebruik te maken van een eigen externe coach. Hiervoor wordt in ieder geval per periode van drie jaar een budget van <strong>€ 1.500 ex btw</strong> beschikbaar gesteld. Daarnaast mag je gedurende 2 werkdagen onder werktijd coaching volgen in die 3-jaars periode (geen extra vrije dagen), om te stimuleren dat je hier ook daadwerkelijk gebruik van maakt.</p>
        <p class="text-white/70 mb-6">Houd zelf bij hoeveel van het budget je hebt besteed via de pagina <strong>Mijn coachingbudget</strong> in het dashboard. Geef de facturen door aan Hanna voor verrekening.</p>

        <h3>5.2 Plan</h3>
        <p class="text-white/70 mb-6">Voor iedere medewerker zal een persoonlijk ontwikkelplan worden opgesteld. We vinden het belangrijk dat iedereen op verschillende manieren kan groeien. Workx hanteert het adagium; stilstaan is achteruitgang. Het ontwikkelplan is onder andere bedoeld als ondersteuning op het gebied van inhoudelijke kennis, ervaring en ondernemerschap. Je eigen ontwikkelplan staat in het dashboard onder <strong>Ontwikkelplannen</strong> — daar werk je het samen met je mentor of partner bij.</p>

        <h3>5.3 Opleiding</h3>
        <p class="text-white/70 mb-4">We zorgen ervoor dat je meerdere cursussen per jaar kunt volgen op kantoor. Hiervoor worden externe sprekers uitgenodigd. Probeer daar zoveel mogelijk bij aanwezig te zijn. Je kunt ook zeker een voorstel indienen voor een onderwerp of docent. Naast de interne cursussen bestaat de mogelijkheid om externe opleidingen te volgen om de benodigde PO-punten te behalen. Je behaalde PO-punten houd je bij in het dashboard onder <strong>Opleidingen</strong>.</p>
        <p class="text-white/70 mb-4">Eén keer in de drie weken bespreken we op kantoor de Jurisprudentie Arbeidsrecht (JAR), doorgaans op donderdag van 16.00 - 17.15 uur. We bereiden dit om de beurt voor — het volledige rooster, inclusief de mogelijkheid om met een collega te ruilen, staat in het dashboard onder <strong>Opleidingen → JAR-rooster</strong>. Twee weken voor jouw beurt krijg je automatisch een reminder. Probeer hier zo veel mogelijk bij aanwezig te zijn.</p>
        <p class="text-white/70 mb-6">Voor de beroepsopleiding krijgt een advocaat-stagiair één studiedag voor een tentamen van Workx.</p>

        <h3>5.4 Intervisie</h3>
        <p class="text-white/70">Intervisie is onderdeel van de verplichte jaarlijkse PO-punten. Uiteraard kun je altijd bij ons terecht met je vragen en dilemma's. Tegelijkertijd leert de ervaring dat je sommige zaken liever met anderen bespreekt en een blik buiten Workx ook verfrissend kan werken. We stimuleren je dan ook om je bij een leuke intervisiegroep aan te sluiten.</p>
      `,
    },
    {
      id: 'veilig-werken',
      title: 'Veilig Werken',
      icon: '🛡️',
      content: '<!--component:veilig-werken-->',
    },
    {
      id: 'vrije-dagen',
      title: 'Vrije Dagen',
      icon: '🏖️',
      content: `
        <h3>7.1 Vakantieplannen</h3>
        <p class="text-white/70 mb-4">"Geef me werk dat bij me past en ik hoef nooit meer te werken", aldus de filosoof Confucius. Toch kunnen we ons voorstellen dat je af en toe op vakantie wilt gaan. Vraag je vakantie altijd aan via de pagina <strong>Vakanties &amp; Verlof</strong> in het dashboard. We willen voorkomen dat iedereen tegelijk op vakantie gaat.</p>
        <p class="text-white/70 mb-4">In het overzicht zijn de <span class="text-red-400 font-medium">schoolvakanties Noord-Holland in rood</span> gemarkeerd — dat zijn periodes waarin extra veel collega's vrij willen. Probeer in die <strong>rode periodes</strong> goed onderling af te stemmen voordat je je aanvraag indient, zodat er altijd voldoende bezetting overblijft.</p>
        <p class="text-white/70 mb-6">Een losse vrije dag kun je wat ons betreft ook op het laatste moment aanvragen. We vertrouwen er volledig op dat je zelf het beste de inschatting kunt maken dat het geen problemen met werk of collega's oplevert. Voor een bezoek aan de tandarts of dokter hoef je geen vrije dag op te nemen.</p>

        <h3>7.2 Bijkopen</h3>
        <p class="text-white/70 mb-6">Als je toe bent aan meer vakantie dan kun je per kalenderjaar maximaal <strong>5 vakantiedagen</strong> (op basis van fulltime) bijkopen. Dit wordt dan verrekend met je salaris.</p>

        <h3>7.3 Ouderschapsverlof</h3>
        <p class="text-white/70 mb-4">Als je een kind krijgt of hebt onder de 8 jaar, heb je recht op ouderschapsverlof. Workx volgt de wettelijke regeling:</p>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li><strong>9 weken betaald</strong> verlof, gedurende het eerste levensjaar — 70% van je salaris via het UWV.</li>
          <li><strong>17 weken onbetaald</strong> verlof, op te nemen tot het kind 8 jaar is.</li>
        </ul>
        <p class="text-white/70 mb-6">Je kunt je ouderschapsverlof aanvragen en bijhouden via de pagina <strong>Vakanties &amp; Verlof</strong> in het dashboard. Stem de planning tijdig af met de partners zodat we de waarneming goed kunnen regelen.</p>

        <h3>7.4 Feestdagen</h3>
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

        <h3>7.5 Verhuizen</h3>
        <p class="text-white/70 mb-6">Als je gaat verhuizen krijg je een vrije dag van Workx (eens per 3 jaar).</p>

        <h3>7.6 Trouwen</h3>
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
        <p class="text-white/70 mb-4">Indien waarneming nodig is, moet de waarnemer zo goed mogelijk worden geholpen om de belasting van het waarnemen zo veel als mogelijk te beperken. De verantwoordelijkheid en inspanning hiervoor ligt bij degene die afwezig zal zijn. Hiervoor gelden de volgende kaders:</p>

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

        <h4 class="text-white font-semibold mt-4 mb-2">4. Overdrachtsdocument</h4>
        <p class="text-white/70">Gebruik ons standaard overdrachtsdocument in het dashboard onder <strong>Overdracht</strong> en vul dit zo compleet mogelijk in. Neem daarna de tijd om het document nader toe te lichten aan de waarnemer.</p>
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
        <p class="text-white/70 mb-6">Je kunt je eigen bonus aanmaken en bijhouden via de <strong>Bonus-tool in het dashboard</strong>. Indienen doe je daar één keer per kwartaal — die gaat naar <strong>Hanna</strong> voor controle en uitbetaling.</p>
        <p class="text-white/70 mb-6"><em>In de bijlage "Toelichting bonusregeling" kun je verdere uitleg van de regeling en voorbeelden vinden.</em></p>

        <h3>9.3 Discretionaire bonus</h3>
        <p class="text-white/70 mb-6">We zijn van mening dat zich situaties kunnen voordoen waarbij een extra beloning op zijn plaats kan zijn. Daarom bestaat de mogelijkheid om een individuele discretionaire bonus toe te kennen, met een duidelijke en transparante uitleg waarom iemand wel of niet voor een discretionaire bonus in aanmerking komt. Dit zullen we tijdens de jaarlijkse beoordelingen toelichten.</p>

        <h3>9.4 Ziekte</h3>
        <p class="text-white/70 mb-6">Tijdens ziekte betalen we de eerste 12 maanden <strong>100%</strong> van je vaste basissalaris. Daarna is het percentage 70% conform de wettelijke regeling.</p>

        <h3>9.5 Winstdeling</h3>
        <p class="text-white/70 mb-4">We geloven in het belang van onze gezamenlijke inspanningen voor Workx. Daarom willen we je (de advocaten en office manager) graag laten delen in de winst van Workx. Deze jaarlijkse winstdeling bedraagt een bruto uitkering ter waarde van maximaal het dividend op <strong>1% van de aandelen</strong> in Workx, op basis van winst na belastingen, onder de volgende voorwaarden:</p>
        <ul class="list-none text-white/70 mb-6 space-y-2">
          <li><strong>(a)</strong> je bent in dienst op het moment dat de winstdeling wordt vastgesteld op basis van de jaarrekening én op het moment dat de betaling zal plaatsvinden. De jaarrekening stelt onze accountant vast. Betaling vindt plaats in de maand direct volgend op de vaststelling van de jaarrekening. Bij voortijdige beëindiging van de arbeidsovereenkomst bestaat geen recht op een (pro rato) uitkering;</li>
          <li><strong>(b)</strong> als je gedurende het kalenderjaar start bij Workx, dan wordt de winstdeling pro rato aangepast op basis van de startdatum;</li>
          <li><strong>(c)</strong> als je een periode van in totaal meer dan 3 maanden (gedeeltelijk) arbeidsongeschikt bent of wegens andere redenen niet volledig aan het werk bent, bestaat er geen aanspraak op een winstdeling over die periode en wordt de uitkering daarop aangepast, tenzij de reden is gelegen in zwangerschaps- en/of bevallingsverlof en ouderschapsverlof;</li>
          <li><strong>(d)</strong> de totale winstdeling voor alle medewerkers gezamenlijk bedraagt maximaal de waarde van het dividend op <strong>10% van de aandelen</strong> in Workx, op basis van winst na belastingen. Met andere woorden, als er meer dan 10 medewerkers aanspraak maken op de winstdeling, zal het percentage minder dan 1% bedragen;</li>
          <li><strong>(e)</strong> een winstdeling behoort niet tot het gebruikelijke salaris en hier wordt dan ook geen vakantiegeld over betaald. Het vormt ook geen grondslag voor pensioenbetalingen;</li>
          <li><strong>(f)</strong> Workx behoudt zich het recht voor de winstdelingsregeling eenzijdig te wijzigen.</li>
        </ul>

        <h3>9.6 Detacheringstoeslag</h3>
        <p class="text-white/70 mb-4">Als je wordt gedetacheerd, kun je niet of minder aan een eigen praktijk bouwen. We willen dat compenseren en een detachering financieel aantrekkelijk maken. Deze toeslag is <strong>EUR 1.000 bruto per maand</strong> bij een fulltime detachering.</p>
        <p class="text-white/70 mb-6">Uitgangspunt is dat als je een detachering binnenhaalt — vergelijkbaar met het binnenhalen van een eigen cliënt onder de bonusregeling eigen omzet — je de detachering ook zelf doet. Dan is er geen detacheringstoeslag maar de eigen omzetbonus. Haalt iemand de detachering binnen maar doet een collega deze, dan komt de detacheringstoeslag die de collega krijgt in mindering op de eigen omzet voor die detachering.</p>

        <h3>9.7 Jubileum</h3>
        <p class="text-white/70 mb-6">Als je 5 jaar bij ons werkt, ontvang je een jubileumbonus van <strong>EUR 5.000 bruto</strong>. Bij 10 jaar ga je ook zeker een passende bonus krijgen.</p>

        <h3>9.8 Last but not least</h3>
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
        <p class="text-white/70 mb-4">Zorg ervoor dat je je tijd goed schrijft. Zie dit als een belangrijk onderdeel van je werk, niet als een vervelende bijzaak. Om Workx goed te laten draaien, moet alle tijd worden geschreven (ook intern overleg, voorbereiding, inlezen in literatuur/jurisprudentie en het eerste gesprek met de cliënt). Uren schrijven we in <strong>Basenet</strong>; dat is de officiële boekhouding waarop facturen en de financiële cijfers gebaseerd zijn.</p>
        <p class="text-white/70 mb-4">Schrijf minimaal de tijd die je bezig bent geweest. Nooit jezelf afboeken omdat je vond dat je er te lang over hebt gedaan. Schrijf juist <strong>meer</strong> tijd als het geleverde meer waard is dan de bestede tijd (denk aan het hergebruik van een eerder advies of model, veel kleine verrichtingen voor één dienst, of opleveren onder grote tijdsdruk). Overleg in die gevallen met een partner.</p>
        <p class="text-white/70 mb-4">Tijdseenheden schrijven we in principe vanaf <strong>0,2 uur</strong>. 0,1 schrijven we alleen bij werk zonder inhoud dat 1 à 2 minuten duurt (bijv. een afspraak maken); voeg losse 0,1-tjes waar mogelijk samen.</p>
        <p class="text-white/70 mb-6">Houd als richtsnoer aan dat je op een behoorlijk gevulde declarabele dag tenminste <strong>4 uur</strong> declarabel moet kunnen halen, op drukke dagen 5 à 6 uur. Geen probleem als het niet druk was. Kijk aan het einde van de dag of je uren overeenkomen met je gevoel van die dag — staan er minder uren, loop dan na of je niets bent vergeten.</p>

        <h3>10.4 Invulling urenregels in Basenet</h3>
        <p class="text-white/70 mb-4">Zorg dat de omschrijvingen in BaseNet duidelijk en consistent zijn. Verwijder de door BaseNet voorgestelde tekst en vervang deze door:</p>
        <p class="text-white/70 mb-1"><strong>In het Nederlands:</strong></p>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li>E-mail/brief/tel/overleg [naam contactpersoon en/of wederpartij]</li>
          <li>Opstellen vso/advies/memo over [onderwerp]</li>
          <li>Rechtspraak/literatuur over [onderwerp]</li>
          <li>DD [rapport/Q&amp;A/review documents]</li>
        </ul>
        <p class="text-white/70 mb-1"><strong>In het Engels:</strong></p>
        <ul class="list-disc list-inside text-white/70 mb-4 space-y-1">
          <li>Email/letter/tel/meeting [name client and/or counterparty]</li>
          <li>Draft settlement/advice/memo re. [subject]</li>
          <li>Case law/literature re. [subject]</li>
          <li>DD [report/Q&amp;A/review docs]</li>
        </ul>
        <p class="text-white/70 mb-6">In algemene dossiers of dossiers die geen betrekking hebben op één specifieke werknemer voeg je toe: over [onderwerp] (bijvoorbeeld initialen werknemer of advies betr. OR) / re. [subject] (e.g. initials employee or advice Works Council).</p>

        <h3>10.5 Factureren</h3>
        <p class="text-white/70 mb-4">Zorg er voor dat al je tijd goed is gefactureerd en dat er geen tijd in het systeem achterblijft. Zorg er ook voor dat je zelf actief achter je debiteuren aanzit — het overzicht openstaande facturen vind je in het dashboard onder <strong>Debiteuren</strong>.</p>
        <p class="text-white/70 mb-4">Overleg met een van de partners over de factuur voordat deze uitgaat. Dit geldt voor iedereen. De factuur moet passen bij het geleverde werk en de gerechtvaardigde verwachtingen van de klant.</p>
        <p class="text-white/70 mb-2">Een aantal instructies van Hanna om het facturatieproces goed te laten verlopen:</p>
        <ul class="list-disc list-inside text-white/70 mb-6 space-y-1">
          <li>Engelstalige factuur: JA of NEE — geef dit aan of pas dit zelf aan (kan meteen bij het aanmaken van het dossier).</li>
          <li>Moet het zonder specificatie? Geef dit aan.</li>
          <li>Check de factuuradressen en e-mailadressen en stel ze zelf goed in in Basenet — anders gaan reminders naar de verkeerde adressen.</li>
          <li>Diegene die op het dossier behandeld staat, stuurt de declaratievoorstellen door ter controle aan wie op het dossier heeft gewerkt.</li>
        </ul>

        <h3>10.6 Non-declarabel</h3>
        <p class="text-white/70 mb-4">Naast declarabel werk zijn we doorlopend bezig met non-declarabel werk. We verwachten dat iedereen hier een bijdrage aan levert. Op enkele uitzonderingen na schrijven we de tijd voor non-declarabel werk niet; tijd schrijven op projecten gebeurt alleen na overleg. Heb je minder declarabel werk liggen, besteed dan juist extra aandacht aan non-declarabel werk. Een paar voorbeelden:</p>
        <ul class="list-disc list-inside text-white/70 mb-6 space-y-1">
          <li>Nieuwsberichten schrijven</li>
          <li>Modellen maken en bijwerken</li>
          <li>Wetenschappelijke artikelen en andere publicaties (HR-tijdschriften, krant)</li>
          <li>Klanten bezoeken en naar netwerkbijeenkomsten gaan</li>
          <li>Ontwikkelen van nieuwe diensten en initiatieven (bijv. WorkxIN en WorkxAcademy)</li>
          <li>Content op LinkedIn plaatsen</li>
        </ul>

        <h3>10.7 Inschakelen derden</h3>
        <p class="text-white/70 mb-4">We werken regelmatig samen met partijen als KWPS, Van Loman, Atlas en Zumpolle advocaten voor fiscale-, pensioen- en/of sociaalzekerheidsrechtelijke vraagstukken. Prima partijen, maar pak dit zorgvuldig aan: doorloop het stappenplan/checklist "Inschakelen derden" voordat je zo'n partij inschakelt.</p>
        <p class="text-white/70">Doen we een zaak waarbij de klant verzekerd is voor rechtsbijstand en de vraag opkomt of we op basis van een fixed fee of aangepast tarief werken én hoe de facturatie verloopt? Stem dat af met Jochem.</p>
      `,
    },
    {
      id: 'tot-slot',
      title: 'Tot slot',
      icon: '📌',
      content: `
        <h3>11.1 Voorrang</h3>
        <p class="text-white/70 mb-6">Als er onderdelen van dit document strijdig zijn met je arbeidsovereenkomst, dan prevaleren de afspraken in je arbeidsovereenkomst.</p>

        <h3>11.2 Wijziging</h3>
        <p class="text-white/70">Workx blijft in ontwikkeling. We vinden het belangrijk om flexibel te blijven en waar nodig onderdelen van dit document aan te passen. We behouden daarom graag het recht voor om dit document eenzijdig te wijzigen.</p>
      `,
    },
    {
      id: 'declaraties',
      title: 'Declaraties',
      icon: '🧾',
      content: `
        <h3>12.1 Onkosten declareren</h3>
        <p class="text-white/70 mb-4">Maak je onkosten voor het werk (een treinreis, een attentie voor een klant, een lunch met een netwerkrelatie, etc.), dan kun je die declareren via het dashboard onder <strong>Declaraties</strong>. Hanna verwerkt de declaraties en betaalt ze uit op het bij ons bekende rekeningnummer.</p>
        <p class="text-white/70 mb-6">Voeg per onkostenpost een <strong>bonnetje of factuur</strong> als bijlage toe — zonder onderbouwing kunnen we niet uitbetalen.</p>

        <h3>12.2 Soorten declaraties</h3>
        <ul class="list-disc list-inside text-white/70 mb-6 space-y-1">
          <li><strong>Overige onkosten</strong>: bonnen, attenties, taxi, parkeren, etc. Vul bedrag + omschrijving + bijlage in.</li>
          <li><strong>Reiskosten auto</strong>: voer het aantal kilometers in, het bedrag wordt automatisch berekend op basis van het kilometertarief.</li>
          <li><strong>Doorbelasten aan klant</strong>: als de onkost rechtstreeks aan een dossier kan worden doorbelast, vul je de zaak/klant in. Wordt mee op de factuur gezet.</li>
        </ul>

        <h3>12.3 Status en uitbetaling</h3>
        <p class="text-white/70 mb-4">Na indienen krijgt je declaratie de status <strong>ingediend</strong>. Hanna controleert en zet hem op <strong>betaald</strong> na overboeking. Je kunt de status terugzien op je eigen declaraties-pagina.</p>
        <p class="text-white/70 mb-6">Wacht niet te lang met indienen: doe het bij voorkeur binnen <strong>één maand</strong> nadat je de kosten hebt gemaakt, zodat we niets vergeten en de administratie netjes per maand kan worden afgesloten.</p>
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

// Kantoorhandboek 2012
export const KANTOORHANDBOEK: Document = {
  id: 'kantoorhandboek',
  title: 'Kantoorhandboek',
  description: 'Vakbekwaamheid en kantoororganisatie',
  icon: '📋',
  lastUpdated: '2012',
  chapters: [
    {
      id: 'inleiding',
      title: 'Inleiding',
      icon: '📖',
      content: `
        <p class="text-white/70 mb-4">Met ingang van 1 juli 2010 is de Verordening op de vakbekwaamheid in werking getreden. Deze Verordening is vastgesteld door de Nederlandse Orde van Advocaten. Op grond van artikel 2 van deze Verordening dienen alle advocaten vakbekwaam te zijn.</p>
        <p class="text-white/70 mb-4">Tevens dient een advocaat alleen zaken aan te nemen die hij gelet op zijn kantoororganisatie adequaat kan behandelen en waarvoor hij de deskundigheid bezit dan wel gebruik maakt van de deskundigheid van derden. Alle advocaten dienen schriftelijk vast te leggen op welke wijze aan deze vereisten wordt voldaan. Dit wordt in dit kantoorhandboek vastgelegd.</p>
        <p class="text-white/70 mb-4">Dit kantoorhandboek is van toepassing bij de behandeling van alle zaken door Workx advocaten. Iedere klant heeft het recht op zo veel mogelijk informatie over de deskundigheid van de voor Workx advocaten werkzame advocaten en over de kantoororganisatie.</p>
        <p class="text-white/70">Indien u na lezing van dit kantoorhandboek nog vragen heeft, horen wij dit graag van u.</p>
      `,
    },
    {
      id: 'vakbekwaamheid',
      title: 'Verordening op de vakbekwaamheid',
      icon: '🎓',
      content: `
        <p class="text-white/70 italic mb-6">"De advocaat dient vakbekwaam te zijn."</p>

        <h3>Opleiding</h3>
        <p class="text-white/70 mb-4">Dat advocaten moeten voldoen aan bepaalde jaarlijkse opleidings- en kwaliteitseisen is niet nieuw. Om advocaat te worden dienen de eerste drie jaren als advocaat-stagiaire te worden gewerkt onder leiding van een patroon, in welke periode de beroepsopleiding moeten worden voltooid.</p>

        <p class="text-white/70 mb-4">Elke advocaat dient jaarlijks zijn/haar vakkennis bij te houden. Vanaf 1 juli 2010 moet elke advocaat jaarlijks <strong>20 studiepunten</strong> behalen, waarin zijn professionele kennis en kunde wordt onderhouden en/of ontwikkeld.</p>

        <p class="text-white/70 mb-4">Workx advocaten heeft zich gespecialiseerd in het <strong>arbeidsrecht</strong>. Alle advocaten hebben de specialisatie opleiding PALA (Post academische leergang arbeidsrecht) afgerond. Zij zijn allen lid van de Vereniging Arbeidsrecht Advocaten Nederland (VAAN) en Vereniging Arbeidsrecht Advocaten Amsterdam (VAAA).</p>

        <p class="text-white/70">Op het gebied van arbeidsrecht worden jaarlijks meerdere cursussen gevolgd. De VAAN verplicht een minimum van <strong>12 punten</strong> op het gebied van arbeidsrecht.</p>
      `,
    },
    {
      id: 'kantoororganisatie',
      title: 'Kantoororganisatie',
      icon: '🏢',
      content: '<!--component:kantoororganisatie-->',
    },
    {
      id: 'wwft',
      title: 'Wwft',
      icon: '⚖️',
      content: '<!--component:wwft-->',
    },
    {
      id: 'derdengelden',
      title: 'Stichting Derdengelden',
      icon: '🏦',
      content: `
        <p class="text-white/70 mb-4">De praktijk van een advocaat kan met zich meebrengen dat gedurende langere of kortere termijn gelden aan hem worden toevertrouwd die bestemd zijn of zullen worden voor anderen. Het beheren van deze gelden vereist nauwkeurigheid en oplettendheid.</p>

        <p class="text-white/70 mb-4">Ter bescherming van de rechthebbende personen op deze gelden is de advocaat verplicht deze gelden onder te brengen in een aparte rechtspersoon, te weten een stichting, genaamd "Stichting Derdengelden". Controle op deze Stichting worden uitgeoefend door de Nederlandse Orde van Advocaten.</p>

        <div class="bg-workx-lime/10 border border-workx-lime/20 rounded-lg p-4">
          <p class="text-workx-lime font-semibold mb-2">Stichting Derdengelden Workx advocaten</p>
          <p class="text-white/70">ABN AMRO: 42.90.17.162</p>
          <p class="text-white/70">IBAN: NL67ABNA0429017162</p>
        </div>
      `,
    },
    {
      id: 'tot-slot',
      title: 'Tot slot',
      icon: '✅',
      content: `
        <p class="text-white/70 mb-4">Het is altijd mogelijk onze dienstverlening te verbeteren. Workx advocaten is daarom altijd geïnteresseerd in suggestief ten aanzien van verbetering van haar dienstverlening.</p>
        <p class="text-white/70">Workx advocaten tracht eventuele misverstanden of problemen met een cliënt in een zo vroeg mogelijk stadium te bespreken en zo mogelijk op te lossen. Een goede communicatie met korte lijnen en een persoonlijk gesprek zorgt in de meeste situaties voor een prettige werksfeer voor zowel de advocaat als de cliënt en helpt problemen voorkomen.</p>
      `,
    },
  ],
}

// Kantoorklachtenregeling
export const KLACHTENREGELING: Document = {
  id: 'klachtenregeling',
  title: 'Kantoorklachtenregeling',
  description: 'Procedure voor klachtafhandeling',
  icon: '📝',
  lastUpdated: '2024',
  chapters: [
    {
      id: 'begripsbepalingen',
      title: 'Artikel 1 - Begripsbepalingen',
      icon: '📋',
      content: `
        <p class="text-white/70 mb-4">In deze kantoorklachtenregeling wordt verstaan onder:</p>
        <ul class="list-disc list-inside text-white/70 space-y-2">
          <li><strong>klacht:</strong> iedere schriftelijke uiting van ongenoegen van of namens de cliënt jegens de advocaat of de onder diens verantwoordelijkheid werkzame personen over de totstandkoming en de uitvoering van een overeenkomst van opdracht, de kwaliteit van de dienstverlening of de hoogte van de declaratie</li>
          <li><strong>klager:</strong> de cliënt of diens vertegenwoordiger die een klacht kenbaar maakt</li>
          <li><strong>klachtenfunctionaris:</strong> de advocaat die is belast met de afhandeling van de klacht</li>
        </ul>
      `,
    },
    {
      id: 'toepassingsbereik',
      title: 'Artikel 2 - Toepassingsbereik',
      icon: '📐',
      content: `
        <ol class="list-decimal list-inside text-white/70 space-y-4">
          <li>Deze kantoorklachtenregeling is van toepassing op iedere overeenkomst van opdracht tussen Workx advocaten B.V. en de cliënt.</li>
          <li>Iedere advocaat van Workx advocaten draagt zorg voor klachtafhandeling conform de kantoorklachtenregeling.</li>
        </ol>
      `,
    },
    {
      id: 'doelstellingen',
      title: 'Artikel 3 - Doelstellingen',
      icon: '🎯',
      content: `
        <p class="text-white/70 mb-4">Deze kantoorklachtenregeling heeft tot doel:</p>
        <ul class="list-disc list-inside text-white/70 space-y-2">
          <li>het vastleggen van een procedure om klachten van cliënten binnen een redelijke termijn op een constructieve wijze af te handelen</li>
          <li>behoud en verbetering van bestaande relaties door middel van goede klachtenbehandeling en verbetering van de kwaliteit van de dienstverlening</li>
        </ul>
      `,
    },
    {
      id: 'informatie',
      title: 'Artikel 4 - Informatie bij aanvang',
      icon: 'ℹ️',
      content: `
        <p class="text-white/70">Deze kantoorklachtenregeling is openbaar gemaakt. De advocaat wijst de cliënt voor het aangaan van de overeenkomst van opdracht erop dat het kantoor een kantoorklachtenregeling hanteert en dat deze van toepassing is op de dienstverlening.</p>
      `,
    },
    {
      id: 'klachtprocedure',
      title: 'Artikel 5 - Klachtprocedure',
      icon: '📑',
      content: `
        <ol class="list-decimal list-inside text-white/70 space-y-4">
          <li>Indien een cliënt het kantoor benadert met een klacht, dan wordt de klacht doorgeleid naar de klachtenfunctionaris.</li>
          <li>De klachtenfunctionaris stelt degene over wie is geklaagd in kennis van het indienen van de klacht en stelt de klager en degene over wie is geklaagd in de gelegenheid een toelichting te geven op de klacht.</li>
          <li>Degene over wie is geklaagd tracht samen met de cliënt tot een oplossing te komen, al dan niet na tussenkomst van de klachtenfunctionaris.</li>
          <li>De klachtenfunctionaris handelt de klacht af binnen <strong>vier weken</strong> na ontvangst van de klacht of doet met opgave van redenen mededeling aan de klager over afwijking van deze termijn met vermelding van de termijn waarbinnen wel een oordeel over de klacht wordt gegeven.</li>
          <li>De klachtenfunctionaris stelt de klager en degene over wie is geklaagd schriftelijk op de hoogte van het oordeel over de gegrondheid van de klacht, al dan niet vergezeld van aanbevelingen.</li>
          <li>Indien de klacht naar tevredenheid is afgehandeld, tekenen de klager, de klachtenfunctionaris en degene over wie is geklaagd het oordeel over de gegrondheid van de klacht.</li>
          <li>Mocht de klager niet tevreden zijn, bestaat de mogelijkheid om onoplosbare problemen voor te leggen aan de <strong>Geschillencommissie Advocatuur</strong>.</li>
          <li>Het Reglement Geschillencommissie Advocatuur wordt op verzoek van de klager toegezonden en is tevens te vinden op <a href="https://www.geschillencommissie.nl" target="_blank" class="text-workx-lime hover:underline">www.geschillencommissie.nl</a>.</li>
        </ol>
      `,
    },
    {
      id: 'geheimhouding',
      title: 'Artikel 6 - Geheimhouding en kosten',
      icon: '🔒',
      content: `
        <ol class="list-decimal list-inside text-white/70 space-y-4">
          <li>De klachtenfunctionaris en degene over wie is geklaagd nemen bij de klachtbehandeling geheimhouding in acht.</li>
          <li>De klager is <strong>geen vergoeding</strong> verschuldigd voor de kosten van de behandeling van de klacht.</li>
        </ol>
      `,
    },
    {
      id: 'verantwoordelijkheden',
      title: 'Artikel 7 - Verantwoordelijkheden',
      icon: '👥',
      content: `
        <ol class="list-decimal list-inside text-white/70 space-y-4">
          <li>De klachtenfunctionaris is verantwoordelijk voor de tijdige afhandeling van de klacht.</li>
          <li>Degene over wie is geklaagd houdt de klachtenfunctionaris op de hoogte over eventueel contact en een mogelijke oplossing.</li>
          <li>De klachtenfunctionaris houdt de klager op de hoogte over de afhandeling van de klacht.</li>
          <li>De klachtenfunctionaris houdt het klachtdossier bij.</li>
        </ol>
      `,
    },
    {
      id: 'registratie',
      title: 'Artikel 8 - Klachtregistratie',
      icon: '📊',
      content: `
        <ol class="list-decimal list-inside text-white/70 space-y-4">
          <li>De klachtenfunctionaris registreert de klacht met daarbij het klachtonderwerp.</li>
          <li>De klachtenfunctionaris brengt periodiek verslag uit over de afhandeling van de klachten en doet aanbevelingen ter voorkoming van nieuwe klachten, alsmede ter verbetering van procedures.</li>
          <li>Minimaal eenmaal per jaar wordt de verslagen en de aanbevelingen op het kantoor besproken en ter besluitvorming voorgelegd.</li>
        </ol>
      `,
    },
  ],
}


// Stappenplan partner — rendert dynamisch via StappenplanView component.
// De chapter-content bevat een marker die de hr-docs page herkent.
export const STAPPENPLAN_PARTNER: Document = {
  id: 'stappenplan-partner',
  title: 'Stappenplan Counsel naar Partner',
  description: 'Drie-staps groeipad: Counsel → Director → Partner',
  icon: '🚀',
  lastUpdated: '2026',
  chapters: [
    {
      id: 'stappenplan-content',
      title: 'Stappenplan',
      icon: '🚀',
      content: '<!--component:stappenplan-->',
    },
  ],
}

// Salarishuis — alleen bruto maandsalaris per ervaringsjaar.
export const SALARISHUIS: Document = {
  id: 'salarishuis',
  title: 'Salarishuis',
  description: 'Indicatief bruto maandsalaris per ervaringsjaar',
  icon: '💶',
  lastUpdated: '2026',
  chapters: [
    {
      id: 'salarishuis-content',
      title: 'Salarishuis',
      icon: '💶',
      content: '<!--component:salarishuis-->',
    },
  ],
}

// Tarieven — standaard uurtarieven per ervaringsjaar + afwijkende klant-tarieven.
export const TARIEVEN: Document = {
  id: 'tarieven',
  title: 'Tarieven',
  description: 'Standaard uurtarieven per ervaringsjaar + afwijkende klant-tarieven',
  icon: '💰',
  lastUpdated: '2026',
  chapters: [
    {
      id: 'tarieven-content',
      title: 'Tarieven',
      icon: '💰',
      content: '<!--component:tarieven-->',
    },
  ],
}

// Wachtwoorden — gedeelde inloggegevens + belangrijke services.
export const WACHTWOORDEN: Document = {
  id: 'wachtwoorden',
  title: 'Wachtwoorden',
  description: 'Gedeelde inloggegevens en belangrijke services',
  icon: '🔐',
  lastUpdated: '2026',
  chapters: [
    {
      id: 'wachtwoorden-content',
      title: 'Wachtwoorden',
      icon: '🔐',
      content: '<!--component:wachtwoorden-->',
    },
  ],
}

// All documents array — volgorde: standaard docs eerst, dan reference/tabellen onderaan
export const DOCUMENTS: Document[] = [
  THE_WAY_IT_WORKX,
  KANTOORHANDBOEK,
  KLACHTENREGELING,
  WACHTWOORDEN,
  SALARISHUIS,
  TARIEVEN,
  STAPPENPLAN_PARTNER,
]
