const fs = require('fs'), path = require('path')
function le(f) { try { for (const l of fs.readFileSync(f, 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim(); if ((v[0] === '"' && v.slice(-1) === '"') || (v[0] === "'" && v.slice(-1) === "'")) v = v.slice(1, -1); if (!process.env[k]) process.env[k] = v } } catch {} }
le(path.join(__dirname, '..', '.env.local'))
le(path.join(__dirname, '..', '.env'))
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
p.aISource.findUnique({ where: { id: 'cmlcq12aj0001jmy15c7x98if' }, select: { id: true, name: true, url: true, credentials: true } }).then(s => {
  const c = s.credentials ? JSON.parse(s.credentials) : {}
  console.log('Bron:', s.name)
  console.log('URL:', s.url)
  console.log('Email:', c.email || 'GEEN')
  console.log('Heeft wachtwoord:', !!c.password)
  p.$disconnect()
}).catch(e => { console.error(e); process.exit(1) })
