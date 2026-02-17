/**
 * Script: Volledige PDF tekst extracten en als chunks opslaan
 *
 * Gebruik:
 *   node scripts/ingest-pdf-source.js <pdf-pad> <bron-naam>
 *
 * Voorbeeld:
 *   node scripts/ingest-pdf-source.js "C:/Users/quiri/Desktop/T&C_Arbeidsrecht_2024_V1.pdf" "Tekst en Commentaar Arbeidsrecht 2024"
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();
const CHUNK_SIZE = 5000;

// Heading detection patterns for legal texts
const HEADING_PATTERN = /^(#{1,4}\s|Artikel\s+\d|Art\.\s*\d|Afdeling\s+\d|Titel\s+\d|Boek\s+\d|Hoofdstuk\s+\d|\d+\.\d+[\s.]|[A-Z][A-Z\s]{5,}$)/;

async function extractPdf(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  console.log(`PDF: ${pdfPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);

  let getDocument;
  try {
    const mod = require('pdfjs-dist/legacy/build/pdf.mjs');
    getDocument = mod.getDocument;
  } catch {
    const mod = require('pdfjs-dist');
    getDocument = mod.getDocument;
  }

  const uint8 = new Uint8Array(buffer);
  const doc = await getDocument({ data: uint8, useSystemFonts: true, disableFontFace: true, isEvalSupported: false }).promise;
  console.log(`Pagina's: ${doc.numPages}`);

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    if (pageText.trim()) pages.push(pageText.trim());
    if (i % 200 === 0) console.log(`  ${i}/${doc.numPages} pagina's verwerkt...`);
  }

  return pages.join('\n\n');
}

function splitIntoSmartChunks(text) {
  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = '';
  let currentHeading = null;

  for (const line of lines) {
    const isHeading = HEADING_PATTERN.test(line.trim());

    if (isHeading && currentChunk.length > CHUNK_SIZE * 0.3) {
      if (currentChunk.trim()) {
        chunks.push({ content: currentChunk.trim(), heading: currentHeading });
      }
      currentChunk = line + '\n';
      currentHeading = line.trim().slice(0, 200);
      continue;
    }

    currentChunk += line + '\n';

    if (currentChunk.length >= CHUNK_SIZE) {
      const lastParagraph = currentChunk.lastIndexOf('\n\n', CHUNK_SIZE);
      const lastSentence = currentChunk.lastIndexOf('. ', CHUNK_SIZE);
      const splitPoint = lastParagraph > CHUNK_SIZE * 0.5
        ? lastParagraph
        : lastSentence > CHUNK_SIZE * 0.5
          ? lastSentence + 2
          : CHUNK_SIZE;

      chunks.push({
        content: currentChunk.slice(0, splitPoint).trim(),
        heading: currentHeading,
      });
      currentChunk = currentChunk.slice(splitPoint).trim() + '\n';
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), heading: currentHeading });
  }

  return chunks;
}

async function main() {
  const pdfPath = process.argv[2];
  const sourceName = process.argv[3];

  if (!pdfPath || !sourceName) {
    console.error('Gebruik: node scripts/ingest-pdf-source.js <pdf-pad> <bron-naam>');
    console.error('Voorbeeld: node scripts/ingest-pdf-source.js "pad/naar/boek.pdf" "Tekst en Commentaar Arbeidsrecht 2024"');
    process.exit(1);
  }

  // 1. Extract text from PDF
  console.log('\n=== STAP 1: PDF tekst extracten ===');
  const fullText = await extractPdf(pdfPath);
  console.log(`Geëxtraheerd: ${fullText.length} tekens (${Math.round(fullText.length / 3.5)} geschatte tokens)`);

  // 2. Find or validate the source in the database
  console.log('\n=== STAP 2: Bron in database zoeken ===');
  let source = await prisma.aISource.findFirst({
    where: { name: { contains: sourceName, mode: 'insensitive' } },
  });

  if (source) {
    console.log(`Bestaande bron gevonden: "${source.name}" (id: ${source.id})`);
    // Update content with full text
    await prisma.aISource.update({
      where: { id: source.id },
      data: {
        content: fullText,
        isProcessed: true,
        processedAt: new Date(),
      },
    });
    console.log(`Content bijgewerkt: ${fullText.length} tekens`);
  } else {
    console.log(`Geen bestaande bron gevonden voor "${sourceName}", nieuwe aanmaken...`);
    source = await prisma.aISource.create({
      data: {
        name: sourceName,
        type: 'document',
        category: 'arbeidsrecht',
        content: fullText,
        isActive: true,
        isProcessed: true,
        processedAt: new Date(),
        userId: (await prisma.user.findFirst({ where: { role: 'PARTNER' } }))?.id || 'system',
      },
    });
    console.log(`Nieuwe bron aangemaakt: id ${source.id}`);
  }

  // 3. Delete existing chunks and create new ones
  console.log('\n=== STAP 3: Chunks aanmaken ===');
  const deleted = await prisma.sourceChunk.deleteMany({ where: { sourceId: source.id } });
  if (deleted.count > 0) console.log(`${deleted.count} oude chunks verwijderd`);

  const chunks = splitIntoSmartChunks(fullText);
  console.log(`Tekst opgesplitst in ${chunks.length} chunks (gem. ${Math.round(fullText.length / chunks.length)} tekens/chunk)`);

  // Batch insert in groups of 100
  let inserted = 0;
  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100);
    await prisma.sourceChunk.createMany({
      data: batch.map((chunk, idx) => ({
        sourceId: source.id,
        chunkIndex: i + idx,
        content: chunk.content,
        heading: chunk.heading || null,
      })),
    });
    inserted += batch.length;
    if (inserted % 200 === 0) console.log(`  ${inserted}/${chunks.length} chunks opgeslagen...`);
  }

  console.log(`\n=== KLAAR ===`);
  console.log(`Bron: "${source.name}"`);
  console.log(`Totale tekst: ${fullText.length} tekens`);
  console.log(`Chunks: ${chunks.length}`);
  console.log(`Klaar voor slim ophalen in de AI Assistent`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fout:', err);
  process.exit(1);
});
