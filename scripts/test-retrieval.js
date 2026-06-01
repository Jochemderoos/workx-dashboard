const fs = require('fs'), path = require('path')
function le(f){try{for(const l of fs.readFileSync(f,'utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i<0)continue;const k=t.slice(0,i).trim();let v=t.slice(i+1).trim();if((v[0]==='"'&&v.slice(-1)==='"')||(v[0]==="'"&&v.slice(-1)==="'"))v=v.slice(1,-1);if(!process.env[k])process.env[k]=v}}catch{}}
le(path.join(__dirname,'..', '.env.local'));le(path.join(__dirname,'..', '.env'))

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 32000),
      dimensions: 1536,
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Embedding API error (${response.status}): ${error}`);
  }
  const data = await response.json();
  return data.data[0].embedding;
}

async function main() {
  const query = 'concurrentiebeding';
  console.log(`\n=== Testing retrieval for: "${query}" ===\n`);

  // 1. Get all active AI sources
  const sources = await prisma.aISource.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true }
  });
  console.log(`Active AI sources: ${sources.length}`);
  for (const s of sources) {
    console.log(`  - [${s.type}] ${s.name} (${s.id})`);
  }

  const sourceIds = sources.map(s => s.id);

  // 2. Generate embedding for the query
  console.log(`\nGenerating embedding for "${query}"...`);
  const embedding = await generateEmbedding(query);
  console.log(`Embedding dimension: ${embedding.length}`);

  // 3. Run the same vector similarity search as the chat route
  console.log(`\n=== SEMANTIC (vector) search results ===\n`);
  const vectorResults = await prisma.$queryRawUnsafe(
    `SELECT sc.id, sc."sourceId", sc."chunkIndex", sc.heading, 
            LEFT(sc.content, 100) as preview,
            1 - (sc.embedding <=> $1::vector) as similarity
     FROM "SourceChunk" sc
     WHERE sc."sourceId" = ANY($2::text[])
     AND sc.embedding IS NOT NULL
     ORDER BY sc.embedding <=> $1::vector
     LIMIT 35`,
    `[${embedding.join(',')}]`,
    sourceIds
  );

  console.log(`Total semantic matches returned: ${vectorResults.length}`);

  // Group by source
  const semanticBySource = {};
  for (const r of vectorResults) {
    const src = sources.find(s => s.id === r.sourceId);
    const name = src ? src.name : r.sourceId;
    if (!semanticBySource[name]) semanticBySource[name] = [];
    semanticBySource[name].push(r);
  }

  for (const [name, chunks] of Object.entries(semanticBySource)) {
    console.log(`\n  Source: ${name} -- ${chunks.length} chunks`);
    for (const c of chunks.slice(0, 3)) {
      const sim = typeof c.similarity === 'number' ? c.similarity.toFixed(4) : Number(c.similarity).toFixed(4);
      console.log(`    [sim=${sim}] heading: "${c.heading || '(none)'}"`);
      console.log(`      preview: ${(c.preview || '').replace(/\n/g, ' ').slice(0, 80)}...`);
    }
    if (chunks.length > 3) {
      console.log(`    ... and ${chunks.length - 3} more chunks`);
    }
  }

  // 4. Keyword search
  console.log(`\n\n=== KEYWORD search for "${query}" ===\n`);
  const keywordResults = await prisma.sourceChunk.findMany({
    where: {
      sourceId: { in: sourceIds },
      OR: [
        { content: { contains: query, mode: 'insensitive' } },
        { heading: { contains: query, mode: 'insensitive' } },
      ]
    },
    select: {
      id: true,
      sourceId: true,
      chunkIndex: true,
      heading: true,
      content: true,
    }
  });

  console.log(`Total keyword matches: ${keywordResults.length}`);

  const keywordBySource = {};
  for (const r of keywordResults) {
    const src = sources.find(s => s.id === r.sourceId);
    const name = src ? src.name : r.sourceId;
    if (!keywordBySource[name]) keywordBySource[name] = [];
    keywordBySource[name].push(r);
  }

  for (const [name, chunks] of Object.entries(keywordBySource)) {
    console.log(`\n  Source: ${name} -- ${chunks.length} chunks`);
    for (const c of chunks.slice(0, 3)) {
      console.log(`    heading: "${c.heading || '(none)'}"`);
      const idx = (c.content || '').toLowerCase().indexOf(query.toLowerCase());
      if (idx >= 0) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(c.content.length, idx + query.length + 40);
        const snippet = c.content.slice(start, end).replace(/\n/g, ' ');
        console.log(`      ...${snippet}...`);
      }
    }
    if (chunks.length > 3) {
      console.log(`    ... and ${chunks.length - 3} more chunks`);
    }
  }

  // 5. Summary report
  console.log(`\n\n=== SUMMARY per source ===\n`);
  console.log('Source'.padEnd(50) + 'Semantic'.padEnd(12) + 'Keyword'.padEnd(12) + 'Sample heading');
  console.log('-'.repeat(110));
  for (const s of sources) {
    const semCount = (semanticBySource[s.name] || []).length;
    const kwCount = (keywordBySource[s.name] || []).length;
    const sampleChunks = semanticBySource[s.name] || keywordBySource[s.name] || [];
    const sampleHeading = sampleChunks.length > 0 ? (sampleChunks[0].heading || '(none)') : '--';
    console.log(
      s.name.slice(0, 48).padEnd(50) +
      String(semCount).padEnd(12) +
      String(kwCount).padEnd(12) +
      sampleHeading.slice(0, 50)
    );
  }

  console.log('\nDone.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
