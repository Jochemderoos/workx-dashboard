/**
 * Comprehensive test for the AI Chat JSON endpoint
 * Tests: auth, simple question, legal question, web search, error handling
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
    req.setTimeout(options.timeout || 90000, () => { req.destroy(); reject(new Error('Client timeout')) })
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

async function login() {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`)
  const { csrfToken } = JSON.parse(csrfRes.data)
  const cookies = parseCookies(csrfRes.cookies)

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cs(cookies) },
    body: `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent('jochem.deroos@workxadvocaten.nl')}&password=${encodeURIComponent('Amsterdam24!')}&json=true`,
  })
  Object.assign(cookies, parseCookies(loginRes.cookies))
  return cookies
}

async function chatRequest(cookies, message, timeout = 90000) {
  const start = Date.now()
  const res = await fetch(`${BASE_URL}/api/claude/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cs(cookies) },
    body: JSON.stringify({ message }),
    timeout,
  })
  const duration = ((Date.now() - start) / 1000).toFixed(1)
  return { ...res, duration }
}

async function test(name, fn) {
  process.stdout.write(`  ${name}... `)
  try {
    await fn()
    console.log('PASS')
    return true
  } catch (err) {
    console.log(`FAIL: ${err.message}`)
    return false
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg)
}

async function main() {
  console.log('=== COMPREHENSIVE AI CHAT TEST ===\n')

  // Login
  console.log('1. Authentication')
  const cookies = await login()
  console.log('  Logged in OK\n')

  let passed = 0, total = 0

  // Test 1: Simple question
  console.log('2. Simple question (no web search)')
  total++
  if (await test('Returns valid JSON with content', async () => {
    const res = await chatRequest(cookies, 'Wat is 2+2? Alleen het getal.')
    assert(res.status === 200, `Expected 200, got ${res.status}: ${res.data.slice(0, 200)}`)
    const data = JSON.parse(res.data)
    assert(data.content, 'No content in response')
    assert(data.conversationId, 'No conversationId')
    assert(data.content.includes('4'), `Expected "4" in content: "${data.content}"`)
    console.log(`(${res.duration}s, ${data.content.length} chars) `)
  })) passed++

  // Wait between tests to avoid rate limits
  await new Promise(r => setTimeout(r, 3000))

  // Test 2: Legal question with markdown
  console.log('\n3. Legal question (markdown output)')
  total++
  if (await test('Returns structured legal answer', async () => {
    const res = await chatRequest(cookies, 'Wat is de opzegtermijn bij ontslag door werkgever? Geef een kort antwoord.')
    assert(res.status === 200, `Expected 200, got ${res.status}: ${res.data.slice(0, 200)}`)
    const data = JSON.parse(res.data)
    assert(data.content, 'No content')
    assert(data.content.length > 50, `Content too short: ${data.content.length} chars`)
    // Check it mentions Dutch law
    const lc = data.content.toLowerCase()
    assert(lc.includes('opzegtermijn') || lc.includes('bw') || lc.includes('maand'), 'Missing legal context')
    console.log(`(${res.duration}s, ${data.content.length} chars) `)
  })) passed++

  await new Promise(r => setTimeout(r, 3000))

  // Test 3: Empty message (should return 400)
  console.log('\n4. Error handling')
  total++
  if (await test('Rejects empty message', async () => {
    const res = await chatRequest(cookies, '')
    assert(res.status === 400, `Expected 400, got ${res.status}`)
    const data = JSON.parse(res.data)
    assert(data.error, 'No error message')
  })) passed++

  // Test 4: Unauthenticated request
  total++
  if (await test('Rejects unauthenticated request', async () => {
    const res = await fetch(`${BASE_URL}/api/claude/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test' }),
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
    const data = JSON.parse(res.data)
    assert(data.error, 'No error message')
  })) passed++

  // Test 5: Conversation continuity
  console.log('\n5. Conversation continuity')
  total++
  await new Promise(r => setTimeout(r, 3000))
  if (await test('Can continue a conversation', async () => {
    // First message
    const res1 = await chatRequest(cookies, 'Onthoud het getal 42.')
    assert(res1.status === 200, `First message failed: ${res1.status}`)
    const data1 = JSON.parse(res1.data)
    assert(data1.conversationId, 'No conversationId')

    await new Promise(r => setTimeout(r, 3000))

    // Second message in same conversation
    const start = Date.now()
    const res2 = await fetch(`${BASE_URL}/api/claude/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cs(cookies) },
      body: JSON.stringify({ conversationId: data1.conversationId, message: 'Welk getal moest je onthouden?' }),
      timeout: 90000,
    })
    const duration = ((Date.now() - start) / 1000).toFixed(1)
    assert(res2.status === 200, `Second message failed: ${res2.status}: ${res2.data.slice(0, 200)}`)
    const data2 = JSON.parse(res2.data)
    assert(data2.content, 'No content in follow-up')
    assert(data2.content.includes('42'), `Expected "42" in follow-up: "${data2.content.slice(0, 100)}"`)
    console.log(`(${duration}s) `)
  })) passed++

  console.log(`\n=== RESULTS: ${passed}/${total} PASSED ===`)
  process.exit(passed === total ? 0 : 1)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
