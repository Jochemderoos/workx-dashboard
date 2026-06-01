const eclis = [
  { ecli: 'ECLI:NL:HR:2017:1187', claim: 'Stoof/Mammoet - ernstige verwijtbaarheid' },
  { ecli: 'ECLI:NL:HR:2010:BK4472', claim: 'Briljant Schoenen - g-grond verstoring' },
  { ecli: 'ECLI:NL:HR:2008:BD2763', claim: 'cao-bepaling afbouw toeslag' },
  { ecli: 'ECLI:NL:HR:2005:AT1797', claim: 'valse declaraties - ernstig verwijtbaar' },
  { ecli: 'ECLI:NL:HR:2010:BK4473', claim: 'integriteitsschendingen zwaarder dan dienstverband' },
  { ecli: 'ECLI:NL:GHSHE:2019:3194', claim: 'terecht beschuldigen frauduleus handelen' },
  { ecli: 'ECLI:NL:GHARL:2019:5891', claim: 'goedkeuren overuren niet automatisch gewerkt' },
  { ecli: 'ECLI:NL:GHSHE:2019:4197', claim: 'toeslag voorwaardelijk kan niet onvoorwaardelijk' },
  { ecli: 'ECLI:NL:GHAMS:2019:4788', claim: 'schorsing bij verdenking fraude' },
  { ecli: 'ECLI:NL:GHDHA:2019:542', claim: 'declareren niet-gewerkte uren integriteitsschending' },
  { ecli: 'ECLI:NL:GHAMS:2019:891', claim: 'systematische fraude langere periode' },
  { ecli: 'ECLI:NL:GHSHE:2019:2445', claim: 'fraude geen waarschuwing vereist' },
  { ecli: 'ECLI:NL:GHAMS:2019:1357', claim: 'fraude geen inzicht verstoring duurzaam' },
  { ecli: 'ECLI:NL:GHSHE:2020:331', claim: 'verstoring door werknemer aan hem toe te rekenen' },
  { ecli: 'ECLI:NL:GHAMS:2019:3456', claim: 'fraude geen transitievergoeding' },
];

async function verify() {
  let found = 0;
  let notFound = 0;
  let mismatch = 0;

  for (const { ecli, claim } of eclis) {
    try {
      const res = await fetch(
        'https://data.rechtspraak.nl/uitspraken/content?id=' + encodeURIComponent(ecli),
        { headers: { Accept: 'application/xml' }, signal: AbortSignal.timeout(8000) }
      );
      if (res.status === 404 || res.status >= 400) {
        console.log('NIET GEVONDEN: ' + ecli + ' (claim: ' + claim + ') -> HTTP ' + res.status);
        notFound++;
        continue;
      }
      const xml = await res.text();
      if (xml.includes('<error>') || xml.length < 200) {
        console.log('NIET GEVONDEN: ' + ecli + ' (claim: ' + claim + ') -> lege/error response');
        notFound++;
        continue;
      }
      const titleMatch = xml.match(/<dcterms:title[^>]*>([\s\S]*?)<\/dcterms:title>/i);
      const abstractMatch = xml.match(/<dcterms:abstract[^>]*>([\s\S]*?)<\/dcterms:abstract>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 150) : '(geen titel)';
      const abstract = abstractMatch ? abstractMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 300) : '(geen samenvatting)';
      found++;
      console.log('GEVONDEN: ' + ecli);
      console.log('  Claim in advies: ' + claim);
      console.log('  Echte titel: ' + title);
      console.log('  Samenvatting: ' + abstract);
      console.log();
    } catch (e) {
      console.log('FOUT: ' + ecli + ' -> ' + e.message);
    }
  }

  console.log('\n=== SAMENVATTING ===');
  console.log('Gevonden: ' + found + '/' + eclis.length);
  console.log('Niet gevonden: ' + notFound + '/' + eclis.length);
}

verify();
