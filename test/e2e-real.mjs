// Optional end-to-end check with real TLS: a pass-through SOCKS5 server on loopback that dials the
// real destination, and the plugin in mode=llm routing https://<host> through it.
//   node test/e2e-real.mjs [https://api.deepseek.com/] [socks5h://user:pass@host:port]
// With a second argument, the real SOCKS5 server is used instead of the local pass-through one.
import net from 'node:net'
import { normalizeConfig } from '../lib/config.js'
import { installSocksRouting } from '../lib/install.js'

const url = new URL(process.argv[2] ?? 'https://api.deepseek.com/')
let proxy = process.argv[3]
const seen = []
let server
if (!proxy) {
  server = net.createServer((c) => {
    c.on('error', () => {})
    c.once('data', () => {
      c.write(Buffer.from([5, 0]))
      c.once('data', (req) => {
        let host, off
        if (req[3] === 3) { host = req.subarray(5, 5 + req[4]).toString(); off = 5 + req[4] }
        else { host = [...req.subarray(4, 8)].join('.'); off = 8 }
        const port = req.readUInt16BE(off)
        seen.push(`${host}:${port}`)
        const up = net.connect(port, host, () => {
          c.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]))
          c.pipe(up); up.pipe(c)
        })
        up.on('error', () => c.end(Buffer.from([5, 4, 0, 1, 0, 0, 0, 0, 0, 0])))
      })
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  proxy = `socks5h://127.0.0.1:${server.address().port}`
}
const config = normalizeConfig({ mode: 'llm', proxy, builtinHosts: false, llmHosts: [url.hostname] })
const handle = await installSocksRouting(config, { llmHosts: () => config.llmHosts, logger: { info: console.log, warn: console.warn } })
try {
  const t0 = Date.now()
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  console.log(`GET ${url} -> HTTP ${res.status} in ${Date.now() - t0} ms`)
  await res.arrayBuffer()
  if (server) console.log(`pass-through SOCKS5 saw: ${seen.join(', ')}`)
} finally {
  await handle.dispose()
  server?.close()
}
