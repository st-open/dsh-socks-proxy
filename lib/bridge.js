/**
 * Loopback HTTP proxy that forwards every request through the upstream proxy (SOCKS5 or HTTP).
 *
 * Undici's ProxyAgent, `node:http` proxyEnv, curl, git, pnpm... all speak HTTP proxy but not
 * SOCKS5. Bridging once here lets every one of them reach the upstream, and lets the plugin reuse
 * DSH's own HTTP-proxy machinery instead of reimplementing TLS-over-tunnel. For an HTTP upstream
 * the bridge also keeps the upstream's credentials out of every child process's environment.
 *
 * The bridge listens on 127.0.0.1 only and requires a random per-process Basic credential, so
 * other local users cannot borrow it.
 */
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { dialThrough, isHttpUpstream } from './dial.js'
import { proxyAuthorization } from './http-connect.js'

function parseAuthority(authority, defaultPort) {
  const match = /^\[([^\]]+)\](?::(\d+))?$/.exec(authority) ?? /^([^:]+)(?::(\d+))?$/.exec(authority)
  if (!match) return undefined
  const port = match[2] === undefined ? defaultPort : Number(match[2])
  if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined
  return { host: match[1], port }
}

/**
 * @param {object} options
 * @param {object} options.upstream - upstream proxy settings (see lib/dial.js); `socks` is accepted as an alias.
 * @param {(msg: string) => void} [options.onError] - receives tunnel failures (never credentials).
 * @param {(host: string, port: number) => void} [options.onTunnel] - observes every tunnel opened.
 * @returns {Promise<{ url: string, port: number, close: () => Promise<void> }>}
 */
export async function startBridge({ upstream: upstreamOption, socks, onError = () => {}, onTunnel = () => {} }) {
  const upstreamProxy = upstreamOption ?? socks
  const user = 'dsh'
  const token = randomBytes(18).toString('base64url')
  const expected = Buffer.from(`Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`)
  const sockets = new Set()

  const authorized = (req) => {
    const got = Buffer.from(String(req.headers['proxy-authorization'] ?? ''))
    return got.length === expected.length && timingSafeEqual(got, expected)
  }

  const server = http.createServer(async (req, res) => {
    if (!authorized(req)) {
      res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="dsh-socks-proxy"' }).end()
      return
    }
    let target
    try {
      target = new URL(req.url)
    } catch {
      res.writeHead(400).end('absolute-form request URL required')
      return
    }
    if (target.protocol !== 'http:') {
      res.writeHead(400).end('only http: is forwarded in absolute form; use CONNECT for https')
      return
    }
    const port = Number(target.port || 80)
    try {
      onTunnel(target.hostname, port)
      const headers = { ...req.headers }
      delete headers['proxy-authorization']
      delete headers['proxy-connection']
      let upstream
      if (isHttpUpstream(upstreamProxy)) {
        // Plain http:// through an HTTP proxy is forwarded in absolute form, not tunnelled:
        // many proxies (squid's default) only allow CONNECT to port 443.
        const auth = proxyAuthorization(upstreamProxy)
        if (auth) headers['proxy-authorization'] = auth
        const transport = upstreamProxy.type === 'https' ? https : http
        upstream = transport.request({
          host: upstreamProxy.host,
          port: upstreamProxy.port,
          servername: upstreamProxy.type === 'https' && !net.isIP(upstreamProxy.host) ? upstreamProxy.host : undefined,
          method: req.method,
          path: target.href,
          headers,
          agent: false,
          timeout: upstreamProxy.timeoutMs ?? 15000,
        })
        upstream.on('timeout', () => upstream.destroy(Object.assign(new Error('HTTP proxy did not answer in time'), { code: 'ETIMEDOUT' })))
      } else {
        const { socket, head } = await dialThrough(upstreamProxy, target.hostname, port)
        if (head.length) socket.unshift(head)
        upstream = http.request({
          method: req.method,
          path: target.pathname + target.search,
          headers,
          // No `agent`: Node only honours createConnection when the agent option is absent.
          createConnection: () => socket,
        })
      }
      upstream.on('response', (up) => {
        res.writeHead(up.statusCode ?? 502, up.rawHeaders)
        up.pipe(res)
      })
      upstream.on('error', (error) => {
        onError(`HTTP ${target.host}: ${error.code ?? ''} ${error.message} ${process.env.DSH_SOCKS_PROXY_DEBUG ? `${error.address}:${error.port} ${error.stack}` : ''}`.trim())
        if (!res.headersSent) res.writeHead(502).end(error.message)
        else res.destroy()
      })
      req.pipe(upstream)
    } catch (error) {
      onError(`HTTP ${target.host}: ${error.code ?? ''} ${error.message} ${process.env.DSH_SOCKS_PROXY_DEBUG ? error.stack : ''}`.trim())
      if (!res.headersSent) res.writeHead(502).end(error.message)
    }
  })

  server.on('connect', async (req, clientSocket, head) => {
    sockets.add(clientSocket)
    clientSocket.on('close', () => sockets.delete(clientSocket))
    clientSocket.on('error', () => {})
    if (!authorized(req)) {
      clientSocket.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="dsh-socks-proxy"\r\nContent-Length: 0\r\n\r\n')
      return
    }
    const target = parseAuthority(req.url, 443)
    if (!target) {
      clientSocket.end('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n')
      return
    }
    try {
      onTunnel(target.host, target.port)
      const { socket, head: early } = await dialThrough(upstreamProxy, target.host, target.port)
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
      socket.on('error', () => clientSocket.destroy())
      clientSocket.on('close', () => socket.destroy())
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (early.length) clientSocket.write(early)
      if (head?.length) socket.write(head)
      socket.pipe(clientSocket)
      clientSocket.pipe(socket)
    } catch (error) {
      onError(`CONNECT ${req.url}: ${error.message}`)
      const body = Buffer.from(error.message)
      clientSocket.end(`HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\nContent-Length: ${body.length}\r\n\r\n${body}`)
    }
  })
  server.on('clientError', (_error, socket) => socket.destroy())

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  return {
    port,
    url: `http://${user}:${token}@127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        for (const socket of sockets) socket.destroy()
        server.closeAllConnections?.()
        server.close(() => resolve())
      }),
  }
}
