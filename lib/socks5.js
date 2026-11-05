/**
 * Minimal SOCKS5 client (RFC 1928 CONNECT + RFC 1929 username/password).
 * No third-party dependency: one TCP connection to the SOCKS server per tunnel.
 */
import net from 'node:net'

const REPLY_MESSAGES = {
  0x01: 'general SOCKS server failure',
  0x02: 'connection not allowed by ruleset',
  0x03: 'network unreachable',
  0x04: 'host unreachable',
  0x05: 'connection refused',
  0x06: 'TTL expired',
  0x07: 'command not supported',
  0x08: 'address type not supported',
}

/** Reads exactly-sized chunks from a socket during the handshake. */
function createReader(socket) {
  let buffer = Buffer.alloc(0)
  let waiter
  let failure
  const onData = (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    pump()
  }
  const onEnd = () => fail(new Error('SOCKS5 server closed the connection during handshake'))
  const onError = (error) => fail(error)
  function fail(error) {
    failure ??= error
    pump()
  }
  function pump() {
    if (!waiter) return
    if (failure) {
      const { reject } = waiter
      waiter = undefined
      reject(failure)
      return
    }
    if (buffer.length >= waiter.size) {
      const { resolve, size } = waiter
      waiter = undefined
      const out = buffer.subarray(0, size)
      buffer = buffer.subarray(size)
      resolve(out)
    }
  }
  socket.on('data', onData)
  socket.on('end', onEnd)
  socket.on('error', onError)
  return {
    read(size) {
      return new Promise((resolve, reject) => {
        waiter = { size, resolve, reject }
        pump()
      })
    },
    /** Detach and return any bytes received after the handshake. */
    release() {
      socket.off('data', onData)
      socket.off('end', onEnd)
      socket.off('error', onError)
      const rest = buffer
      buffer = Buffer.alloc(0)
      return rest
    },
  }
}

function encodeAddress(host, remoteDns) {
  const bare = host.replace(/^\[|\]$/g, '')
  const family = net.isIP(bare)
  if (family === 4) return Buffer.from([0x01, ...bare.split('.').map(Number)])
  if (family === 6) {
    const parts = expandIPv6(bare)
    const out = Buffer.alloc(17)
    out[0] = 0x04
    parts.forEach((part, i) => out.writeUInt16BE(part, 1 + i * 2))
    return out
  }
  if (!remoteDns) return undefined
  const name = Buffer.from(bare, 'utf8')
  if (name.length > 255) throw new Error(`SOCKS5: host name too long: ${bare}`)
  return Buffer.concat([Buffer.from([0x03, name.length]), name])
}

function expandIPv6(address) {
  let text = address
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(text)
  if (v4) {
    const [a, b, c, d] = v4[1].split('.').map(Number)
    text = text.slice(0, -v4[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head, tail] = text.split('::')
  const h = head ? head.split(':') : []
  const t = tail !== undefined ? (tail ? tail.split(':') : []) : []
  const fill = tail !== undefined ? 8 - h.length - t.length : 0
  return [...h, ...Array(fill).fill('0'), ...t].map((x) => Number.parseInt(x || '0', 16))
}

async function resolveLocally(host) {
  const { lookup } = await import('node:dns/promises')
  const { address } = await lookup(host)
  return address
}

/**
 * Greeting + optional RFC 1929 username/password login on a connected socket.
 * @returns {Promise<'none' | 'password'>} the method the server chose.
 */
async function negotiate(socket, reader, proxy) {
  const useAuth = Boolean(proxy.username)
  socket.write(Buffer.from(useAuth ? [0x05, 0x02, 0x00, 0x02] : [0x05, 0x01, 0x00]))
  const [version, method] = await reader.read(2)
  if (version !== 0x05) {
    const hint = version === 0x48 ? ' (it answered in HTTP, so this is probably an HTTP proxy port)' : ''
    throw new Error(`SOCKS5: server answered with version ${version}; is ${proxy.host}:${proxy.port} really a SOCKS5 proxy?${hint}`)
  }
  if (method === 0x02) {
    if (!useAuth) throw new Error('SOCKS5: server requires username/password authentication')
    const user = Buffer.from(proxy.username, 'utf8')
    const pass = Buffer.from(proxy.password ?? '', 'utf8')
    if (user.length > 255 || pass.length > 255) throw new Error('SOCKS5: username or password longer than 255 bytes')
    socket.write(Buffer.concat([Buffer.from([0x01, user.length]), user, Buffer.from([pass.length]), pass]))
    const [, status] = await reader.read(2)
    if (status !== 0x00) throw new Error('SOCKS5: authentication failed (check username/password)')
    return 'password'
  }
  if (method !== 0x00) {
    // We offered only "no auth" when no username is set; a refusal then means the server wants a login.
    if (method === 0xff && !useAuth) throw new Error('SOCKS5: server requires username/password authentication')
    throw new Error(method === 0xff ? 'SOCKS5: server accepted none of the offered authentication methods' : `SOCKS5: unexpected method ${method}`)
  }
  return 'none'
}

/**
 * Check the SOCKS5 server itself: TCP connect, SOCKS5 greeting and (if configured) login.
 * Opens no tunnel and contacts no destination.
 *
 * @param {object} proxy - `{ host, port, username?, password?, timeoutMs? }`
 * @returns {Promise<{ tcpMs: number, handshakeMs: number, auth: 'none' | 'password' }>}
 */
export async function socks5Check(proxy) {
  const started = Date.now()
  const socket = net.connect({ host: proxy.host, port: proxy.port })
  socket.setNoDelay(true)
  const timeoutMs = proxy.timeoutMs ?? 10000
  let stage = 'tcp'
  const timer = setTimeout(
    () => socket.destroy(Object.assign(new Error(stage === 'tcp' ? `connecting to ${proxy.host}:${proxy.port} timed out after ${timeoutMs} ms` : `SOCKS5 handshake with ${proxy.host}:${proxy.port} timed out after ${timeoutMs} ms (no SOCKS5 reply)`), { code: 'ETIMEDOUT', stage })),
    timeoutMs,
  )
  const reader = createReader(socket)
  try {
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('error', reject)
    })
    const tcpMs = Date.now() - started
    stage = 'handshake'
    const auth = await negotiate(socket, reader, proxy)
    return { tcpMs, handshakeMs: Date.now() - started - tcpMs, auth }
  } catch (error) {
    if (error && typeof error === 'object' && !error.stage) error.stage = stage
    throw error
  } finally {
    clearTimeout(timer)
    reader.release()
    socket.destroy()
  }
}

/**
 * Open a TCP tunnel to `host:port` through a SOCKS5 server.
 *
 * @param {object} proxy - `{ host, port, username?, password?, remoteDns?, timeoutMs? }`
 * @param {string} host - destination host name or IP literal.
 * @param {number} port - destination port.
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ socket: net.Socket, head: Buffer }>} connected socket plus any early bytes.
 */
export async function socks5Connect(proxy, host, port, signal) {
  const remoteDns = proxy.remoteDns !== false
  let address = encodeAddress(host, remoteDns)
  if (address === undefined) address = encodeAddress(await resolveLocally(host), true)

  const socket = net.connect({ host: proxy.host, port: proxy.port })
  socket.setNoDelay(true)
  const timeoutMs = proxy.timeoutMs ?? 15000
  const timer = setTimeout(() => socket.destroy(new Error(`SOCKS5 tunnel via ${proxy.host}:${proxy.port} to ${host}:${port} timed out after ${timeoutMs} ms (the proxy could not reach the destination in time)`)), timeoutMs)
  const onAbort = () => socket.destroy(signal.reason ?? new Error('aborted'))
  signal?.addEventListener('abort', onAbort, { once: true })
  const reader = createReader(socket)
  try {
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('error', reject)
    })
    await negotiate(socket, reader, proxy)
    const portBuf = Buffer.alloc(2)
    portBuf.writeUInt16BE(port)
    socket.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00]), address, portBuf]))
    const [ver, rep, , atyp] = await reader.read(4)
    if (ver !== 0x05) throw new Error('SOCKS5: malformed CONNECT reply')
    if (rep !== 0x00) throw new Error(`SOCKS5: CONNECT ${host}:${port} failed: ${REPLY_MESSAGES[rep] ?? `code ${rep}`}`)
    if (atyp === 0x01) await reader.read(4 + 2)
    else if (atyp === 0x04) await reader.read(16 + 2)
    else if (atyp === 0x03) {
      const [len] = await reader.read(1)
      await reader.read(len + 2)
    } else throw new Error(`SOCKS5: unknown bound address type ${atyp}`)
    const head = reader.release()
    return { socket, head }
  } catch (error) {
    reader.release()
    socket.destroy()
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
