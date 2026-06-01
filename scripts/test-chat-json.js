/**
 * Test the new non-streaming JSON chat endpoint
 * Simulates exactly what the browser ClaudeChat component does
 */
const https = require('https')
const BASE_URL = 'https://workx-dashboard.vercel.app'

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const req = https.request(parsedUrl, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      const cookies = res.headers['set-cookie'] || []
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, data, cookies }))
    })
    req.on('error', reject)
    req.setTimeout(90000, () => { req.destroy(); reject(new Error('Timeout')) })
    if (options.body) req.write(options.body)
    req.end()
  })
}

function parseCookies(h) {
  const c = {}
  for (const s of h) { const [kv] = s.split(';'); const [k,...v] = kv.split('='); c[k.trim()] = v.join('=') }
  return c
}
function cs(c) { return Object.entries(c).map(([k,v]) => `${k}=${v}`).join('; ') }

async function main() {
  console.log('=== JSON CHAT TEST ===\n')

  // Login
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`)
  const { csrfToken } = JSON.parse(csrfRes.data)
  const cookies = parseCookies(csrfRes.cookies)

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cs(cookies) },
    body: `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent('jochem.deroos@workxadvocaten.nl')}&password=${encodeURIComponent('Amsterdam24!')}&json=true`,
  })
  Object.assign(cookies, parseCookies(loginRes.cookies))
  console.log('Logged in\n')

  const tests = [
    ['Simpel', 'Wat is 2+2? Alleen het getal.'],
    ['Juridisch', 'Noem 3 gronden voor ontslag via de kantonrechter.'],
    ['Web search', 'Zoek op rechtspraak.nl naar een recente uitspraak over concurrentiebeding.'],
  ]

  let passed = 0
  for (const [name, msg] of tests) {
    console.log(`--- ${name} ---`)
    const start = Date.now()

    const res = await fetch(`${BASE_URL}/api/claude/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cs(cookies) },
      body: JSON.stringify({ message: msg }),
    })

    const duration = ((Date.now() - start) / 1000).toFixed(1)

    if (res.status !== 200) {
      console.log(`  FAIL: HTTP ${res.status}: ${res.data.slice(0, 200)}`)
      continue
    }

    const data = JSON.parse(res.data)
    console.log(`  Time: ${duration}s`)
    console.log(`  Content: ${data.content?.length || 0} chars`)
    console.log(`  ConvID: ${data.conversationId}`)
    console.log(`  Web search: ${data.hasWebSearch}`)
    console.log(`  Citations: ${data.citations?.length || 0}`)
    console.log(`  Preview: ${(data.content || '').slice(0, 150).replace(/\n/g, '\\n')}`)

    if (data.content?.length > 0) {
      console.log(`  PASS`)
      passed++
    } else {
      console.log(`  FAIL: Empty content`)
    }
    console.log()

    await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`=== ${passed}/${tests.length} PASSED ===`)
  process.exit(passed === tests.length ? 0 : 1)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
