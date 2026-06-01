// Deep verify: fetch full ruling text for ECLIs that exist
const eclis = [
  { ecli: 'ECLI:NL:HR:2017:1187', claim: 'Stoof/Mammoet - ernstige verwijtbaarheid e-grond' },
  { ecli: 'ECLI:NL:HR:2010:BK4472', claim: 'Briljant Schoenen - g-grond verstoring arbeidsverhouding' },
  { ecli: 'ECLI:NL:GHSHE:2019:3194', claim: 'werkgever terecht beschuldigt van fraude, niet ernstig verwijtbaar' },
  { ecli: 'ECLI:NL:GHARL:2019:5891', claim: 'goedkeuren overuren betekent niet dat ze gewerkt zijn' },
  { ecli: 'ECLI:NL:GHSHE:2019:4197', claim: 'voorwaardelijke toeslag kan niet onvoorwaardelijk worden door betaling' },
  { ecli: 'ECLI:NL:GHAMS:2019:4788', claim: 'schorsing bij gegronde verdenking fraude is neutrale maatregel' },
  { ecli: 'ECLI:NL:GHDHA:2019:542', claim: 'declareren niet-gewerkte uren is ernstige integriteitsschending' },
];

async function verify() {
  for (const { ecli, claim } of eclis) {
    try {
      const res = await fetch(
        'https://data.rechtspraak.nl/uitspraken/content?id=' + encodeURIComponent(ecli),
        { headers: { Accept: 'application/xml' }, signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) {
        console.log('FOUT: ' + ecli + ' -> HTTP ' + res.status);
        continue;
      }
      const xml = await res.text();

      // Extract key info
      const titleMatch = xml.match(/<dcterms:title[^>]*>([\s\S]*?)<\/dcterms:title>/i);
      const abstractMatch = xml.match(/<dcterms:abstract[^>]*>([\s\S]*?)<\/dcterms:abstract>/i);
      const subjectMatch = xml.match(/<dcterms:subject[^>]*>([\s\S]*?)<\/dcterms:subject>/ig);
      const bodyMatch = xml.match(/<(?:uitspraak|conclusie)[^>]*>([\s\S]*?)<\/(?:uitspraak|conclusie)>/i);

      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '(geen)';
      const abstract = abstractMatch ? abstractMatch[1].replace(/<[^>]+>/g, '').trim() : '(geen)';
      const subjects = subjectMatch ? subjectMatch.map(s => s.replace(/<[^>]+>/g, '').trim()).join(', ') : '(geen)';
      let body = bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '(geen body)';
      body = body.slice(0, 500);

      console.log('=== ' + ecli + ' ===');
      console.log('Claim in advies: ' + claim);
      console.log('Echte titel: ' + title);
      console.log('Rechtsgebieden: ' + subjects);
      console.log('Samenvatting: ' + (abstract === '(geen)' ? '(geen)' : abstract.slice(0, 300)));
      console.log('Begin uitspraak: ' + body);
      console.log();
    } catch (e) {
      console.log('FOUT: ' + ecli + ' -> ' + e.message);
    }
  }
}

verify();
