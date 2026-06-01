/**
 * Deep test for AI Chat - tests complex queries with web search,
 * markdown formatting, and newlines in response
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
      if (options.stream) {
        resolve({ status: res.statusCode, headers: res.headers, stream: res, cookies })
        return
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers, cookies }))
    })
    req.on('error', reject)
    req.setTimeout(90000, () => { req.destroy(); reject(new Error('Timeout')) })
    if (options.body) req.write(options.body)
    req.end()
  })
}

function parseCookies(headers) {
  const cookies = {}
  for (const h of headers) {
    const [kv] = h.split(';')
    const [name, ...vParts] = kv.split('=')
    cookies[name.trim()] = vParts.join('=')
  }
  return cookies
}
function cs(c) { return Object.entries(c).map(([k,v]) => `${k}=${v}`).join('; ') }

function parseSSE(buffer) {
  const events = []
  let searchFrom = 0
  let lastIndex = 0

  while (searchFrom < buffer.length) {
    const eventStart = buffer.indexOf('event: ', searchFrom)
    if (eventStart === -1) break
    const terminator = buffer.indexOf('\n\n', eventStart)
    if (terminator === -1) break

    const eventBlock = buffer.slice(eventStart, terminator)
    const lines = eventBlock.split('\n')
    const eventType = lines[0].replace('event: ', '').trim()
    const dataLines = lines.slice(1)
      .filter(l => l.startsWith('data:'))
      .map(l => l.startsWith('data: ') ? l.slice(6) : l.slice(5))
    const data = dataLines.join('\n')

    events.push({ event: eventType, data })
    lastIndex = terminator + 2
    searchFrom = lastIndex
  }

  return { events, remaining: buffer.slice(lastIndex) }
}

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

async function testChat(cookies, testName, message) {
  console.log(`\n--- TEST: ${testName} ---`)
  console.log(`Message: "${message.slice(0, 80)}..."`)

  const startTime = Date.now()

  const chatRes = await fetch(`${BASE_URL}/api/claude/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cs(cookies) },
    body: JSON.stringify({ message }),
    stream: true,
  })

  if (chatRes.status !== 200) {
    let err = ''
    chatRes.stream.on('data', c => err += c)
    await new Promise(r => chatRes.stream.on('end', r))
    console.log(`  FAIL: HTTP ${chatRes.status} — ${err.slice(0, 200)}`)
    return false
  }

  let buffer = ''
  let fullText = ''
  let convId = null
  let gotDone = false
  let gotError = false
  let errorMsg = ''
  let eventCount = 0
  let hasWebSearch = false
  let citations = []
  let firstTextTime = null

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log(`  TIMEOUT after 90s. Buffer: "${buffer.slice(0, 300)}"`)
      resolve()
    }, 90000)

    chatRes.stream.on('data', (chunk) => {
      buffer += chunk.toString()
      const { events, remaining } = parseSSE(buffer)
      buffer = remaining

      for (const { event, data } of events) {
        eventCount++
        switch (event) {
          case 'conversation_id': convId = data; break
          case 'text':
            if (!firstTextTime) firstTextTime = Date.now()
            fullText += data
            break
          case 'web_search_start': hasWebSearch = true; break
          case 'citation':
            try { citations.push(JSON.parse(data)) } catch {}
            break
          case 'done': gotDone = true; break
          case 'error': gotError = true; errorMsg = data; break
        }
      }
    })

    chatRes.stream.on('end', () => { clearTimeout(timeout); resolve() })
    chatRes.stream.on('error', () => { clearTimeout(timeout); resolve() })
  })

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  const ttft = firstTextTime ? ((firstTextTime - startTime) / 1000).toFixed(1) : 'N/A'

  console.log(`  Duration: ${duration}s | Time to first text: ${ttft}s`)
  console.log(`  Events: ${eventCount} | Text length: ${fullText.length}`)
  console.log(`  Web search: ${hasWebSearch} | Citations: ${citations.length}`)
  console.log(`  Done: ${gotDone} | Error: ${gotError}${gotError ? ` (${errorMsg.slice(0, 100)})` : ''}`)

  // Check for newlines in response
  const newlines = (fullText.match(/\n/g) || []).length
  console.log(`  Newlines in response: ${newlines}`)

  if (fullText.length > 0) {
    console.log(`  Preview: ${fullText.slice(0, 200).replace(/\n/g, '\\n')}`)
  }

  const passed = fullText.length > 0 && gotDone && !gotError
  console.log(`  Result: ${passed ? 'PASS' : 'FAIL'}`)
  return passed
}

async function main() {
  console.log('=== DEEP AI CHAT TEST SUITE ===')
  console.log(`Target: ${BASE_URL}\n`)

  const cookies = await login()
  console.log('Logged in successfully')

  const tests = [
    ['Simpele vraag', 'Wat is 2+2? Geef alleen het antwoord.'],
    ['Juridische vraag met markdown', 'Leg kort uit wat een vaststellingsovereenkomst is in het arbeidsrecht. Gebruik opsommingstekens.'],
    ['Web search test', 'Zoek de meest recente uitspraak over transitievergoeding op rechtspraak.nl en geef het ECLI-nummer.'],
  ]

  let passed = 0
  let failed = 0

  for (const [name, msg] of tests) {
    try {
      const result = await testChat(cookies, name, msg)
      if (result) passed++
      else failed++
    } catch (err) {
      console.log(`  EXCEPTION: ${err.message}`)
      failed++
    }

    // Wait between tests
    await new Promise(r => setTimeout(r, 3000))
  }

  console.log(`\n=== FINAL RESULTS ===`)
  console.log(`Passed: ${passed}/${tests.length}`)
  console.log(`Failed: ${failed}/${tests.length}`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
