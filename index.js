/**
 * dsh-socks-proxy — route DSH outbound traffic through a SOCKS5 proxy.
 *
 * Config (entry id `socks-proxy`): edited on the Plugins page (browser half in client.js) or in the
 * profile's cordis.patch.yml. `mode`, `proxy`, `bypassPrivate`, `bypass` and `llmHosts` are
 * volatile: saving them re-routes traffic immediately, no restart needed.
 */
import { normalizeConfig } from './lib/config.js'
import { describeUpstream } from './lib/dial.js'
import { importHostPackage } from './lib/host-modules.js'
import { installSocksRouting } from './lib/install.js'
import { createLlmHostSource, providerEndpoints } from './lib/llm-hosts.js'
import { probeEndpoints, probeSocks } from './lib/probe.js'

/** Exact Host route the Plugins page posts to for "测试连接" (browser auth required). */
export const TEST_ROUTE = '/api/socks-proxy/test'
/** Process-wide slot holding the live test handler, so a route registered by an earlier instance still works. */
const TEST_HANDLER = Symbol.for('local.dsh-socks-proxy.test-handler')

export const name = 'dsh-socks-proxy'

let Schema
try {
  const mod = await importHostPackage('@deepseek-ai/schemastery')
  Schema = mod.default ?? mod
} catch {
  Schema = undefined
}

const hostList = () => (Schema ? Schema.union([Schema.array(Schema.string()), Schema.string()]).default([]) : undefined)

/** Plugin config schema; volatile fields are editable from the Plugins page without a remount. */
export const Config = Schema
  ? Schema.object({
      mode: Schema.union(['off', 'llm', 'dsh', 'all']).default('llm').volatile(),
      // url = paste an address / command into `proxy`; fields = type/host/port/username/password boxes
      inputMode: Schema.union(['url', 'fields']).default('url').volatile(),
      proxy: Schema.string().default('').volatile(),
      proxyType: Schema.union(['socks5', 'http', 'https']).default('socks5').volatile(),
      host: Schema.string().default('').volatile(),
      port: Schema.union([Schema.number(), Schema.string()]).default('').volatile(),
      username: Schema.string().default('').volatile(),
      password: Schema.string().default('').volatile(),
      remoteDns: Schema.boolean().default(true).volatile(),
      bypassPrivate: Schema.boolean().default(true).volatile(),
      bypass: hostList().volatile(),
      llmHosts: hostList().volatile(),
      // Dedicated LLM upstream (optional): LLM hosts use llmProxy; other proxied hosts keep `proxy`.
      llmProxyEnabled: Schema.boolean().default(false).volatile(),
      llmProxy: Schema.string().default('').volatile(),
      providers: hostList(),
      builtinHosts: Schema.boolean().default(true),
      exportToChildren: Schema.boolean().default(true),
      patchNodeHttp: Schema.boolean().default(true),
      logTunnels: Schema.boolean().default(false),
      socks: Schema.object({
        type: Schema.union(['socks5', 'http', 'https']),
        host: Schema.string(),
        port: Schema.number(),
        username: Schema.string(),
        password: Schema.string(),
        passwordEnv: Schema.string(),
        remoteDns: Schema.boolean(),
        timeoutMs: Schema.number(),
      }),
    })
  : undefined

function makeLogger(ctx) {
  try {
    const logger = typeof ctx.logger === 'function' ? ctx.logger('socks-proxy') : ctx.logger
    if (logger && typeof logger.info === 'function') return logger
  } catch {}
  return { info: console.log, warn: console.warn, debug() {} }
}

export function apply(ctx, rawConfig) {
  const logger = makeLogger(ctx)
  const getLoader = () => {
    try {
      return ctx.get?.('loader') ?? ctx.loader
    } catch {
      return undefined
    }
  }

  // This plugin draws its own page on the Plugins screen; opt out of schema auto-generation.
  try {
    ctx.inject?.(['settings'], (child) => {
      child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
    })
  } catch {}

  // "测试连接": the page posts its (possibly unsaved) fields; we probe without touching live routing.
  // The route outlives this plugin instance (it is owned by the Connection service), so it
  // dispatches through a process-wide slot and registration failures are tolerated.
  globalThis[TEST_HANDLER] = async (request) => {
    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ ok: false, stage: 'config', code: 'bad-request', message: 'JSON body required' }, { status: 400 })
    }
    let config
    try {
      const draft = body && typeof body.config === 'object' ? body.config : {}
      config = normalizeConfig({ ...rawConfig, ...draft })
    } catch (error) {
      return Response.json({ ok: false, stage: 'config', code: 'bad-config', message: error.message })
    }
    try {
      const socks = await probeSocks(config.socks)
      logger.info(`socks-proxy: test ${describeUpstream(config.socks)} -> ${socks.ok ? `ok (auth ${socks.auth}, ${socks.totalMs} ms)` : `${socks.code}: ${socks.message}`}`)
      const result = { ...socks }
      // Probe the dedicated LLM upstream as well, so the page can report it separately.
      if (config.llmProxyEnabled && config.llmSocks) {
        try {
          const llm = await probeSocks(config.llmSocks)
          result.llmUpstream = { ...llm }
          logger.info(`socks-proxy: test llm-upstream ${describeUpstream(config.llmSocks)} -> ${llm.ok ? `ok (${llm.totalMs} ms)` : `${llm.code}: ${llm.message}`}`)
        } catch (error) {
          result.llmUpstream = { ok: false, code: 'internal', message: String(error?.message ?? error) }
        }
      }
      // Also check every configured model endpoint the way these settings would reach it.
      if (body?.checkEndpoints !== false) {
        try {
          const llmHosts = createLlmHostSource(getLoader, config)
          result.endpoints = await probeEndpoints(config, providerEndpoints(getLoader, config), llmHosts)
          for (const e of result.endpoints) logger.info(`socks-proxy: endpoint ${e.route} ${e.baseURL} via ${e.via} -> ${e.ok ? `ok ${e.ms} ms` : `${e.code}: ${e.message}`}`)
        } catch (error) {
          result.endpointsError = String(error?.message ?? error)
        }
      }
      return Response.json(result)
    } catch (error) {
      return Response.json({ ok: false, stage: 'internal', code: 'internal', message: String(error?.message ?? error) })
    }
  }
  try {
    ctx.inject?.(['connection'], (child) => {
      const register = child.connection?.fetch?.register
      if (typeof register !== 'function') return
      try {
        child.connection.fetch.register({
          path: TEST_ROUTE,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: (request) =>
            typeof globalThis[TEST_HANDLER] === 'function'
              ? globalThis[TEST_HANDLER](request)
              : Response.json({ ok: false, stage: 'config', code: 'not-loaded', message: 'plugin is not loaded' }, { status: 503 }),
        })
      } catch (error) {
        // A previous instance already owns the path; its handler reads the same process-wide slot.
        if (!/already registered/i.test(String(error?.message ?? error))) throw error
      }
    })
  } catch (error) {
    logger.warn(`socks-proxy: test route unavailable: ${error?.message ?? error}`)
  }

  let handle
  let chain = Promise.resolve()
  let stopped = false

  const restart = (reason) => {
    chain = chain.then(async () => {
      if (handle) {
        await handle.dispose()
        handle = undefined
      }
      if (stopped) return
      let config
      try {
        config = normalizeConfig(rawConfig)
      } catch (error) {
        logger.warn(`socks-proxy: invalid config, proxy NOT enabled: ${error.message}`)
        return
      }
      if (config.mode === 'off') {
        logger.info(`socks-proxy: mode=off, nothing routed${reason ? ` (${reason})` : ''}`)
        return
      }
      const llmHosts = createLlmHostSource(getLoader, config)
      try {
        handle = await installSocksRouting(config, { llmHosts, logger })
      } catch (error) {
        logger.warn(`socks-proxy: failed to start, traffic stays on its previous route: ${error?.message ?? error}`)
        return
      }
      const where = describeUpstream(config.socks)
      const llmWhere = handle.hasLlmUpstream ? `; LLM hosts via ${describeUpstream(config.llmSocks)}` : ''
      if (config.mode === 'llm') {
        const hosts = llmHosts().filter((h) => handle.shouldProxy(new URL(`https://${h.includes(':') && !h.startsWith('[') ? `[${h}]` : h}`)))
        logger.info(`socks-proxy: mode=llm via ${where}; LLM hosts now: ${hosts.join(', ') || '(none)'}`)
      } else if (config.mode === 'dsh') {
        logger.info(`socks-proxy: mode=dsh via ${where} (DSH's own traffic proxied; LLM hosts stay direct)${handle.viaDshPolicy ? ' (DSH proxy policy: web_fetch and child processes included)' : ''}`)
      } else {
        logger.info(`socks-proxy: mode=all via ${where}${llmWhere}${handle.viaDshPolicy ? ' (DSH proxy policy: web_fetch and child processes included)' : ''}`)
      }
    })
    return chain
  }

  // Saving on the Plugins page commits volatile fields in place and announces it here.
  ctx.on?.('loader/volatile-update', () => {
    restart('settings changed')
  })

  ctx.effect(() => {
    restart()
    return async () => {
      stopped = true
      await restart()
      logger.info('socks-proxy: stopped, previous routing restored')
    }
  }, 'socks-proxy')
}
