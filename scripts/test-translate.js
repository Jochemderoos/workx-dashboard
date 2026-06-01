const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// Load .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^(\w+)=["']?(.+?)["']?\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DELIM = '¶¶¶';

function decodeXmlEntities(text) {
  return text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}

function extractParagraphTexts(xml) {
  const texts = [];
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let match;
  while ((match = pRegex.exec(xml)) !== null) {
    const parts = [];
    const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(match[0])) !== null) {
      parts.push(decodeXmlEntities(tMatch[1]));
    }
    texts.push(parts.join(''));
  }
  return texts;
}

async function callClaude(prompt, maxTokens = 8192) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err.substring(0, 200)}`);
  }
  const data = await res.json();
  console.log('  stop_reason:', data.stop_reason, 'output_tokens:', data.usage.output_tokens);
  return data.content[0].text;
}

async function translateChunk(texts) {
  const numbered = texts.map((t, i) => `[${i}] ${t}`).join('\n');
  const prompt = `Vertaal elke genummerde regel hieronder naar het Engels.
Geef elke vertaling op een aparte regel, gescheiden door exact "${DELIM}" op een eigen regel.
Geef GEEN nummers, GEEN uitleg, ALLEEN de vertalingen gescheiden door ${DELIM}.
Gebruik professioneel juridisch taalgebruik waar van toepassing.

${numbered}`;

  const result = await callClaude(prompt);
  const parts = result.split(DELIM).map(s => s.trim()).filter(s => s.length > 0);
  console.log(`  Got ${parts.length} parts (expected ${texts.length})`);

  // Pad/truncate to match
  while (parts.length < texts.length) parts.push(texts[parts.length]);
  if (parts.length > texts.length) parts.length = texts.length;
  return parts;
}

async function main() {
  if (!ANTHROPIC_API_KEY) { console.error('No API key'); process.exit(1); }

  const prisma = new PrismaClient();
  const doc = await prisma.aIDocument.findFirst({
    orderBy: { createdAt: 'desc' },
    where: { fileType: 'docx' },
    select: { id: true, name: true, fileType: true, fileUrl: true }
  });
  if (!doc || !doc.fileUrl) { console.log('No DOCX'); return; }

  console.log('Document:', doc.name);
  const match = doc.fileUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) { console.log('No base64'); return; }

  const AdmZip = require('adm-zip');
  const buf = Buffer.from(match[1], 'base64');
  const zip = new AdmZip(buf);
  const docXml = zip.readAsText('word/document.xml');
  const allTexts = extractParagraphTexts(docXml);
  const nonEmpty = allTexts.filter(t => t.trim());
  console.log('Non-empty paragraphs:', nonEmpty.length);

  // Process in chunks of 30
  const chunkSize = 30;
  const chunks = [];
  for (let i = 0; i < nonEmpty.length; i += chunkSize) {
    chunks.push(nonEmpty.slice(i, i + chunkSize));
  }
  console.log('Chunks:', chunks.length);

  const t0 = Date.now();
  const results = await Promise.all(chunks.map((chunk, i) => {
    console.log(`Chunk ${i}: ${chunk.length} paragraphs`);
    return translateChunk(chunk);
  }));

  const allTranslated = results.flat();
  console.log('\nTotal time:', Date.now() - t0, 'ms');
  console.log('Total translated:', allTranslated.length, '/', nonEmpty.length);
  console.log('\nFirst 3 translations:');
  allTranslated.slice(0, 3).forEach((t, i) => console.log(`  [${i}] ${t.substring(0, 80)}`));
  console.log('\nSUCCESS');

  await prisma.$disconnect();
}

main().catch(e => console.error('Fatal:', e.message));
