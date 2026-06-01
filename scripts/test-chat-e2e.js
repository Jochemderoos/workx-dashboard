/**
 * End-to-end test for AI Chat
 * Simulates exactly what the browser does:
 * 1. Login via NextAuth credentials
 * 2. POST to /api/claude/chat
 * 3. Parse SSE stream exactly like ClaudeChat.tsx
 * 4. Report success/failure
 */

const https = require('https')
const http = require('http')

const BASE_URL = 'https://workx-dashboard.vercel.app'

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const mod = parsedUrl.protocol === 'https:' ? https : http

    const req = mod.request(parsedUrl, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      // Collect cookies from Set-Cookie headers
      const cookies = res.headers['set-cookie'] || []

      if (options.stream) {
        resolve({ status: res.statusCode, headers: res.headers, stream: res, cookies })
        return
      }

      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        resolve({ status: res.statusCode, data, headers: res.headers, cookies })
      })
    })

    req.on('error', reject)
    req.setTimeout(60000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    if (options.body) req.write(options.body)
    req.end()
  })
}

function parseCookies(setCookieHeaders) {
  const cookies = {}
  for (const header of setCookieHeaders) {
    const parts = header.split(';')[0]
    const [name, ...valueParts] = parts.split('=')
    cookies[name.trim()] = valueParts.join('=')
  }
  return cookies
}

function cookieString(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
}

async function main() {
  console.log('=== AI CHAT E2E TEST ===')
  console.log(`Target: ${BASE_URL}`)
  console.log('')

  // Step 1: Get CSRF token
  console.log('1. Getting CSRF token...')
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`)
  const csrfData = JSON.parse(csrfRes.data)
  const csrfToken = csrfData.csrfToken
  const cookies = parseCookies(csrfRes.cookies)
  console.log(`   CSRF token: ${csrfToken.slice(0, 20)}...`)
  console.log(`   Cookies: ${Object.keys(cookies).join(', ')}`)

  // Step 2: Login
  console.log('\n2. Logging in...')
  const loginBody = `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent('jochem.deroos@workxadvocaten.nl')}&password=${encodeURIComponent('Amsterdam24!')}&json=true`

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieString(cookies),
    },
    body: loginBody,
  })

  console.log(`   Status: ${loginRes.status}`)
  const loginCookies = parseCookies(loginRes.cookies)
  Object.assign(cookies, loginCookies)

  const sessionToken = cookies['__Secure-next-auth.session-token']
  if (!sessionToken) {
    console.error('   FAILED: No session token received!')
    console.log('   Cookies received:', Object.keys(loginCookies))
    process.exit(1)
  }
  console.log(`   Session token: ${sessionToken.slice(0, 30)}...`)

  // Step 3: Test chat endpoint
  console.log('\n3. Sending chat message...')
  const chatBody = JSON.stringify({
    message: 'Hallo, geef een kort antwoord: wat is 1+1?'
  })

  const chatRes = await fetch(`${BASE_URL}/api/claude/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieString(cookies),
    },
    body: chatBody,
    stream: true,
  })

  console.log(`   Status: ${chatRes.status}`)
  console.log(`   Content-Type: ${chatRes.headers['content-type']}`)
  console.log(`   X-Accel-Buffering: ${chatRes.headers['x-accel-buffering'] || 'not set'}`)

  if (chatRes.status !== 200) {
    let errData = ''
    chatRes.stream.on('data', chunk => errData += chunk)
    chatRes.stream.on('end', () => {
      console.error(`   FAILED: ${errData}`)
      process.exit(1)
    })
    return
  }

  // Step 4: Parse SSE stream (exactly like ClaudeChat.tsx)
  console.log('\n4. Parsing SSE stream...')

  let buffer = ''
  let conversationId = null
  let fullText = ''
  let eventCount = 0
  let gotDone = false
  let gotError = false
  let errorMsg = ''

  const parseBuffer = () => {
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

      eventCount++

      switch (eventType) {
        case 'conversation_id':
          conversationId = data
          console.log(`   [${eventCount}] conversation_id: ${data}`)
          break
        case 'text':
          fullText += data
          if (eventCount <= 5 || eventCount % 20 === 0) {
            console.log(`   [${eventCount}] text: "${data.slice(0, 50)}"`)
          }
          break
        case 'web_search_start':
          console.log(`   [${eventCount}] web_search_start`)
          break
        case 'citation':
          console.log(`   [${eventCount}] citation: ${data.slice(0, 80)}`)
          break
        case 'done':
          gotDone = true
          console.log(`   [${eventCount}] done`)
          break
        case 'error':
          gotError = true
          errorMsg = data
          console.log(`   [${eventCount}] ERROR: ${data}`)
          break
      }

      lastIndex = terminator + 2
      searchFrom = lastIndex
    }

    if (lastIndex > 0) {
      buffer = buffer.slice(lastIndex)
    }
  }

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error('\n   TIMEOUT: No response within 60 seconds')
      console.error(`   Buffer content (first 500 chars): "${buffer.slice(0, 500)}"`)
      resolve()
    }, 60000)

    chatRes.stream.on('data', (chunk) => {
      buffer += chunk.toString()
      parseBuffer()
    })

    chatRes.stream.on('end', () => {
      clearTimeout(timeout)
      parseBuffer() // parse any remaining data
      resolve()
    })

    chatRes.stream.on('error', (err) => {
      clearTimeout(timeout)
      console.error(`   Stream error: ${err.message}`)
      reject(err)
    })
  })

  // Step 5: Report results
  console.log('\n=== RESULTS ===')
  console.log(`Events parsed: ${eventCount}`)
  console.log(`Conversation ID: ${conversationId || 'NONE'}`)
  console.log(`Full text length: ${fullText.length}`)
  console.log(`Got done event: ${gotDone}`)
  console.log(`Got error: ${gotError}${gotError ? ` (${errorMsg})` : ''}`)

  if (fullText.length > 0) {
    console.log(`\nResponse preview (first 300 chars):`)
    console.log(fullText.slice(0, 300))
  }

  if (buffer.length > 0) {
    console.log(`\nRemaining buffer (${buffer.length} chars): "${buffer.slice(0, 200)}"`)
  }

  if (fullText.length > 0 && gotDone && !gotError) {
    console.log('\n✓ TEST PASSED — Chat works correctly!')
    process.exit(0)
  } else {
    console.log('\n✗ TEST FAILED')
    if (!conversationId) console.log('  - No conversation ID received')
    if (fullText.length === 0) console.log('  - No text content received')
    if (!gotDone) console.log('  - No done event received')
    if (gotError) console.log(`  - Error: ${errorMsg}`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
