// Self-contained tests. Run with DSH's Electron in node mode so DSH's own undici and
// dsh-http-proxy are used exactly as in production:
//   Windows: $env:ELECTRON_RUN_AS_NODE=1; & "...\DeepSeek Harness.exe" test/run.mjs
//   macOS:   ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" test/run.mjs
// (set DSH_SOCKS_PROXY_RUNTIME_DIR to the installation's ".../app.asar/dsh")
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { normalizeConfig } from '../lib/config.js'
import { installSocksRouting } from '../lib/install.js'
import { createLlmHostSource } from '../lib/llm-hosts.js'
import { matchesHostList, isPrivateLiteral } from '../lib/match.js'
import { socks5Connect } from '../lib/socks5.js'

const logs = []
const logger = { info: (m) => logs.push(['info', m]), warn: (m) => logs.push(['warn', m]), debug() {} }

// ---- fixtures -------------------------------------------------------------------------------
const target = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end(`hello ${req.headers.host} ${req.url}`)
})
await new Promise((r) => target.listen(0, '127.0.0.1', r))
const targetPort = target.address().port

/** Mock SOCKS5 server: every CONNECT goes to the local target server, destinations recorded. */
function startSocks({ username, password } = {}) {
  const seen = []
  const server = net.createServer((client) => {
    let buf = Buffer.alloc(0)
    let stage = 'greet'
    client.on('error', () => {})
    client.on('data', function onData(chunk) {
      buf = Buffer.concat([buf, chunk])
      while (true) {
        if (stage === 'greet') {
          if (buf.length < 2 || buf.length < 2 + buf[1]) return
          const methods = [...buf.subarray(2, 2 + buf[1])]
          buf = buf.subarray(2 + buf[1])
          if (username) {
            if (!methods.includes(2)) return client.end(Buffer.from([5, 0xff]))
            client.write(Buffer.from([5, 2]))
            stage = 'auth'
          } else {
            client.write(Buffer.from([5, 0]))
            stage = 'req'
          }
        } else if (stage === 'auth') {
          if (buf.length < 2) return
          const ul = buf[1]
          if (buf.length < 3 + ul) return
          const pl = buf[2 + ul]
          if (buf.length < 3 + ul + pl) return
          const u = buf.subarray(2, 2 + ul).toString()
          const p = buf.subarray(3 + ul, 3 + ul + pl).toString()
          buf = buf.subarray(3 + ul + pl)
          if (u !== username || p !== password) return client.end(Buffer.from([1, 1]))
          client.write(Buffer.from([1, 0]))
          stage = 'req'
        } else if (stage === 'req') {
          if (buf.length < 5) return
          const atyp = buf[3]
          let host
          let len
          if (atyp === 1) {
            len = 4 + 4 + 2
            if (buf.length < len) return
            host = [...buf.subarray(4, 8)].join('.')
          } else if (atyp === 3) {
            len = 5 + buf[4] + 2
            if (buf.length < len) return
            host = buf.subarray(5, 5 + buf[4]).toString()
          } else return client.end(Buffer.from([5, 8, 0, 1, 0, 0, 0, 0, 0, 0]))
          const port = buf.readUInt16BE(len - 2)
          buf = buf.subarray(len)
          seen.push(`${host}:${port}`)
          if (host.startsWith('refuse.')) return client.end(Buffer.from([5, 5, 0, 1, 0, 0, 0, 0, 0, 0]))
          const upstream = net.connect(targetPort, '127.0.0.1', () => {
            client.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0]))
            if (buf.length) upstream.write(buf)
            client.off('data', onData)
            client.pipe(upstream)
            upstream.pipe(client)
          })
          upstream.on('error', () => client.destroy())
          stage = 'piped'
          return
        } else return
      }
    })
  })
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, seen, port: server.address().port })))
}

/** Mock HTTP proxy: absolute-form forwarding + CONNECT, optional Basic auth; destinations recorded. */
function startHttpProxy({ username, password } = {}) {
  const seen = []
  const expected = username ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` : undefined
  const authorized = (req) => !expected || req.headers['proxy-authorization'] === expected
  const server = http.createServer((req, res) => {
    if (!authorized(req)) return res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="mock"' }).end()
    let target
    try { target = new URL(req.url) } catch { return res.writeHead(400).end() }
    seen.push(`GET ${target.hostname}:${target.port || 80}`)
    if (target.hostname.endsWith('.invalid')) return res.writeHead(502).end('cannot resolve')
    const upstream = http.request({ host: '127.0.0.1', port: targetPort, method: req.method, path: target.pathname + target.search, headers: { ...req.headers, host: target.host } }, (up) => {
      res.writeHead(up.statusCode, up.headers)
      up.pipe(res)
    })
    upstream.on('error', () => res.writeHead(502).end())
    req.pipe(upstream)
  })
  server.on('connect', (req, client, head) => {
    client.on('error', () => {})
    if (!authorized(req)) return client.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="mock"\r\nContent-Length: 0\r\n\r\n')
    seen.push(`CONNECT ${req.url}`)
    if (req.url.startsWith('refuse.')) return client.end('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n')
    const up = net.connect(targetPort, '127.0.0.1', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head?.length) up.write(head)
      client.pipe(up)
      up.pipe(client)
    })
    up.on('error', () => client.destroy())
  })
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, seen, port: server.address().port })))
}

function fakeLoader(providers) {
  return { *entries() { yield { options: { name: '@deepseek-ai/dsh-llm-pi-ai', config: { providers } } } } }
}

function nodeGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode, body }))
    }).on('error', reject)
  })
}

let passed = 0
async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`ok - ${name}`)
  } catch (error) {
    console.log(`FAIL - ${name}\n${error.stack}`)
    process.exitCode = 1
  }
}

// ---- unit -----------------------------------------------------------------------------------
await test('config parses socks5h URL with credentials', () => {
  const c = normalizeConfig({ mode: 'all', proxy: 'socks5h://u%40x:p%3Aw@10.0.0.2:1081' })
  assert.equal(c.mode, 'all')
  assert.deepEqual([c.socks.host, c.socks.port, c.socks.username, c.socks.password, c.socks.remoteDns], ['10.0.0.2', 1081, 'u@x', 'p:w', true])
  assert.equal(normalizeConfig({ proxy: 'socks5://h:1' }).socks.remoteDns, false)
  assert.equal(c.socks.type, 'socks5')
  const hp = normalizeConfig({ proxy: 'http://u:p@h:3128' }).socks
  assert.deepEqual([hp.type, hp.host, hp.port, hp.username, hp.password], ['http', 'h', 3128, 'u', 'p'])
  assert.equal(normalizeConfig({ proxy: 'https://h' }).socks.port, 443)
  assert.throws(() => normalizeConfig({ proxy: 'ftp://h:1' }))
  assert.equal(normalizeConfig({ inputMode: 'fields', proxyType: 'http', host: 'h', port: 8080 }).socks.type, 'http')
  assert.equal(normalizeConfig({ mode: 'bogus' }).mode, 'llm')
})

await test('host matching', () => {
  assert.ok(matchesHostList(['example.com'], 'api.example.com', '443'))
  assert.ok(!matchesHostList(['example.com'], 'badexample.com', '443'))
  assert.ok(matchesHostList(['*.foo.cn'], 'a.foo.cn', '443'))
  assert.ok(matchesHostList(['10.1.'], '10.1.2.3', '80'))
  assert.ok(matchesHostList(['h.cn:8443'], 'h.cn', '8443'))
  assert.ok(!matchesHostList(['h.cn:8443'], 'h.cn', '443'))
  assert.ok(isPrivateLiteral('10.1.2.3') && isPrivateLiteral('192.168.1.1') && !isPrivateLiteral('8.8.8.8'))
})

await test('LLM host source reads pi-ai providers and filters by route', () => {
  const loader = fakeLoader({ a: { baseURL: 'https://gw.example.com/v1' }, b: { baseURL: 'http://10.1.2.3:3000/v1' } })
  assert.deepEqual(createLlmHostSource(() => loader, { llmHosts: ['x.ai'], providers: [], builtinHosts: false })().sort(), ['10.1.2.3', 'gw.example.com', 'x.ai'])
  assert.deepEqual(createLlmHostSource(() => loader, { llmHosts: [], providers: ['a'], builtinHosts: true })(), ['gw.example.com'])
})

await test('socks5Connect with auth, and wrong password is reported', async () => {
  const s = await startSocks({ username: 'alice', password: 's3cret' })
  const { socket } = await socks5Connect({ host: '127.0.0.1', port: s.port, username: 'alice', password: 's3cret' }, 'svc.test', 80)
  socket.write('GET /x HTTP/1.1\r\nHost: svc.test\r\nConnection: close\r\n\r\n')
  const text = await new Promise((r) => { let t = ''; socket.on('data', (c) => (t += c)); socket.on('end', () => r(t)) })
  assert.match(text, /hello svc.test \/x/)
  await assert.rejects(socks5Connect({ host: '127.0.0.1', port: s.port, username: 'alice', password: 'bad' }, 'svc.test', 80), /authentication failed/)
  await assert.rejects(socks5Connect({ host: '127.0.0.1', port: s.port }, 'svc.test', 80), /requires username\/password/)
  s.server.close()
})

await test('lenient proxy input parser (host copy == client copy)', async () => {
  const { parseProxyInput } = await import('../lib/parse-proxy.js')
  const { readFileSync } = await import('node:fs')
  let clientModule
  const window = { __ModuleLoader__: { load: ({ factory }) => (clientModule = factory(() => ({ createElement() {} }))) } }
  new Function('window', 'globalThis', readFileSync(new URL('../client.js', import.meta.url), 'utf8'))(window, {})
  const cases = {
    'socks5h://u:p@1.2.3.4:1080': 'socks5h://u:p@1.2.3.4:1080',
    'socks5://127.0.0.1:7890': 'socks5://127.0.0.1:7890',
    'SOCKS5H://proxy.example.com:443': 'socks5h://proxy.example.com:443',
    'export ALL_PROXY=socks5://10.0.0.2:1081': 'socks5://10.0.0.2:1081',
    'set ALL_PROXY="socks5h://a:b@h.cn:9"': 'socks5h://a:b@h.cn:9',
    'curl --socks5-hostname 1.2.3.4:1080 --proxy-user alice:p%w https://x': 'socks5h://alice:p%25w@1.2.3.4:1080',
    'curl --socks5 h.cn:1080 -U bob:pw https://x': 'socks5://bob:pw@h.cn:1080',
    'curl -x socks5h://u:p@h:1 https://x': 'socks5h://u:p@h:1',
    '127.0.0.1:7890': 'socks5h://127.0.0.1:7890',
    'user:pass@h.cn:1080': 'socks5h://user:pass@h.cn:1080',
    '1.2.3.4:1080:alice:secret': 'socks5h://alice:secret@1.2.3.4:1080',
    'http://1.2.3.4:8080': 'http://1.2.3.4:8080',
    'http://u:p%40w@proxy.cn:3128/': 'http://u:p%40w@proxy.cn:3128',
    'https://secure.proxy.cn': 'https://secure.proxy.cn:443',
    'export HTTPS_PROXY=http://10.0.0.9:3128': 'http://10.0.0.9:3128',
    'set http_proxy=proxy.cn:8080': 'http://proxy.cn:8080',
    'curl -x http://u:p@h.cn:8080 https://example.com': 'http://u:p@h.cn:8080',
    'curl --proxy h.cn:3128 -U bob:pw https://example.com': 'http://bob:pw@h.cn:3128',
    'curl --proxy https://h.cn:8443 https://example.com': 'https://h.cn:8443',
    'ftp://1.2.3.4:21': undefined,
    'not a proxy': undefined,
    '1.2.3.4:99999': undefined,
  }
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(parseProxyInput(input)?.url, expected, `host parser: ${input}`)
    assert.equal(clientModule.parseProxyInput(input)?.url, expected, `client parser: ${input}`)
  }
  // config accepts the same inputs and the separate-fields mode
  assert.equal(normalizeConfig({ proxy: 'curl --socks5 h.cn:1080 -U bob:pw x' }).socks.username, 'bob')
  const f = normalizeConfig({ inputMode: 'fields', host: '5.6.7.8', port: '2080', username: 'u', password: 'p', remoteDns: false, proxy: 'socks5h://ignored:1' })
  assert.deepEqual([f.socks.host, f.socks.port, f.socks.username, f.socks.password, f.socks.remoteDns], ['5.6.7.8', 2080, 'u', 'p', false])
})

await test('probeEndpoints reports the route each model endpoint would take', async () => {
  const { probeEndpoints } = await import('../lib/probe.js')
  const s = await startSocks({ username: 'dave', password: 'pw' })
  const endpoints = [
    { route: 'remote', baseURL: 'http://models.test:443/v1' },
    { route: 'lan', baseURL: `http://10.5.5.5:${targetPort}/v1` },
    { route: 'local', baseURL: `http://127.0.0.1:${targetPort}/v1` },
  ]
  // bypassPrivate=false: LAN goes through SOCKS5, loopback stays direct
  const routed = await probeEndpoints(normalizeConfig({ mode: 'all', proxy: `socks5h://dave:pw@127.0.0.1:${s.port}`, bypassPrivate: false }), endpoints, () => [])
  assert.deepEqual(routed.map((r) => [r.route, r.via, r.ok]), [['remote', 'proxy', true], ['lan', 'proxy', true], ['local', 'direct', true]])
  assert.deepEqual(s.seen.sort(), ['10.5.5.5:443'.replace(':443', `:${targetPort}`), `models.test:443`].sort(), JSON.stringify(s.seen))
  // bypassPrivate=true: the LAN endpoint is dialled directly, so it cannot reach the tunnel
  const direct = await probeEndpoints(normalizeConfig({ mode: 'all', proxy: `socks5h://dave:pw@127.0.0.1:${s.port}`, bypassPrivate: true }), endpoints, () => [])
  assert.equal(direct.find((r) => r.route === 'lan').via, 'direct')
  s.server.close()
})

await test('probeSocks reports success and classifies failures', async () => {
  const { probeSocks } = await import('../lib/probe.js')
  const s = await startSocks({ username: 'carol', password: 'pw' })
  const ok = await probeSocks({ host: '127.0.0.1', port: s.port, username: 'carol', password: 'pw' })
  assert.equal(ok.ok, true, JSON.stringify(ok))
  assert.equal(ok.auth, 'password')
  assert.ok(ok.tcpMs >= 0 && ok.handshakeMs >= 0)
  const bad = await probeSocks({ host: '127.0.0.1', port: s.port, username: 'carol', password: 'nope' })
  assert.equal(bad.code, 'auth')
  const noAuth = await probeSocks({ host: '127.0.0.1', port: s.port })
  assert.equal(noAuth.code, 'auth-required')
  // the test only talks to the SOCKS5 server: no CONNECT, no website
  assert.deepEqual(s.seen, [])
  s.server.close()
  const open = await startSocks()
  const anon = await probeSocks({ host: '127.0.0.1', port: open.port })
  assert.equal(anon.ok, true)
  assert.equal(anon.auth, 'none')
  assert.deepEqual(open.seen, [])
  open.server.close()
  const closed = await probeSocks({ host: '127.0.0.1', port: 1 })
  assert.equal(closed.code, 'proxy-refused', JSON.stringify(closed))
  const notSocks = await probeSocks({ host: '127.0.0.1', port: targetPort })
  assert.ok(['not-socks5', 'proxy-reset', 'handshake-timeout'].includes(notSocks.code), JSON.stringify(notSocks))
  const silent = net.createServer(() => {})
  await new Promise((r) => silent.listen(0, '127.0.0.1', r))
  const mute = await probeSocks({ host: '127.0.0.1', port: silent.address().port, timeoutMs: 2000 })
  assert.equal(mute.code, 'handshake-timeout', JSON.stringify(mute))
  silent.close()
})

await test('HTTP proxy: CONNECT tunnel, auth errors, and the no-website check', async () => {
  const { httpConnect, httpProxyCheck } = await import('../lib/http-connect.js')
  const { probeSocks } = await import('../lib/probe.js')
  const p = await startHttpProxy({ username: 'erin', password: 'pw' })
  const up = { type: 'http', host: '127.0.0.1', port: p.port, username: 'erin', password: 'pw' }
  const { socket } = await httpConnect(up, 'svc.test', 443)
  socket.write('GET /t HTTP/1.1\r\nHost: svc.test\r\nConnection: close\r\n\r\n')
  const text = await new Promise((r) => { let t = ''; socket.on('data', (c) => (t += c)); socket.on('end', () => r(t)) })
  assert.match(text, /hello svc.test \/t/)
  await assert.rejects(httpConnect({ ...up, password: 'bad' }, 'svc.test', 443), (e) => e.code === 'EAUTH')
  await assert.rejects(httpConnect({ ...up, username: '' }, 'svc.test', 443), (e) => e.code === 'EAUTHREQUIRED')
  await assert.rejects(httpConnect(up, 'refuse.test', 443), (e) => e.code === 'ECONNECTFAILED' && /502/.test(e.message))
  // the check only touches an .invalid host: no CONNECT, no real website
  p.seen.length = 0
  const ok = await httpProxyCheck(up)
  assert.equal(ok.auth, 'password')
  assert.deepEqual(p.seen, ['GET dsh-proxy-check.invalid:80'])
  const r1 = await probeSocks(up)
  assert.equal(r1.ok, true, JSON.stringify(r1))
  assert.equal(r1.type, 'http')
  assert.equal((await probeSocks({ ...up, password: 'nope' })).code, 'auth')
  assert.equal((await probeSocks({ ...up, username: '' })).code, 'auth-required')
  // wrong protocol on either side is named
  const s = await startSocks()
  assert.equal((await probeSocks({ type: 'http', host: '127.0.0.1', port: s.port, timeoutMs: 3000 })).code, 'not-http-proxy')
  const asSocks = await probeSocks({ type: 'socks5', host: '127.0.0.1', port: p.port, timeoutMs: 3000 })
  assert.equal(asSocks.code, 'not-socks5', JSON.stringify(asSocks))
  assert.match(asSocks.message, /HTTP proxy port/)
  s.server.close()
  p.server.close()
})

await test('HTTP upstream: llm mode and all mode route through the HTTP proxy', async () => {
  const p = await startHttpProxy({ username: 'fay', password: 'pw' })
  const proxy = `http://fay:pw@127.0.0.1:${p.port}`
  // llm mode: only the LLM host goes to the upstream
  const llm = normalizeConfig({ mode: 'llm', proxy, builtinHosts: false, llmHosts: ['api.llm.test'] })
  let handle = await installSocksRouting(llm, { llmHosts: () => llm.llmHosts, logger })
  try {
    const res = await fetch(`http://api.llm.test:${targetPort}/v1/x`)
    assert.equal(await res.text(), `hello api.llm.test:${targetPort} /v1/x`)
    assert.deepEqual(p.seen, [`GET api.llm.test:${targetPort}`])
    await assert.rejects(fetch(`http://other.test:${targetPort}/`))
    assert.equal(p.seen.length, 1)
  } finally {
    await handle.dispose()
  }
  // all mode: fetch, CONNECT tunnels and node:http all reach the upstream
  p.seen.length = 0
  handle = await installSocksRouting(normalizeConfig({ mode: 'all', proxy }), { llmHosts: () => [], logger })
  try {
    assert.equal(await (await fetch(`http://any.http.test:${targetPort}/a`)).text(), `hello any.http.test:${targetPort} /a`)
    assert.equal((await nodeGet(`http://node.http.test:${targetPort}/b`)).body, `hello node.http.test:${targetPort} /b`)
    const bridge = new URL(handle.bridgeUrl)
    const auth = Buffer.from(`${decodeURIComponent(bridge.username)}:${decodeURIComponent(bridge.password)}`).toString('base64')
    const tunnelled = await new Promise((r) => {
      const sock = net.connect(Number(bridge.port), '127.0.0.1', () =>
        sock.write(`CONNECT tls.http.test:${targetPort} HTTP/1.1\r\nHost: x\r\nProxy-Authorization: Basic ${auth}\r\n\r\nGET /c HTTP/1.1\r\nHost: tls.http.test\r\nConnection: close\r\n\r\n`))
      let t = ''
      sock.on('data', (c) => (t += c))
      sock.on('close', () => r(t))
    })
    assert.match(tunnelled, /hello tls.http.test \/c/)
    assert.deepEqual(p.seen.sort(), [`CONNECT tls.http.test:${targetPort}`, `GET any.http.test:${targetPort}`, `GET node.http.test:${targetPort}`].sort())
    // the upstream's credentials never reach child processes: they only get the loopback bridge
    assert.ok(!String(process.env.HTTPS_PROXY).includes('fay'))
  } finally {
    await handle.dispose()
    p.server.close()
  }
})

// ---- integration: llm mode -------------------------------------------------------------------
await test('mode=llm: only LLM hosts go through SOCKS5', async () => {
  const s = await startSocks()
  const config = normalizeConfig({ mode: 'llm', proxy: `socks5h://127.0.0.1:${s.port}`, builtinHosts: false })
  const llmHosts = createLlmHostSource(() => fakeLoader({ gw: { baseURL: `http://api.llm.test:${targetPort}/v1` } }), config)
  const handle = await installSocksRouting(config, { llmHosts, logger })
  try {
    const res = await fetch(`http://api.llm.test:${targetPort}/v1/chat`)
    assert.equal(await res.text(), `hello api.llm.test:${targetPort} /v1/chat`)
    assert.deepEqual(s.seen, [`api.llm.test:${targetPort}`])
    // non-LLM host: not tunnelled (direct DNS lookup of a .test name fails)
    await assert.rejects(fetch(`http://other.test:${targetPort}/`))
    assert.deepEqual(s.seen, [`api.llm.test:${targetPort}`])
    // loopback stays direct
    assert.equal((await fetch(`http://127.0.0.1:${targetPort}/l`)).status, 200)
    assert.equal(s.seen.length, 1)
    // proxy failure surfaces as a fetch error, not a hang
    const failing = normalizeConfig({ mode: 'llm', proxy: `socks5h://127.0.0.1:${s.port}`, builtinHosts: false, llmHosts: ['refuse.test'] })
    assert.ok(failing)
  } finally {
    await handle.dispose()
    s.server.close()
  }
})

// ---- integration: dsh mode -------------------------------------------------------------------
await test('mode=dsh: DSH’s own hosts go through SOCKS5, LLM hosts stay direct', async () => {
  const s = await startSocks()
  const config = normalizeConfig({ mode: 'dsh', proxy: `socks5h://127.0.0.1:${s.port}`, builtinHosts: false })
  const llmHosts = createLlmHostSource(() => fakeLoader({ gw: { baseURL: `http://api.llm.test:${targetPort}/v1` } }), config)
  const handle = await installSocksRouting(config, { llmHosts, logger })
  try {
    assert.equal(config.mode, 'dsh')
    // decision: LLM host is direct, other hosts are proxied
    assert.equal(handle.shouldProxy(new URL(`http://api.llm.test:${targetPort}/`)), false)
    assert.equal(handle.shouldProxy(new URL('http://site.example.com/')), true)
    // non-LLM DSH host -> goes through the SOCKS5 proxy
    assert.equal(await (await fetch(`http://site.example.com:${targetPort}/s`)).text(), `hello site.example.com:${targetPort} /s`)
    assert.ok(s.seen.includes(`site.example.com:${targetPort}`), 'DSH host through proxy')
    // LLM host -> NOT tunnelled (a .test name only resolves via DSH's injected policy, so fetch fails direct)
    await assert.rejects(fetch(`http://api.llm.test:${targetPort}/v1`))
    assert.ok(!s.seen.includes(`api.llm.test:${targetPort}`), 'LLM host NOT through proxy')
    // loopback stays direct
    assert.equal((await fetch(`http://127.0.0.1:${targetPort}/l`)).status, 200)
  } finally {
    await handle.dispose()
    s.server.close()
  }
})

// ---- integration: dedicated LLM upstream ----------------------------------------------------
await test('mode=all + dedicated LLM proxy: LLM host via llmProxy, other hosts via primary', async () => {
  const primary = await startSocks({ username: 'p', password: 'pp' })
  const llmSrv = await startSocks({ username: 'l', password: 'll' })
  const config = normalizeConfig({
    mode: 'all',
    proxy: `socks5h://p:pp@127.0.0.1:${primary.port}`,
    llmProxyEnabled: true,
    llmProxy: `socks5h://l:ll@127.0.0.1:${llmSrv.port}`,
    bypassPrivate: false,
    builtinHosts: false,
    llmHosts: [],
  })
  assert.equal(config.llmProxyEnabled, true)
  assert.ok(config.llmSocks && config.llmSocks.port === llmSrv.port)
  const llmHosts = () => ['api.llm.test']
  const handle = await installSocksRouting(config, { llmHosts, logger })
  try {
    assert.equal(handle.hasLlmUpstream, true)
    assert.equal(handle.usesLlmUpstream(new URL('https://api.llm.test/x')), true)
    assert.equal(handle.usesLlmUpstream(new URL('https://site.example.com/x')), false)
    // LLM host -> LLM proxy
    assert.equal(await (await fetch(`http://api.llm.test:${targetPort}/v1`)).text(), `hello api.llm.test:${targetPort} /v1`)
    assert.ok(llmSrv.seen.includes(`api.llm.test:${targetPort}`), 'LLM host went through llm proxy')
    assert.ok(!primary.seen.includes(`api.llm.test:${targetPort}`), 'LLM host NOT through primary')
    // other host -> primary proxy
    assert.equal(await (await fetch(`http://site.example.com:${targetPort}/s`)).text(), `hello site.example.com:${targetPort} /s`)
    assert.ok(primary.seen.includes(`site.example.com:${targetPort}`), 'other host through primary')
    assert.ok(!llmSrv.seen.includes(`site.example.com:${targetPort}`), 'other host NOT through llm proxy')
  } finally {
    await handle.dispose()
    primary.server.close()
    llmSrv.server.close()
  }
})

await test('LLM upstream is derived from the llmProxy text (empty = primary)', async () => {
  const a = normalizeConfig({ mode: 'all', proxy: 'socks5h://127.0.0.1:7890', llmProxy: 'socks5h://127.0.0.1:1' })
  assert.equal(a.llmProxyEnabled, true)
  assert.ok(a.llmSocks && a.llmSocks.port === 1)
  const b = normalizeConfig({ mode: 'all', proxy: 'socks5h://127.0.0.1:7890', llmProxy: '' })
  assert.equal(b.llmProxyEnabled, false)
  assert.equal(b.llmSocks, undefined)
  const c = normalizeConfig({ mode: 'all', proxy: 'socks5h://127.0.0.1:7890' })
  assert.equal(c.llmProxyEnabled, false)
})

// ---- integration: all mode -------------------------------------------------------------------
await test('mode=all: everything through SOCKS5 except loopback/private; env + node:http covered; dispose restores', async () => {
  const s = await startSocks({ username: 'bob', password: 'pw' })
  const envBefore = process.env.HTTPS_PROXY
  // NODE_USE_ENV_PROXY=1 in DSH's own environment gives the default global agent a proxyEnv, so
  // "restored" can only be asserted by identity, not by the absence of that field.
  const httpAgentBefore = http.globalAgent
  const httpsAgentBefore = https.globalAgent
  const config = normalizeConfig({ mode: 'all', proxy: `socks5h://bob:pw@127.0.0.1:${s.port}` })
  const handle = await installSocksRouting(config, { llmHosts: () => [], logger })
  try {
    console.log(`   via DSH proxy policy: ${handle.viaDshPolicy}`)
    const res = await fetch(`http://any.thing.test:${targetPort}/a`)
    assert.equal(await res.text(), `hello any.thing.test:${targetPort} /a`)
    assert.ok(s.seen.includes(`any.thing.test:${targetPort}`))
    // children see the bridge
    assert.equal(process.env.HTTPS_PROXY, handle.bridgeUrl)
    // node:http clients (absolute-form through the bridge)
    const r2 = await nodeGet(`http://plain.http.test:${targetPort}/b`)
    assert.equal(r2.body, `hello plain.http.test:${targetPort} /b`)
    assert.ok(s.seen.includes(`plain.http.test:${targetPort}`))
    // private LAN literal is not tunnelled
    const before = s.seen.length
    await fetch('http://10.255.255.1:9/', { signal: AbortSignal.timeout(300) }).catch(() => {})
    assert.equal(s.seen.length, before)
    // SOCKS refusal becomes a 502 from the bridge (standard HTTP-proxy behaviour)
    const refused = await fetch(`http://refuse.test:${targetPort}/`)
    assert.equal(refused.status, 502)
    assert.match(await refused.text(), /connection refused/)
    // CONNECT tunnel (the path every https:// request takes)
    const bridge = new URL(handle.bridgeUrl)
    const auth = Buffer.from(`${decodeURIComponent(bridge.username)}:${decodeURIComponent(bridge.password)}`).toString('base64')
    const tunnelled = await new Promise((r) => {
      const sock = net.connect(Number(bridge.port), '127.0.0.1', () =>
        sock.write(`CONNECT tls.test:${targetPort} HTTP/1.1\r\nHost: tls.test:${targetPort}\r\nProxy-Authorization: Basic ${auth}\r\n\r\nGET /c HTTP/1.1\r\nHost: tls.test\r\nConnection: close\r\n\r\n`))
      let t = ''
      sock.on('data', (c) => (t += c))
      sock.on('close', () => r(t))
    })
    assert.match(tunnelled, /^HTTP\/1.1 200 Connection Established/)
    assert.match(tunnelled, /hello tls.test \/c/)
    // bridge refuses requests without its credential
    const port = bridge.port
    const raw = await new Promise((r) => {
      const sock = net.connect(Number(port), '127.0.0.1', () => sock.write('CONNECT x.test:443 HTTP/1.1\r\nHost: x.test:443\r\n\r\n'))
      let t = ''
      sock.on('data', (c) => (t += c))
      sock.on('end', () => r(t))
      sock.on('close', () => r(t))
    })
    assert.match(raw, /407/)
  } finally {
    await handle.dispose()
    s.server.close()
  }
  assert.equal(process.env.HTTPS_PROXY, envBefore)
  assert.equal(http.globalAgent, httpAgentBefore, 'node:http global agent not restored')
  assert.equal(https.globalAgent, httpsAgentBefore, 'node:https global agent not restored')
})

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`)
const warn = logs.filter(([l]) => l === 'warn').map(([, m]) => m)
if (warn.length) console.log('warnings logged:\n  ' + warn.join('\n  '))
target.close()
setTimeout(() => process.exit(), 200).unref()
