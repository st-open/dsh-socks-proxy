/**
 * Minimal HTTP proxy client: CONNECT tunnels through an upstream HTTP proxy (`http://`) or an
 * HTTP proxy reached over TLS (`https://`), with optional Basic authentication.
 * No third-party dependency.
 */
import net from 'node:net'
import tls from 'node:tls'

const MAX_HEADER_BYTES = 64 * 1024

function authority(host, port) {
  const bare = String(host).replace(/^\[|\]$/g, '')
  return `${net.isIPv6(bare) ? `[${bare}]` : bare}:${port}`
}

/** `Proxy-Authorization` header value, or undefined without a username. */
export function proxyAuthorization(proxy) {
  if (!proxy.username) return undefined
  return `Basic ${Buffer.from(`${proxy.username}:${proxy.password ?? ''}`, 'utf8').toString('base64')}`
}

/** Open a TCP (or TLS, for `https` proxies) connection to the proxy server itself. */
function openProxySocket(proxy) {
  if (proxy.type === 'https') {
    return tls.connect({
      host: proxy.host,
      port: proxy.port,
      servername: net.isIP(proxy.host) ? undefined : proxy.host,
      ALPNProtocols: ['http/1.1'],
    })
  }
  return net.connect({ host: proxy.host, port: proxy.port })
}

/** Wait for the socket to be usable: `connect` for TCP, `secureConnect` for TLS. */
function whenOpen(socket, proxy) {
  return new Promise((resolve, reject) => {
    socket.once(proxy.type === 'https' ? 'secureConnect' : 'connect', resolve)
    socket.once('error', reject)
  })
}

/**
 * Read one HTTP response head from a socket.
 * @returns {Promise<{ status: number, statusText: string, headers: Record<string, string>, rest: Buffer }>}
 */
function readResponseHead(socket) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0)
    const cleanup = () => {
      socket.off('data', onData)
      socket.off('end', onEnd)
      socket.off('error', onError)
    }
    const onError = (error) => {
      cleanup()
      reject(error)
    }
    const onEnd = () => {
      cleanup()
      reject(Object.assign(new Error('the server closed the connection without an HTTP response (not an HTTP proxy?)'), { code: 'ENOTHTTP' }))
    }
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      // The very first byte tells an HTTP proxy ("H") apart from e.g. a SOCKS5 server (0x05).
      if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') !== 'HTTP/') {
        cleanup()
        reject(Object.assign(new Error(`not an HTTP proxy (reply starts with ${JSON.stringify(buffer.subarray(0, 8).toString('latin1'))})`), { code: 'ENOTHTTP' }))
        return
      }
      const end = buffer.indexOf('\r\n\r\n')
      if (end === -1) {
        if (buffer.length > MAX_HEADER_BYTES) {
          cleanup()
          reject(Object.assign(new Error('HTTP proxy response head too large'), { code: 'ENOTHTTP' }))
        }
        return
      }
      cleanup()
      const lines = buffer.subarray(0, end).toString('latin1').split('\r\n')
      const match = /^HTTP\/\d(?:\.\d)?\s+(\d{3})\s*(.*)$/.exec(lines[0])
      if (!match) {
        reject(Object.assign(new Error(`malformed HTTP status line: ${JSON.stringify(lines[0].slice(0, 60))}`), { code: 'ENOTHTTP' }))
        return
      }
      const headers = {}
      for (const line of lines.slice(1)) {
        const i = line.indexOf(':')
        if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim()
      }
      resolve({ status: Number(match[1]), statusText: match[2], headers, rest: buffer.subarray(end + 4) })
    }
    socket.on('data', onData)
    socket.once('end', onEnd)
    socket.once('error', onError)
  })
}

function withTimeout(socket, timeoutMs, describe) {
  const timer = setTimeout(() => socket.destroy(Object.assign(new Error(describe()), { code: 'ETIMEDOUT' })), timeoutMs)
  return () => clearTimeout(timer)
}

function statusError(status, statusText, proxy, target) {
  if (status === 407) {
    return Object.assign(
      new Error(proxy.username ? 'HTTP proxy: authentication failed (check username/password)' : 'HTTP proxy: server requires username/password authentication'),
      { code: proxy.username ? 'EAUTH' : 'EAUTHREQUIRED', status },
    )
  }
  return Object.assign(new Error(`HTTP proxy: CONNECT ${target} failed: ${status} ${statusText}`.trim()), { code: 'ECONNECTFAILED', status })
}

/**
 * Open a tunnel to `host:port` through an HTTP proxy with CONNECT.
 *
 * @param {{ type: 'http' | 'https', host: string, port: number, username?: string, password?: string, timeoutMs?: number }} proxy
 * @returns {Promise<{ socket: import('node:net').Socket, head: Buffer }>}
 */
export async function httpConnect(proxy, host, port, signal) {
  const socket = openProxySocket(proxy)
  socket.setNoDelay?.(true)
  const target = authority(host, port)
  const timeoutMs = proxy.timeoutMs ?? 15000
  const clear = withTimeout(socket, timeoutMs, () => `HTTP proxy tunnel via ${proxy.host}:${proxy.port} to ${target} timed out after ${timeoutMs} ms`)
  const onAbort = () => socket.destroy(signal.reason ?? new Error('aborted'))
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    await whenOpen(socket, proxy)
    const auth = proxyAuthorization(proxy)
    socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n${auth ? `Proxy-Authorization: ${auth}\r\n` : ''}Proxy-Connection: Keep-Alive\r\n\r\n`)
    const response = await readResponseHead(socket)
    if (response.status < 200 || response.status > 299) throw statusError(response.status, response.statusText, proxy, target)
    return { socket, head: response.rest }
  } catch (error) {
    socket.destroy()
    throw error
  } finally {
    clear()
    signal?.removeEventListener('abort', onAbort)
  }
}

/** A host that can never resolve (RFC 6761 `.invalid`), so the check never reaches any website. */
const CHECK_URL = 'http://dsh-proxy-check.invalid/'

/**
 * Check the HTTP proxy itself: TCP (or TLS) connect, one HTTP exchange, and authentication.
 *
 * The request targets an `.invalid` host, which no DNS can resolve, so no website is contacted.
 * A proxy checks credentials first: `407` means the login is missing or wrong; any other HTTP
 * answer (typically 502/503/504 for the unresolvable host) means the proxy works and accepted us.
 *
 * @returns {Promise<{ tcpMs: number, handshakeMs: number, auth: 'none' | 'password', status: number }>}
 */
export async function httpProxyCheck(proxy) {
  const started = Date.now()
  const socket = openProxySocket(proxy)
  const timeoutMs = proxy.timeoutMs ?? 10000
  let stage = 'tcp'
  const timer = setTimeout(
    () =>
      socket.destroy(
        Object.assign(
          new Error(stage === 'tcp' ? `connecting to ${proxy.host}:${proxy.port} timed out after ${timeoutMs} ms` : `no HTTP reply from ${proxy.host}:${proxy.port} within ${timeoutMs} ms (not an HTTP proxy?)`),
          { code: 'ETIMEDOUT', stage },
        ),
      ),
    timeoutMs,
  )
  try {
    await whenOpen(socket, proxy)
    const tcpMs = Date.now() - started
    stage = 'handshake'
    const auth = proxyAuthorization(proxy)
    socket.write(`GET ${CHECK_URL} HTTP/1.1\r\nHost: dsh-proxy-check.invalid\r\n${auth ? `Proxy-Authorization: ${auth}\r\n` : ''}User-Agent: dsh-socks-proxy-check\r\nConnection: close\r\n\r\n`)
    const response = await readResponseHead(socket)
    if (response.status === 407) throw Object.assign(statusError(407, '', proxy, CHECK_URL), { stage })
    return { tcpMs, handshakeMs: Date.now() - started - tcpMs, auth: proxy.username ? 'password' : 'none', status: response.status }
  } catch (error) {
    if (error && typeof error === 'object' && !error.stage) error.stage = stage
    throw error
  } finally {
    clearTimeout(timer)
    socket.destroy()
  }
}
