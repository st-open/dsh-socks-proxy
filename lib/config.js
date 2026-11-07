/** Config normalization: plain JS, no schema library needed. */
import { parseProxyInput } from './parse-proxy.js'

export const MODES = ['off', 'llm', 'dsh', 'all']
export const PROXY_TYPES = ['socks5', 'http', 'https']

export const DEFAULTS = {
  mode: 'llm',
  proxy: '',
  socks: {
    type: 'socks5',
    host: '127.0.0.1',
    port: 7890,
    username: '',
    password: '',
    passwordEnv: '',
    remoteDns: true,
    timeoutMs: 15000,
  },
  llmHosts: [],
  providers: [],
  builtinHosts: true,
  bypass: [],
  bypassPrivate: true,
  exportToChildren: true,
  patchNodeHttp: true,
  logTunnels: false,
  // Dedicated upstream for LLM API hosts (optional). When set, LLM hosts use this proxy while every
  // other proxied host keeps the primary `socks`. This is how "DSH via one proxy, LLM via another"
  // is expressed (choose the "all" mode).
  llmProxyEnabled: false,
  llmProxy: '',
}

/** Read a schemastery `.volatile()` reference (an object with `.get()`) or a plain value. */
export function unref(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof value.get === 'function' ? value.get() : value
}

function list(value) {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof value === 'string') {
    const text = value.trim()
    if (text.startsWith('[')) {
      try {
        return list(JSON.parse(text))
      } catch {}
    }
    return text.split(/[,\s，；;]+/).map((s) => s.trim()).filter(Boolean)
  }
  return []
}


/**
 * Build one upstream proxy object from a raw slice `{ inputMode, proxy, proxyType, host, port,
 * username, password, remoteDns }`, falling back to `base` (a DEFAULTS.socks-like object). Throws
 * on an unparseable `proxy` or an invalid host/port. Shared by the primary and the LLM upstream.
 */
export function normalizeUpstream(raw, base, env) {
  const socks = { ...base, ...(raw.socks ?? {}) }
  if (!PROXY_TYPES.includes(socks.type)) socks.type = 'socks5'

  if (raw.inputMode === 'fields') {
    if (PROXY_TYPES.includes(raw.proxyType)) socks.type = raw.proxyType
    if (typeof raw.host === 'string' && raw.host.trim()) socks.host = raw.host.trim().replace(/^\[|\]$/g, '')
    if (raw.port !== undefined && raw.port !== '') socks.port = Number(raw.port)
    if (typeof raw.username === 'string') socks.username = raw.username
    if (typeof raw.password === 'string') socks.password = raw.password
    if (typeof raw.remoteDns === 'boolean') socks.remoteDns = raw.remoteDns
  } else if (typeof raw.proxy === 'string' && raw.proxy.trim()) {
    const parsed = parseProxyInput(raw.proxy)
    if (!parsed) throw new Error(`cannot read a proxy address from proxy: ${JSON.stringify(raw.proxy.replace(/:[^:@/]*@/, ':***@'))}`)
    Object.assign(socks, { type: parsed.type, host: parsed.host, port: parsed.port, remoteDns: parsed.remoteDns })
    if (parsed.username) socks.username = parsed.username
    if (parsed.password) socks.password = parsed.password
  }
  if (socks.passwordEnv && env[socks.passwordEnv] !== undefined) socks.password = env[socks.passwordEnv]
  socks.port = Number(socks.port)
  if (!socks.host || !Number.isInteger(socks.port) || socks.port < 1 || socks.port > 65535) {
    throw new Error(`invalid proxy server ${socks.host}:${socks.port}`)
  }
  socks.timeoutMs = Number(socks.timeoutMs) > 0 ? Number(socks.timeoutMs) : base.timeoutMs
  return socks
}

export const SLOT_NAMES = ['dsh', 'llm', 'global']
const SLOT_KEYS = { dsh: 'dshProxy', llm: 'llmProxy', global: 'globalProxy' }
const EMPTY_BASE = { ...DEFAULTS.socks, host: '', port: 0 }

function sameUpstream(a, b) {
  return a.type === b.type && a.host === b.host && a.port === b.port && a.username === b.username && a.password === b.password && a.remoteDns === b.remoteDns
}

/**
 * Schema 2: three independent proxy slots, each a proxy address (empty = not filled).
 *   dshProxy    - DSH's own traffic (search, fetch, MCP, terminal commands)
 *   llmProxy    - LLM API traffic
 *   globalProxy - the default for both of the above that has no slot of its own
 * A slot that is filled switches its traffic class on, so there is no separate on/off. The slots are
 * folded into the same {mode, socks, llmSocks} shape the router has always used.
 */
function normalizeSlots(raw, env) {
  const slots = {}
  for (const name of SLOT_NAMES) {
    const text = typeof raw[SLOT_KEYS[name]] === 'string' ? raw[SLOT_KEYS[name]].trim() : ''
    if (!text) continue
    try {
      slots[name] = normalizeUpstream({ inputMode: 'url', proxy: text }, EMPTY_BASE, env)
    } catch (error) {
      throw new Error(`${SLOT_KEYS[name]}: ${error.message}`)
    }
  }
  const dsh = slots.dsh ?? slots.global
  const llm = slots.llm ?? slots.global
  let mode = 'off'
  let socks = { ...DEFAULTS.socks }
  let llmSocks
  if (dsh && llm) {
    mode = 'all'
    socks = dsh
    if (!sameUpstream(dsh, llm)) llmSocks = llm
  } else if (dsh) {
    mode = 'dsh'
    socks = dsh
  } else if (llm) {
    mode = 'llm'
    socks = llm
  }
  return { ...commonSettings(raw), mode, socks, llmProxyEnabled: Boolean(llmSocks), llmSocks, slots }
}

function commonSettings(raw) {
  const bool = (key) => (typeof raw[key] === 'boolean' ? raw[key] : DEFAULTS[key])
  return {
    llmHosts: list(raw.llmHosts),
    providers: list(raw.providers),
    builtinHosts: bool('builtinHosts'),
    bypass: list(raw.bypass),
    bypassPrivate: bool('bypassPrivate'),
    exportToChildren: bool('exportToChildren'),
    patchNodeHttp: bool('patchNodeHttp'),
    logTunnels: bool('logTunnels'),
  }
}

/**
 * @param {any} input - the plugin entry's `config` (may hold volatile references).
 * @param {NodeJS.ProcessEnv} env
 */
export function normalizeConfig(input = {}, env = process.env) {
  input ??= {}
  const raw = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, unref(v)]))
  if (typeof raw.bypassPrivate === 'string') raw.bypassPrivate = raw.bypassPrivate !== 'false'
  if (Number(raw.schema) === 2) return normalizeSlots(raw, env)
  // YAML 1.1 readers turn a bare `off` into false.
  const mode = raw.mode === false ? 'off' : MODES.includes(raw.mode) ? raw.mode : DEFAULTS.mode
  // `socks` is the primary upstream proxy, whatever its kind; the name is kept for compatibility.
  const socks = normalizeUpstream(raw, DEFAULTS.socks, env)

  const bool = (key) => (typeof raw[key] === 'boolean' ? raw[key] : DEFAULTS[key])

  // Dedicated LLM upstream (optional). Parsed only when enabled and non-empty; a malformed LLM
  // proxy never breaks the primary routing.
  // The LLM uses its own upstream whenever llmProxy is a non-empty valid proxy; empty = primary.
  const llmProxyText = typeof raw.llmProxy === 'string' ? raw.llmProxy.trim() : ''
  let llmSocks
  if (llmProxyText) {
    llmSocks = normalizeUpstream({ inputMode: 'url', proxy: raw.llmProxy }, { ...DEFAULTS.socks, host: '', port: 0 }, env)
  }

  return {
    mode,
    socks,
    llmHosts: list(raw.llmHosts),
    providers: list(raw.providers),
    builtinHosts: bool('builtinHosts'),
    bypass: list(raw.bypass),
    bypassPrivate: bool('bypassPrivate'),
    exportToChildren: bool('exportToChildren'),
    patchNodeHttp: bool('patchNodeHttp'),
    logTunnels: bool('logTunnels'),
    llmProxyEnabled: Boolean(llmSocks),
    llmSocks,
  }
}
