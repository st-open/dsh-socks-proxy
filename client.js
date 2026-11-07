window.__ModuleLoader__.load({
  id: '@st-open/dsh-socks-proxy',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useRef, useEffect } = React;
    const P = require('@deepseek-ai/dsh-client-ui-primitives');

    /** Loader entry id of the Host half (see cordis.patch.yml). */
    const ENTRY_ID = 'socks-proxy';
    const PACKAGE = '@st-open/dsh-socks-proxy';
    const TEST_ROUTE = 'api/socks-proxy/test';
    const STATE_ROUTE = 'api/socks-proxy/state';
    /** Shown in the panel so a stale (cached) page is obvious. Keep in sync with package.json. */
    const PANEL_VERSION = '0.13.0';
    const NS = 'socksProxy';
    /** Legacy (schema 1) settings, only read to migrate an old config to the three slots. */
    const MODES = ['off', 'llm', 'dsh', 'all'];
    const PROXY_TYPES = ['socks5', 'http', 'https'];
    const TYPE_LABELS = { socks5: 'SOCKS5', http: 'HTTP', https: 'HTTPS' };
    /** The three proxies, in the order they are shown (left to right). */
    const SLOTS = ['dsh', 'llm', 'global'];
    const SLOT_FIELD = { dsh: 'dshProxy', llm: 'llmProxy', global: 'globalProxy' };
    const STYLE_ID = '@st-open/dsh-socks-proxy/panel.css';

    const zh = {
      proxyType: '代理类型',
      proxyTypeHint: 'HTTPS 表示与代理服务器之间使用 TLS 加密连接（https:// 代理）。',
      proxyPlaceholder: 'socks5h://user:pass@127.0.0.1:7890',
      invalidProxy: '没能识别出代理地址，请检查格式。',
      host: '服务器地址',
      hostPlaceholder: '127.0.0.1',
      port: '端口',
      portPlaceholder: '7890',
      username: '用户名',
      password: '密码',
      optional: '不需要认证可留空',
      showPassword: '显示密码',
      hidePassword: '隐藏密码',
      remoteDns: '由代理服务器解析域名',
      remoteDnsHint: '即 socks5h，推荐开启，可避免本地 DNS 被污染。',
      passwordNote: '用户名和密码以明文保存在 profile 的 cordis.patch.yml 中。',
      testButton: '测试连接',
      testing: '测试中…',
      'test.ok': '代理服务器正常',
      'test.okDetail': '{via} · TCP {tcp} ms · 握手 {handshake} ms',
      'test.auth.none': '无需认证',
      'test.auth.password': '账号认证通过',
      'test.fail': '代理服务器连接失败',
      testEndpoints: '模型接口',
      'test.via.proxy': '经代理',
      'test.via.direct': '直连',
      'test.noEndpoints': '模型设置里没有配置自定义接口地址。',
      bypassPrivate: '局域网地址直连',
      bypassPrivateHint: '10.x、172.16–31.x、192.168.x 等内网 IP 不走代理。如果内网模型地址只能经代理访问，请关闭。',
      bypass: '始终直连的主机',
      bypassHint: '逗号分隔；example.com 同时匹配子域名，“10.1.” 按 IP 前缀匹配。',
      llmHosts: '额外的大模型主机',
      'indicator.label': '代理',
      'state.off': '代理未开启',
      'state.error': '代理状态未知',
      'state.dsh': '已开启 · DSH 代理',
      'state.llm': '已开启 · 大模型代理',
      'state.all': '已开启 · 全部代理（同一条代理）',
      'state.split': '已开启 · DSH + 大模型代理（各自代理）',
      'short.off': '未开代理',
      'short.error': '状态未知',
      'short.dsh': 'DSH 代理',
      'short.llm': '大模型代理',
      'short.all': '全部代理',
      'short.split': 'DSH + 大模型',
      'indicator.on': '代理已开启：{mode}',
      'indicator.off': '代理已关闭',
      'indicator.error': '代理状态未知',
      'indicator.mode.off': '关闭',
      'indicator.mode.llm': '仅大模型',
      'indicator.mode.dsh': '仅 DSH 本身',
      'indicator.mode.all': '全部流量',
      overridden: '已修改',
      reset: '恢复默认',
      readOnly: '本部署的设置为只读。',
      unavailable: '插件的宿主部分尚未加载（新安装后需重启 DSH 一次），暂时无法配置。',
      saveFailed: '这些值未被接受，已保留供你修改。',
      save: '保存',
      saving: '保存中…',
      invalidValue: '取值无效。',
      'short.timeout': '超时',
      'short.refused': '连接被拒绝',
      'short.dns': '域名解析失败',
      'short.unreachable': '网络不可达',
      'short.reset': '连接被断开',
      'short.auth': '认证失败',
      'short.target': '代理无法访问',
      'short.failed': '失败',
      'err.bad-config': '配置无法解析：{message}',
      'err.auth': '用户名或密码错误，SOCKS5 服务器拒绝认证。',
      'err.auth-required': '服务器要求用户名/密码认证，请填写账号密码。',
      'err.auth-unsupported': '服务器不接受所给的认证方式。',
      'err.not-socks5': '端口能连上，但对方不是 SOCKS5 服务。如果这是 HTTP 代理，请把类型改成 HTTP。',
      'err.not-http-proxy': '端口能连上，但对方没有按 HTTP 代理应答。如果这是 SOCKS5 代理，请把类型改成 SOCKS5。',
      'err.proxy-tls': '与代理服务器的 TLS 握手失败（证书无效或对方不是 HTTPS 代理）。如果代理不支持 TLS，请把类型改成 HTTP。',
      'err.target-unreachable': '代理服务器拒绝或无法访问目标：{message}',
      'err.proxy-refused': '连接被拒绝：该地址/端口没有服务在监听，请检查端口和代理服务是否启动。',
      'err.proxy-dns': '无法解析代理服务器的域名。',
      'err.proxy-timeout': '连接代理服务器超时，请检查地址、端口、防火墙和网络。',
      'err.handshake-timeout': '端口能连上，但收不到 SOCKS5 应答（可能不是 SOCKS5 服务）。',
      'err.proxy-unreachable': '网络不可达，连不到代理服务器。',
      'err.proxy-reset': '代理服务器中途断开了连接。',
      'err.proxy-error': '连接代理服务器失败：{message}',
      'err.http': '测试请求没有送达插件（HTTP {status}）。刚安装或更新过插件的话，请重启 DSH。',
      'err.network': '无法与 DSH 后台通信：{message}',
      'err.internal': '插件内部错误：{message}',
      'err.bad-request': '请求格式错误。',
      'err.not-loaded': '插件的宿主部分没有在运行，请重启 DSH 后再试。',
      title: '代理（SOCKS5 / HTTP）',
      description: '让 DSH 走代理：DSH 代理、大模型代理、全局代理三类，共用一个填写框，填了哪一类就对哪一类生效。',
      'slot.dsh': 'DSH 代理',
      'slot.llm': '大模型代理',
      'slot.global': '全局代理',
      'slotScope.dsh': 'DSH 自身的联网：搜索、网页抓取、MCP、终端命令',
      'slotScope.llm': '大模型接口：模型设置里各 provider 的地址',
      'slotScope.global': '默认代理：左边两类没单独填写时，用它',
      'tile.filled': '已填写',
      'tile.empty': '未填写',
      'tile.addrNone': '尚未填写',
      'effect.direct': '实际：直连',
      'effect.own': '实际：走这条代理',
      'effect.followGlobal': '实际：跟随全局代理',
      'globalUse.both': 'DSH、大模型都用它',
      'globalUse.dsh': '目前只有 DSH 用它',
      'globalUse.llm': '目前只有大模型用它',
      'globalUse.none': '已被另外两条覆盖，暂时用不到',
      'globalUse.off': '未启用',
      editing: '正在编辑',
      emptyFollow: '留空 = 跟随全局代理。',
      emptyFollowNone: '留空 = 这类流量直连（全局代理也没填）。',
      emptyGlobal: '留空 = 没有默认代理，没有单独填写的流量直连。',
      clear: '清除这条',
      paste: '粘贴识别',
      pasteHint: '把服务商给的内容粘贴到这里，会自动填进下面的框：socks5:// 或 http(s):// 地址、export HTTPS_PROXY=…、curl -x … 命令，或 主机:端口:用户:密码。',
      pasteOk: '已识别为 {type} {addr}，已填入下面。',
      fields: '手动填写',
      incomplete: '地址和端口要填完整（端口 1–65535），否则无法保存。',
      migrated: '已把你原来的设置自动换成新的三类代理，确认无误后点「保存」。',
      testHint: '检测所有已填写的代理，以及各模型接口按当前设置能否连通。无需先保存；不访问网站、不发送模型请求。',
      'test.slotEmpty': '未填写，无需测试',
      'test.noProxy': '还没有填写任何代理，没有可测的内容。',
      'test.slotInvalid': '「{slot}」的地址还没填完整。',
      'err.no-proxy': '还没有填写任何代理，没有可测的内容。',
      rules: '例外规则',
      rulesDesc: '下面三项对三类代理都生效。',
      llmHostsHint: '被当作大模型接口的额外主机，逗号分隔；模型设置里的接口地址已自动包含。',
    };
    const en = {
      proxyType: 'Proxy type',
      proxyTypeHint: 'HTTPS means the connection to the proxy itself is TLS-encrypted (an https:// proxy).',
      proxyPlaceholder: 'socks5h://user:pass@127.0.0.1:7890',
      invalidProxy: 'No proxy address recognised; check the format.',
      host: 'Server',
      hostPlaceholder: '127.0.0.1',
      port: 'Port',
      portPlaceholder: '7890',
      username: 'Username',
      password: 'Password',
      optional: 'Leave empty without authentication',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      remoteDns: 'Let the proxy resolve host names',
      remoteDnsHint: 'socks5h; recommended, avoids polluted local DNS.',
      passwordNote: 'Username and password are stored in plain text in the profile cordis.patch.yml.',
      testButton: 'Test connection',
      testing: 'Testing…',
      'test.ok': 'Proxy server OK',
      'test.okDetail': '{via} · TCP {tcp} ms · handshake {handshake} ms',
      'test.auth.none': 'no authentication',
      'test.auth.password': 'login accepted',
      'test.fail': 'Cannot connect to the proxy server',
      testEndpoints: 'Model endpoints',
      'test.via.proxy': 'Proxy',
      'test.via.direct': 'Direct',
      'test.noEndpoints': 'No custom endpoints in your model settings.',
      bypassPrivate: 'Connect LAN addresses directly',
      bypassPrivateHint: 'Private IPs (10.x, 172.16–31.x, 192.168.x …) skip the proxy. Turn off if an in-house model endpoint is only reachable through the proxy.',
      bypass: 'Always-direct hosts',
      bypassHint: 'Comma separated; example.com also matches subdomains, "10.1." matches an IPv4 prefix.',
      llmHosts: 'Extra LLM hosts',
      'indicator.label': 'Proxy',
      'state.off': 'Proxy off',
      'state.error': 'Proxy state unknown',
      'state.dsh': 'On · DSH proxy',
      'state.llm': 'On · LLM proxy',
      'state.all': 'On · all traffic via one proxy',
      'state.split': 'On · DSH + LLM via separate proxies',
      'short.off': 'Proxy off',
      'short.error': 'Unknown',
      'short.dsh': 'DSH proxy',
      'short.llm': 'LLM proxy',
      'short.all': 'All traffic',
      'short.split': 'DSH + LLM',
      'indicator.on': 'Proxy on: {mode}',
      'indicator.off': 'Proxy off',
      'indicator.error': 'Proxy state unknown',
      'indicator.mode.off': 'Off',
      'indicator.mode.llm': 'LLM only',
      'indicator.mode.dsh': 'DSH only',
      'indicator.mode.all': 'All traffic',
      overridden: 'Changed',
      reset: 'Reset',
      readOnly: 'This deployment stores settings read-only.',
      unavailable: 'The Host half of this plugin is not loaded yet (restart DSH once after installing).',
      saveFailed: 'These values were not accepted; they were left for you to correct.',
      save: 'Save',
      saving: 'Saving…',
      invalidValue: 'Invalid value.',
      'short.timeout': 'Timed out',
      'short.refused': 'Refused',
      'short.dns': 'DNS failed',
      'short.unreachable': 'Unreachable',
      'short.reset': 'Reset',
      'short.auth': 'Auth failed',
      'short.target': 'Proxy refused',
      'short.failed': 'Failed',
      'err.bad-config': 'The configuration cannot be read: {message}',
      'err.auth': 'Wrong username or password; the SOCKS5 server rejected the login.',
      'err.auth-required': 'The server requires username/password authentication; fill them in.',
      'err.auth-unsupported': 'The server accepts none of the offered authentication methods.',
      'err.not-socks5': 'The port answers, but it is not a SOCKS5 server. If this is an HTTP proxy, switch the type to HTTP.',
      'err.not-http-proxy': 'The port answers, but not as an HTTP proxy. If this is a SOCKS5 proxy, switch the type to SOCKS5.',
      'err.proxy-tls': 'TLS handshake with the proxy failed (bad certificate, or not an HTTPS proxy). If it does not speak TLS, switch the type to HTTP.',
      'err.target-unreachable': 'The proxy refused or could not reach the destination: {message}',
      'err.proxy-refused': 'Connection refused: nothing listens on that host/port.',
      'err.proxy-dns': "The proxy server's host name does not resolve.",
      'err.proxy-timeout': 'Timed out connecting to the proxy; check host, port, firewall and network.',
      'err.handshake-timeout': 'The port answers, but no SOCKS5 reply arrived (not a SOCKS5 server?).',
      'err.proxy-unreachable': 'The network cannot reach the proxy server.',
      'err.proxy-reset': 'The proxy closed the connection.',
      'err.proxy-error': 'Could not connect to the proxy: {message}',
      'err.http': 'The test request did not reach the plugin (HTTP {status}). Restart DSH if you just installed or updated it.',
      'err.network': 'Could not talk to the DSH backend: {message}',
      'err.internal': 'Plugin error: {message}',
      'err.bad-request': 'Malformed request.',
      'err.not-loaded': 'The Host half of this plugin is not running. Restart DSH and retry.',
      title: 'Proxy (SOCKS5 / HTTP)',
      description: 'Proxy DSH: a DSH proxy, an LLM proxy and a global proxy share one form; whichever you fill in takes effect for its traffic.',
      'slot.dsh': 'DSH proxy',
      'slot.llm': 'LLM proxy',
      'slot.global': 'Global proxy',
      'slotScope.dsh': 'DSH\'s own traffic: search, web fetch, MCP, terminal commands',
      'slotScope.llm': 'LLM endpoints: the provider addresses in your model settings',
      'slotScope.global': 'Default: used by the two on the left when they have none of their own',
      'tile.filled': 'Filled in',
      'tile.empty': 'Not filled',
      'tile.addrNone': 'Not filled in yet',
      'effect.direct': 'Actually: direct',
      'effect.own': 'Actually: this proxy',
      'effect.followGlobal': 'Actually: follows the global proxy',
      'globalUse.both': 'Used by both DSH and the LLM',
      'globalUse.dsh': 'Only DSH uses it right now',
      'globalUse.llm': 'Only the LLM uses it right now',
      'globalUse.none': 'Overridden by both others, unused for now',
      'globalUse.off': 'Not in use',
      editing: 'Editing',
      emptyFollow: 'Empty = follows the global proxy.',
      emptyFollowNone: 'Empty = this traffic goes direct (no global proxy either).',
      emptyGlobal: 'Empty = no default proxy; traffic without its own slot goes direct.',
      clear: 'Clear this one',
      paste: 'Paste to detect',
      pasteHint: 'Paste what your provider gave you and the boxes below fill in: a socks5:// or http(s):// URL, export HTTPS_PROXY=…, a curl -x … command, or host:port:user:pass.',
      pasteOk: 'Recognised as {type} {addr} and filled in below.',
      fields: 'Fill in manually',
      incomplete: 'Fill in both host and port (1–65535) or it cannot be saved.',
      migrated: 'Your previous settings were converted to the three proxies; check them and press Save.',
      testHint: 'Checks every proxy you filled in, and whether each model endpoint is reachable under the current settings. No need to save first; no website is visited and no model request is sent.',
      'test.slotEmpty': 'Not filled, nothing to test',
      'test.noProxy': 'No proxy is filled in, nothing to test.',
      'test.slotInvalid': 'The address of "{slot}" is not complete.',
      'err.no-proxy': 'No proxy is filled in, nothing to test.',
      rules: 'Exceptions',
      rulesDesc: 'These three apply to all of the proxies.',
      llmHostsHint: 'Extra hosts treated as LLM endpoints, comma separated; endpoints from your model settings are already included.',
    };

    function formLabels(t) {
      return { unavailable: t('unavailable'), readOnly: t('readOnly'), saveFailed: t('saveFailed'), save: t('save'), saving: t('saving') };
    }

    // ---- lenient proxy parser: KEEP IN SYNC with lib/parse-proxy.js -------------------------
    const enc = (s) => encodeURIComponent(s);
    function formatProxyUrl(p) {
      const type = p.type || 'socks5';
      const auth = p.username ? `${enc(p.username)}${p.password ? `:${enc(p.password)}` : ''}@` : '';
      const host = p.host.includes(':') && !p.host.startsWith('[') ? `[${p.host}]` : p.host;
      const scheme = type === 'http' || type === 'https' ? type : p.remoteDns ? 'socks5h' : 'socks5';
      return `${scheme}://${auth}${host}:${p.port}`;
    }
    function validPort(p) {
      const n = Number(p);
      return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : undefined;
    }
    const SCHEMES = { 'socks5:': 'socks5', 'socks5h:': 'socks5', 'socks:': 'socks5', 'http:': 'http', 'https:': 'https' };
    const DEFAULT_PORTS = { socks5: 1080, http: 80, https: 443 };
    function fromUrl(text) {
      let url;
      try {
        url = new URL(text);
      } catch {
        return undefined;
      }
      const proto = url.protocol.toLowerCase();
      const type = SCHEMES[proto];
      if (!type || !url.hostname) return undefined;
      const port = validPort(url.port || DEFAULT_PORTS[type]);
      if (!port) return undefined;
      return {
        type,
        host: url.hostname.replace(/^\[|\]$/g, ''),
        port,
        username: url.username ? decodeURIComponent(url.username) : '',
        password: url.password ? decodeURIComponent(url.password) : '',
        remoteDns: proto !== 'socks5:',
      };
    }
    function fromHostPort(text, type, remoteDns) {
      let m = /^(?:([^:@\s]+)(?::([^@\s]*))?@)?(\[[^\]]+\]|[^:\s@/]+):(\d{1,5})\/?$/.exec(text);
      if (m) {
        const port = validPort(m[4]);
        return port ? { type, host: m[3].replace(/^\[|\]$/g, ''), port, username: m[1] || '', password: m[2] || '', remoteDns } : undefined;
      }
      m = /^([^:\s@/]+):(\d{1,5}):([^:\s]+):(\S+)$/.exec(text);
      if (m) {
        const port = validPort(m[2]);
        return port ? { type, host: m[1], port, username: m[3], password: m[4], remoteDns } : undefined;
      }
      return undefined;
    }
    function fromValue(value) {
      const v = value.replace(/^["']|["']$/g, '');
      return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? fromUrl(v) : fromHostPort(v, 'http', true);
    }
    function parseProxyInput(input) {
      const text = String(input == null ? '' : input).trim().replace(/^["']|["']$/g, '');
      if (!text) return undefined;
      let parsed;
      const socksUrl = /(socks5h?|socks):\/\/[^\s'"]+/i.exec(text);
      if (socksUrl) parsed = fromUrl(socksUrl[0].replace(/^SOCKS5?H?/i, (s) => s.toLowerCase()));
      if (!parsed) {
        const flag = /(?:^|\s)(?:-x|--proxy)[\s=]+(["']?[^\s"']+["']?)/.exec(text);
        if (flag) parsed = fromValue(flag[1]);
      }
      if (!parsed) {
        const env = /\b(?:https?|all)_proxy\s*=\s*(["']?[^\s"']+["']?)/i.exec(text);
        if (env) parsed = fromValue(env[1]);
      }
      if (!parsed) {
        const curl = /--socks5(-hostname)?[\s=]+(\S+)/.exec(text);
        if (curl) parsed = fromHostPort(curl[2], 'socks5', Boolean(curl[1]));
      }
      if (!parsed && !/\s/.test(text)) parsed = /^https?:\/\//i.test(text) ? fromUrl(text) : fromHostPort(text, 'socks5', true);
      if (!parsed) return undefined;
      const user = /(?:--proxy-user|-U)[\s=]+(\S+)/.exec(text);
      if (user && !parsed.username) {
        const i = user[1].indexOf(':');
        parsed.username = i < 0 ? user[1] : user[1].slice(0, i);
        parsed.password = i < 0 ? '' : user[1].slice(i + 1);
      }
      return Object.assign(parsed, { url: formatProxyUrl(parsed) });
    }
    // ------------------------------------------------------------------------------------------

    const str = (v) => (typeof v === 'string' ? v : '');
    const listFormat = (value) => (Array.isArray(value) ? value.join(', ') : str(value));
    const listParse = (text) => ({ kind: 'set', value: text.split(/[,\s，；;]+/).map((s) => s.trim()).filter(Boolean) });
    const boolField = (field) => ({
      field,
      format: (v) => (v === false ? 'false' : 'true'),
      parse: (text) => (text === 'true' || text === 'false' ? { kind: 'set', value: text === 'true' } : undefined),
    });
    const textField = (field, validate) => ({
      field,
      format: (v) => (typeof v === 'number' ? String(v) : str(v)),
      parse: (text) => {
        const value = text.trim();
        if (value === '') return { kind: 'clear' };
        return validate && !validate(value) ? undefined : { kind: 'set', value };
      },
    });
    const proxyField = (field) => ({
      field,
      format: str,
      parse: (text) => {
        if (text.trim() === '') return { kind: 'clear' };
        const parsed = parseProxyInput(text);
        return parsed ? { kind: 'set', value: parsed.url } : undefined;
      },
    });
    const FIELDS = [
      { field: 'schema', format: (v) => (v === undefined || v === null ? '' : String(v)), parse: (text) => (text.trim() === '' ? { kind: 'clear' } : /^\d+$/.test(text.trim()) ? { kind: 'set', value: Number(text.trim()) } : undefined) },
      proxyField('dshProxy'),
      proxyField('llmProxy'),
      proxyField('globalProxy'),
      boolField('bypassPrivate'),
      { field: 'bypass', format: listFormat, parse: listParse },
      { field: 'llmHosts', format: listFormat, parse: listParse },
      // schema 1 fields: read for the one-time migration, never written by this page
      { field: 'mode', format: str, parse: (text) => (MODES.includes(text) ? { kind: 'set', value: text } : undefined) },
      { field: 'inputMode', format: (v) => (v === 'fields' ? 'fields' : 'url'), parse: (text) => ({ kind: 'set', value: text === 'fields' ? 'fields' : 'url' }) },
      proxyField('proxy'),
      textField('host'),
      { field: 'port', format: (v) => (v === undefined || v === null ? '' : String(v)), parse: (text) => (text.trim() === '' ? { kind: 'clear' } : validPort(text.trim()) ? { kind: 'set', value: validPort(text.trim()) } : undefined) },
      { field: 'username', format: str, parse: (text) => (text === '' ? { kind: 'clear' } : { kind: 'set', value: text }) },
      { field: 'password', format: str, parse: (text) => (text === '' ? { kind: 'clear' } : { kind: 'set', value: text }) },
      { field: 'proxyType', format: (v) => (PROXY_TYPES.includes(v) ? v : 'socks5'), parse: (text) => (PROXY_TYPES.includes(text) ? { kind: 'set', value: text } : undefined) },
      boolField('remoteDns'),
    ];
    const FIELD_NAMES = FIELDS.map((f) => f.field);

    class ProxyForm {
      constructor(scope) {
        this.form = new P.SettingsFormModel(scope, FIELDS);
        this.store = this.form.bind(() => {
          const snapshot = { ...this.form.shell() };
          for (const name of FIELD_NAMES) snapshot[name] = this.form.field(name);
          return snapshot;
        });
      }
      inject() {
        return { hooks: { socksProxyForm: this.store }, ...this.form.actions(), testConnection };
      }
      dispose() {
        this.form.dispose();
      }
    }

    /** POST the draft to the Host's exact route (browser cookie auth), the same way Remote calls are sent. */
    async function testConnection(payload) {
      const transport = globalThis.__DSH_TRANSPORT__;
      const send = transport && typeof transport.fetch === 'function' ? transport.fetch : (input, init) => globalThis.fetch(input, init);
      let response;
      try {
        response = await send(TEST_ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(45000),
        });
      } catch (error) {
        return { ok: false, code: 'network', message: String((error && error.message) || error) };
      }
      let body;
      try {
        body = await response.json();
      } catch {
        body = undefined;
      }
      if (body && typeof body === 'object' && 'ok' in body) return body;
      return { ok: false, code: 'http', status: response.status, message: `HTTP ${response.status}` };
    }

    // ---- styles: DSH design tokens, mirroring the official settings field look ---------------
    const CSS = [
      '.dsp-hint{margin:0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}',
      '.dsp-error{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}',
      '.dsp-ok{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-success-primary)}',
      '.dsp-head{display:flex;align-items:center;gap:8px;min-height:28px}',
      '.dsp-label{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.dsp-reset{border:0;background:none;padding:0;font:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dsp-reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}',
      '.dsp-input{box-sizing:border-box;width:100%;height:34px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.dsp-input::placeholder{color:var(--dsw-alias-label-dimmed,var(--dsw-alias-label-tertiary))}',
      '.dsp-input:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary)}',
      '.dsp-input[aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary)}',
      '.dsp-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}',
      'textarea.dsp-input{height:auto;min-height:40px;padding:8px 12px;resize:vertical;font-family:var(--ds-font-family-code);font-size:12.5px;line-height:1.6;word-break:break-all}',
      '.dsp-mono{font-family:var(--ds-font-family-code)}',
      '.dsp-sub{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.dsp-sublabel{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
      '.dsp-segment{align-self:flex-start}',
      '.dsp-grid{display:grid;grid-template-columns:minmax(0,1fr) 112px;gap:12px}',
      '.dsp-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}',
      '.dsp-wrap{position:relative}',
      '.dsp-wrap .dsp-input{padding-right:38px}',
      '.dsp-eye{position:absolute;top:50%;right:4px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.dsp-eye:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.dsp-toggle{display:flex;align-items:center;justify-content:space-between;gap:16px}',
      '.dsp-toggle-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.dsp-toggle-label{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.dsp-note{display:flex;align-items:flex-start;gap:6px;margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.dsp-note svg{flex:none;margin-top:2px}',
      '.dsp-notice{margin:0 0 16px;padding:10px 14px;border-radius:var(--dsw-radius-md);font-size:12.5px;line-height:1.6;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}',
      /* the three proxy tiles */
      '.dsp-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 12px}',
      '.dsp-tab{appearance:none;display:flex;flex-direction:column;align-items:stretch;gap:6px;min-width:0;padding:14px 16px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:transparent;font:inherit;text-align:left;color:inherit;cursor:pointer;transition:background .12s ease,border-color .12s ease}',
      '.dsp-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.dsp-tab:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}',
      '.dsp-tab[aria-selected=true]{border-color:var(--dsw-alias-label-primary);box-shadow:0 0 0 .5px var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3)}',
      '.dsp-tab-top{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.dsp-tab-name{font-size:14px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary)}',
      '.dsp-badge{flex:none;display:inline-flex;align-items:center;gap:5px;padding:0 8px;border-radius:999px;font-size:11.5px;line-height:20px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-tertiary)}',
      '.dsp-badge::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}',
      '.dsp-badge[data-filled=true]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);color:var(--dsw-alias-state-success-primary)}',
      '.dsp-tab-scope{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.dsp-tab-addr{margin:2px 0 0;font-family:var(--ds-font-family-code);font-size:12.5px;line-height:1.5;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsp-tab-addr[data-empty=true]{font-family:inherit;color:var(--dsw-alias-label-dimmed,var(--dsw-alias-label-tertiary))}',
      '.dsp-tab-effect{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
      '.dsp-tab-test{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.dsp-tab-test[data-ok=true]{color:var(--dsw-alias-state-success-primary)}',
      '.dsp-tab-test[data-ok=false]{color:var(--dsw-alias-state-error-primary)}',
      /* editor + generic cards */
      '.dsp-card{display:flex;flex-direction:column;gap:14px;padding:16px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);margin:0 0 24px}',
      '.dsp-card-head{display:flex;align-items:flex-start;gap:12px}',
      '.dsp-card-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.dsp-card-title h3{margin:0;font-size:14px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary)}',
      '.dsp-card-actions{flex:none;display:flex;align-items:center;gap:8px}',
      '.dsp-divider{height:0;border:0;border-top:.5px solid var(--dsw-alias-border-l2);margin:0}',
      '.dsp-sec-title{margin:0 0 4px;font-size:14px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary)}',
      '.dsp-rules{padding:0;gap:0}',
      '.dsp-rule{display:flex;flex-direction:column;gap:8px;padding:14px 16px}',
      '.dsp-rule+.dsp-rule{border-top:.5px solid var(--dsw-alias-border-l2)}',
      /* test results */
      '.dsp-status{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform)}',
      '.dsp-status-dot{flex:none;display:inline-flex;align-items:center;height:20px}',
      '.dsp-status-main{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.dsp-status-title{font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}',
      '.dsp-status[data-state=error] .dsp-status-title{color:var(--dsw-alias-state-error-primary)}',
      '.dsp-status-meta{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);word-break:break-word}',
      '.dsp-list{display:flex;flex-direction:column;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);overflow:hidden}',
      '.dsp-list-head{padding:7px 12px;font-size:11px;font-weight:500;line-height:16px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-3);border-bottom:.5px solid var(--dsw-alias-border-l2)}',
      '.dsp-row{display:grid;grid-template-columns:10px minmax(72px,max-content) minmax(0,1fr) auto minmax(64px,auto);align-items:center;column-gap:12px;padding:9px 12px;font-size:12.5px;line-height:18px}',
      '.dsp-row+.dsp-row{border-top:.5px solid var(--dsw-alias-border-l2)}',
      '.dsp-route{font-weight:500;color:var(--dsw-alias-label-primary);white-space:nowrap}',
      '.dsp-host{font-family:var(--ds-font-family-code);font-size:12px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsp-ms{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.dsp-ms[data-error]{color:var(--dsw-alias-state-error-primary)}',
      '.dsp-foot{margin:0;display:flex;justify-content:flex-end}',
      '@media (max-width:720px){.dsp-tabs{grid-template-columns:minmax(0,1fr)}.dsp-grid,.dsp-grid2{grid-template-columns:minmax(0,1fr)}}',
      /* sidebar-foot indicator */
      '.dsp-ind{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 8px;border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary);cursor:default}',
      '.dsp-ind-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary)}',
      '.dsp-ind[data-on=true] .dsp-ind-dot{background:var(--dsw-alias-state-success-primary)}',
      '.dsp-ind[data-err=true] .dsp-ind-dot{background:var(--dsw-alias-state-warn-primary)}',
      '.dsp-ind-txt{font-size:12px;line-height:1.4;white-space:nowrap}',
    ].join('\n');

    function installStyles() {
      if (typeof document === 'undefined') return () => {};
      let tag = document.getElementById(STYLE_ID);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = STYLE_ID;
        document.head.appendChild(tag);
      }
      tag.textContent = CSS;
      return () => tag.remove();
    }

    // ---- small inline icons (16px, currentColor) ---------------------------------------------
    const svg = (children, size = 16) => h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, children);
    const EyeIcon = () => svg([h('path', { key: 'a', d: 'M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8Z' }), h('circle', { key: 'b', cx: 8, cy: 8, r: 2 })]);
    const EyeOffIcon = () => svg([h('path', { key: 'a', d: 'M2 2l12 12' }), h('path', { key: 'b', d: 'M6.6 3.7A6.6 6.6 0 0 1 8 3.5c4.1 0 6.5 4.5 6.5 4.5a11 11 0 0 1-1.9 2.4M4.2 4.9A11 11 0 0 0 1.5 8s2.4 4.5 6.5 4.5c1.1 0 2-.3 2.9-.7' }), h('path', { key: 'c', d: 'M6.6 6.6a2 2 0 0 0 2.8 2.8' })]);
    const ChevronIcon = () => svg(h('path', { d: 'M6 4l4 4-4 4' }), 14);
    const LockIcon = () => svg([h('rect', { key: 'a', x: 3.5, y: 7, width: 9, height: 6.5, rx: 1.5 }), h('path', { key: 'b', d: 'M5.5 7V5a2.5 2.5 0 0 1 5 0v2' })], 12);

    function fill(template, values) {
      return String(template).replace(/\{(\w+)\}/g, (_, k) => (values[k] === undefined ? '' : String(values[k])));
    }
    function translated(t, key, values) {
      const text = t(key);
      return text && text !== key ? fill(text, values || {}) : undefined;
    }
    function shortError(t, code) {
      const c = String(code || '');
      if (/^target|ECONNECTFAILED/i.test(c)) return t('short.target');
      if (/timeout|ETIMEDOUT/i.test(c)) return t('short.timeout');
      if (/refused|ECONNREFUSED/i.test(c)) return t('short.refused');
      if (/dns|ENOTFOUND|EAI_AGAIN/i.test(c)) return t('short.dns');
      if (/unreachable|EHOSTUNREACH|ENETUNREACH/i.test(c)) return t('short.unreachable');
      if (/reset|ECONNRESET/i.test(c)) return t('short.reset');
      if (/auth/i.test(c)) return t('short.auth');
      return t('short.failed');
    }

    function FieldHead(props) {
      const { t, label, htmlFor, field, disabled, onReset, children } = props;
      return h('div', { className: 'dsp-head' }, [
        h('label', { key: 'l', className: 'dsp-label', htmlFor }, label),
        field && field.overridden ? h(P.Tag, { key: 'tag', tone: 'neutral' }, t('overridden')) : null,
        field && field.overridden && onReset ? h('button', { key: 'reset', type: 'button', className: 'dsp-reset', disabled, onClick: onReset }, t('reset')) : null,
        children ? h(React.Fragment, { key: 'extra' }, children) : null,
      ]);
    }

    /** Label + description on the left, Switch on the right. */
    function ToggleRow(props) {
      const { label, hint, field, disabled, onChange } = props;
      return h('div', { className: 'dsp-toggle' }, [
        h('div', { key: 'text', className: 'dsp-toggle-text' }, [
          h('span', { key: 'l', className: 'dsp-toggle-label' }, label),
          hint ? h('p', { key: 'h', className: 'dsp-hint' }, hint) : null,
        ]),
        h(P.Switch, { key: 's', checked: field.text !== 'false', label, disabled, onChange }),
      ]);
    }

    /** Text input with label, hint and reset, inside the advanced section. */
    function TextRow(props) {
      const { t, name, field, disabled, edit, resetField, placeholder } = props;
      const id = `plugin-config-socks-proxy-${name}`;
      return h('div', { className: 'dsp-sub' }, [
        h(FieldHead, { key: 'head', t, label: t(name), htmlFor: id, field, disabled, onReset: () => resetField(name) }),
        h('input', {
          key: 'i',
          id,
          className: 'dsp-input',
          spellCheck: false,
          placeholder,
          value: field.text,
          disabled,
          'aria-invalid': field.invalid || undefined,
          onChange: (event) => edit(name, event.target.value),
        }),
        h('p', { key: 'h', className: field.invalid ? 'dsp-error' : 'dsp-hint' }, field.invalid ? t('invalidValue') : t(`${name}Hint`)),
      ]);
    }

    // ---- proxy value helpers -----------------------------------------------------------------
    const EMPTY_DRAFT = { type: 'socks5', host: '', port: '', username: '', password: '', remoteDns: true };
    /** Stored proxy text -> editable fields. Half-typed values travel as "incomplete {json}" so they survive tab switches. */
    function toDraft(text) {
      const value = typeof text === 'string' ? text.trim() : '';
      if (value.startsWith('incomplete ')) {
        try {
          return { ...EMPTY_DRAFT, ...JSON.parse(value.slice(11)) };
        } catch {}
      }
      const parsed = value ? parseProxyInput(value) : undefined;
      return parsed
        ? { type: parsed.type, host: parsed.host, port: String(parsed.port), username: parsed.username, password: parsed.password, remoteDns: parsed.remoteDns }
        : { ...EMPTY_DRAFT };
    }
    /** Editable fields -> the text stored for the slot ('' = not filled, "incomplete …" = cannot be saved yet). */
    function fromDraft(draft) {
      const host = draft.host.trim();
      const port = draft.port.trim();
      if (!host && !port && !draft.username && !draft.password) return '';
      if (host && !/[\s/@]/.test(host) && validPort(port)) {
        return formatProxyUrl({ type: draft.type, host, port: validPort(port), username: draft.username, password: draft.password, remoteDns: draft.remoteDns });
      }
      return `incomplete ${JSON.stringify(draft)}`;
    }
    /** Short "SOCKS5 127.0.0.1:7890" label of a stored proxy text; undefined when empty or incomplete. */
    function describe(text) {
      const parsed = typeof text === 'string' && text.trim() && !text.startsWith('incomplete ') ? parseProxyInput(text) : undefined;
      return parsed ? { type: TYPE_LABELS[parsed.type] || 'SOCKS5', addr: `${parsed.host.includes(':') ? `[${parsed.host}]` : parsed.host}:${parsed.port}` } : undefined;
    }
    const isFilled = (field) => Boolean(field && field.text && field.text.trim());

    /** Old (schema 1) settings -> the three slots, so nobody loses a working setup. */
    function legacySlots(state) {
      const mode = MODES.includes(state.mode.text) ? state.mode.text : 'llm';
      let primary = '';
      if (state.inputMode.text === 'fields') {
        const host = state.host.text.trim();
        const port = validPort(state.port.text.trim());
        if (host && port) {
          primary = formatProxyUrl({ type: PROXY_TYPES.includes(state.proxyType.text) ? state.proxyType.text : 'socks5', host, port, username: state.username.text, password: state.password.text, remoteDns: state.remoteDns.text !== 'false' });
        }
      } else {
        const parsed = parseProxyInput(state.proxy.text);
        primary = parsed ? parsed.url : '';
      }
      const own = state.llmProxy.text.trim() ? (parseProxyInput(state.llmProxy.text) || {}).url || '' : '';
      const out = { dsh: '', llm: '', global: '' };
      if (!primary) return out;
      if (mode === 'dsh') out.dsh = primary;
      else if (mode === 'llm') out.llm = own || primary;
      else if (mode === 'all') {
        if (own) {
          out.dsh = primary;
          out.llm = own;
        } else out.global = primary;
      }
      return out;
    }

    /** Build the test request body from the unsaved form; or say what is wrong with it. */
    function draftFromState(state) {
      const draft = { schema: 2, bypassPrivate: state.bypassPrivate.text !== 'false', bypass: state.bypass.text, llmHosts: state.llmHosts.text };
      let any = false;
      for (const slot of SLOTS) {
        const field = state[SLOT_FIELD[slot]];
        const text = field.text.trim();
        if (field.invalid || text.startsWith('incomplete ')) return { error: 'test.slotInvalid', slot };
        draft[SLOT_FIELD[slot]] = text;
        if (text) any = true;
      }
      return any ? { draft } : { error: 'test.noProxy' };
    }

    // ---- the three tiles ---------------------------------------------------------------------
    function SlotTile(props) {
      const { t, slot, state, selected, onSelect, result } = props;
      const field = state[SLOT_FIELD[slot]];
      const filled = isFilled(field);
      const info = describe(field.text);
      const dshFilled = isFilled(state.dshProxy);
      const llmFilled = isFilled(state.llmProxy);
      const globalFilled = isFilled(state.globalProxy);
      let effect;
      if (slot === 'global') {
        effect = !globalFilled ? t('globalUse.off') : !dshFilled && !llmFilled ? t('globalUse.both') : !dshFilled ? t('globalUse.dsh') : !llmFilled ? t('globalUse.llm') : t('globalUse.none');
      } else effect = filled ? t('effect.own') : globalFilled ? t('effect.followGlobal') : t('effect.direct');
      let test = null;
      if (result && filled) {
        test = result.ok
          ? h('p', { key: 'test', className: 'dsp-tab-test', 'data-ok': 'true' }, `✓ ${t('test.ok')} · ${result.totalMs} ms`)
          : h('p', { key: 'test', className: 'dsp-tab-test', 'data-ok': 'false' }, `✕ ${shortError(t, result.code)}`);
      }
      return h('button', { type: 'button', role: 'tab', className: 'dsp-tab', 'aria-selected': selected ? 'true' : 'false', 'data-slot': slot, onClick: onSelect }, [
        h('div', { key: 'top', className: 'dsp-tab-top' }, [
          h('span', { key: 'n', className: 'dsp-tab-name' }, t(`slot.${slot}`)),
          h('span', { key: 'b', className: 'dsp-badge', 'data-filled': filled ? 'true' : 'false' }, filled ? t('tile.filled') : t('tile.empty')),
        ]),
        h('p', { key: 's', className: 'dsp-tab-scope' }, t(`slotScope.${slot}`)),
        h('p', { key: 'a', className: 'dsp-tab-addr', 'data-empty': info ? 'false' : 'true', title: info ? `${info.type} ${info.addr}` : undefined }, info ? `${info.type} ${info.addr}` : filled ? '…' : t('tile.addrNone')),
        h('p', { key: 'e', className: 'dsp-tab-effect' }, effect),
        test,
      ]);
    }

    // ---- the one shared editor ---------------------------------------------------------------
    function LabeledInput(props) {
      const { id, label, value, onChange, placeholder, disabled, mono, secret, t } = props;
      const [reveal, setReveal] = useState(false);
      const input = h('input', {
        id,
        className: 'dsp-input' + (mono ? ' dsp-mono' : ''),
        type: secret && !reveal ? 'password' : 'text',
        autoComplete: secret ? 'new-password' : 'off',
        spellCheck: false,
        placeholder,
        value,
        disabled,
        onChange: (event) => onChange(event.target.value),
      });
      return h('div', { className: 'dsp-sub' }, [
        h('label', { key: 'l', className: 'dsp-sublabel', htmlFor: id }, label),
        secret
          ? h('div', { key: 'w', className: 'dsp-wrap' }, [
              h(React.Fragment, { key: 'in' }, input),
              h('button', { key: 'eye', type: 'button', className: 'dsp-eye', title: t(reveal ? 'hidePassword' : 'showPassword'), 'aria-label': t(reveal ? 'hidePassword' : 'showPassword'), onClick: () => setReveal(!reveal) }, reveal ? h(EyeOffIcon) : h(EyeIcon)),
            ])
          : h(React.Fragment, { key: 'i' }, input),
      ]);
    }

    /** Edits one slot. Re-created per slot (key), so every tab starts from its own stored value. */
    function SlotEditor(props) {
      const { t, slot, field, edit, disabled, state, busy, onTest, result } = props;
      const name = SLOT_FIELD[slot];
      const [draft, setDraft] = useState(() => toDraft(field.text));
      const [pasted, setPasted] = useState(undefined);
      const [pasteText, setPasteText] = useState('');
      const emitted = useRef(field.text);
      // Discard / reset / migration change the stored text from outside: follow it.
      useEffect(() => {
        if (field.text !== emitted.current) {
          emitted.current = field.text;
          setDraft(toDraft(field.text));
        }
      }, [field.text]);

      const commit = (next) => {
        setDraft(next);
        const text = fromDraft(next);
        emitted.current = text;
        edit(name, text);
      };
      const set = (patch) => {
        setPasted(undefined);
        commit({ ...draft, ...patch });
      };
      const onPaste = (value) => {
        setPasteText(value);
        if (!value.trim()) return setPasted(undefined);
        const parsed = parseProxyInput(value);
        if (!parsed) return setPasted({ ok: false });
        commit(toDraft(parsed.url));
        setPasted({ ok: true, type: TYPE_LABELS[parsed.type] || 'SOCKS5', addr: `${parsed.host}:${parsed.port}` });
        setPasteText('');
      };

      const filled = isFilled(field);
      const incomplete = field.text.trim().startsWith('incomplete ') || field.invalid;
      const globalFilled = isFilled(state.globalProxy);
      const emptyHint = slot === 'global' ? t('emptyGlobal') : globalFilled ? t('emptyFollow') : t('emptyFollowNone');
      const id = `plugin-config-socks-proxy-${slot}`;

      let status = null;
      if (result && filled) {
        if (result.ok) {
          status = h('div', { key: 'status', className: 'dsp-status', 'data-state': 'done' }, [
            h('span', { key: 'd', className: 'dsp-status-dot' }, h(P.StateDot, { state: 'done' })),
            h('div', { key: 'm', className: 'dsp-status-main' }, [
              h('span', { key: 't', className: 'dsp-status-title' }, [
                t('test.ok'),
                h(React.Fragment, { key: 'sp1' }, ' '),
                h(P.Tag, { key: 'type', tone: 'neutral' }, TYPE_LABELS[result.type] || 'SOCKS5'),
                h(React.Fragment, { key: 'sp2' }, ' '),
                h(P.Tag, { key: 'auth', tone: 'success' }, t(result.auth === 'password' ? 'test.auth.password' : 'test.auth.none')),
              ]),
              h('span', { key: 'meta', className: 'dsp-status-meta dsp-mono' }, fill(t('test.okDetail'), { via: result.via, tcp: result.tcpMs, handshake: result.handshakeMs })),
            ]),
          ]);
        } else {
          const text = translated(t, `err.${result.code}`, { message: result.message });
          status = h('div', { key: 'status', className: 'dsp-status', 'data-state': 'error' }, [
            h('span', { key: 'd', className: 'dsp-status-dot' }, h(P.StateDot, { state: 'error' })),
            h('div', { key: 'm', className: 'dsp-status-main' }, [
              h('span', { key: 't', className: 'dsp-status-title' }, t('test.fail')),
              h('span', { key: 'meta', className: 'dsp-status-meta' }, text || result.message),
            ]),
          ]);
        }
      }

      return h('div', { className: 'dsp-card', role: 'tabpanel', 'aria-label': t(`slot.${slot}`) }, [
        h('div', { key: 'head', className: 'dsp-card-head' }, [
          h('div', { key: 't', className: 'dsp-card-title' }, [
            h('h3', { key: 'h' }, `${t('editing')}：${t(`slot.${slot}`)}`),
            h('p', { key: 'd', className: 'dsp-hint' }, t(`slotScope.${slot}`)),
          ]),
          h('div', { key: 'a', className: 'dsp-card-actions' }, [
            filled ? h(P.Button, { key: 'clear', variant: 'outline', size: 'sm', disabled, onClick: () => { setPasted(undefined); commit({ ...EMPTY_DRAFT }); } }, t('clear')) : null,
            h(P.Button, { key: 'test', variant: 'outline', size: 'sm', disabled: busy || !state.available, onClick: onTest }, busy ? t('testing') : t('testButton')),
          ]),
        ]),
        h('div', { key: 'paste', className: 'dsp-sub' }, [
          h('label', { key: 'l', className: 'dsp-sublabel', htmlFor: `${id}-paste` }, t('paste')),
          h('textarea', { key: 'ta', id: `${id}-paste`, className: 'dsp-input', rows: 1, spellCheck: false, placeholder: t('proxyPlaceholder'), value: pasteText, disabled, 'aria-invalid': pasted && !pasted.ok ? 'true' : undefined, onChange: (event) => onPaste(event.target.value) }),
          pasted && pasted.ok
            ? h('p', { key: 'ok', className: 'dsp-ok' }, fill(t('pasteOk'), pasted))
            : pasted
              ? h('p', { key: 'bad', className: 'dsp-error' }, t('invalidProxy'))
              : h('p', { key: 'hint', className: 'dsp-hint' }, t('pasteHint')),
        ]),
        h('hr', { key: 'hr', className: 'dsp-divider' }),
        h('div', { key: 'type', className: 'dsp-sub' }, [
          h('span', { key: 'l', className: 'dsp-sublabel' }, t('proxyType')),
          h(P.SegmentedControl, { key: 'seg', id: `${id}-type`, className: 'dsp-segment', label: t('proxyType'), value: draft.type, disabled, options: PROXY_TYPES.map((m) => ({ value: m, label: TYPE_LABELS[m] })), onChange: (value) => set({ type: value }) }),
          draft.type === 'https' ? h('p', { key: 'h', className: 'dsp-hint' }, t('proxyTypeHint')) : null,
        ]),
        h('div', { key: 'hp', className: 'dsp-grid' }, [
          h(LabeledInput, { key: 'host', t, id: `${id}-host`, label: t('host'), value: draft.host, placeholder: t('hostPlaceholder'), disabled, mono: true, onChange: (value) => set({ host: value }) }),
          h(LabeledInput, { key: 'port', t, id: `${id}-port`, label: t('port'), value: draft.port, placeholder: draft.type === 'socks5' ? '7890' : draft.type === 'https' ? '443' : '8080', disabled, mono: true, onChange: (value) => set({ port: value }) }),
        ]),
        h('div', { key: 'up', className: 'dsp-grid2' }, [
          h(LabeledInput, { key: 'user', t, id: `${id}-user`, label: t('username'), value: draft.username, placeholder: t('optional'), disabled, onChange: (value) => set({ username: value }) }),
          h(LabeledInput, { key: 'pass', t, id: `${id}-pass`, label: t('password'), value: draft.password, placeholder: t('optional'), disabled, secret: true, onChange: (value) => set({ password: value }) }),
        ]),
        // An HTTP proxy always resolves destination names itself; the choice only exists for SOCKS5.
        draft.type === 'socks5'
          ? h(ToggleRow, { key: 'dns', label: t('remoteDns'), hint: t('remoteDnsHint'), field: { text: draft.remoteDns ? 'true' : 'false' }, disabled, onChange: (checked) => set({ remoteDns: checked }) })
          : null,
        incomplete ? h('p', { key: 'inc', className: 'dsp-error' }, t('incomplete')) : !filled ? h('p', { key: 'empty', className: 'dsp-hint' }, emptyHint) : null,
        status,
        h('p', { key: 'note', className: 'dsp-note' }, [h(LockIcon, { key: 'i' }), h('span', { key: 't' }, t('passwordNote'))]),
      ]);
    }

    function EndpointList(props) {
      const { t, endpoints } = props;
      return h('div', { className: 'dsp-card' }, [
        h('div', { key: 'head', className: 'dsp-card-head' }, h('div', { className: 'dsp-card-title' }, h('h3', null, t('testEndpoints')))),
        endpoints.length
          ? h('div', { key: 'list', className: 'dsp-list' }, endpoints.map((e, i) =>
              h('div', { key: `e${i}`, className: 'dsp-row', title: e.ok ? e.baseURL : `${e.baseURL}\n${e.message || ''}` }, [
                h(P.StateDot, { key: 'dot', state: e.ok ? 'done' : 'error', size: 8 }),
                h('span', { key: 'route', className: 'dsp-route' }, e.route),
                h('span', { key: 'host', className: 'dsp-host' }, `${e.host}:${e.port}`),
                h(P.Tag, { key: 'via', tone: e.via === 'proxy' ? 'info' : 'outline' }, e.via === 'proxy' ? `${t('test.via.proxy')}${e.slot ? ` · ${t(`slot.${e.slot}`)}` : ''}` : t('test.via.direct')),
                h('span', { key: 'ms', className: 'dsp-ms', 'data-error': e.ok ? undefined : '' }, e.ok ? `${e.ms} ms` : shortError(t, e.code)),
              ]),
            ))
          : h('p', { key: 'none', className: 'dsp-hint' }, t('test.noEndpoints')),
      ]);
    }

    // ---- the page ----------------------------------------------------------------------------
    function ProxySettings(props) {
      const { t } = props;
      const state = props.useSocksProxyForm((s) => s);
      const [slot, setSlot] = useState('global');
      const [migrated, setMigrated] = useState(false);
      const [busy, setBusy] = useState(false);
      const [result, setResult] = useState(undefined);
      const [testError, setTestError] = useState(undefined);
      const alive = useRef(true);
      const didMigrate = useRef(false);
      useEffect(() => () => { alive.current = false; }, []);

      // One-time upgrade of a schema-1 config (mode + proxy + llmProxy) to the three slots.
      const legacy = String(state.schema.text).trim() !== '2';
      useEffect(() => {
        if (!legacy || didMigrate.current || !state.available || !state.writable) return;
        didMigrate.current = true;
        const slots = legacySlots(state);
        for (const name of SLOTS) if (state[SLOT_FIELD[name]].text !== slots[name]) props.edit(SLOT_FIELD[name], slots[name]);
        props.edit('schema', '2');
        setMigrated(Object.values(slots).some(Boolean));
        const first = ['global', 'dsh', 'llm'].find((n) => slots[n]);
        if (first) setSlot(first);
      });

      // A test result describes the values it was run with; drop it as soon as they change.
      const signature = SLOTS.map((n) => state[SLOT_FIELD[n]].text).join('\u0000');
      useEffect(() => {
        setResult(undefined);
        setTestError(undefined);
      }, [signature]);

      if (props.view === 'summary') return t('description');

      const edit = props.edit;
      const disabled = !state.writable || state.saving;
      const common = { t, disabled, edit, resetField: props.resetField };

      const runTest = async () => {
        const built = draftFromState(state);
        if (built.error) {
          setResult(undefined);
          setTestError(fill(t(built.error), { slot: built.slot ? t(`slot.${built.slot}`) : '' }));
          return;
        }
        setBusy(true);
        setTestError(undefined);
        setResult(undefined);
        const answer = await props.testConnection({ config: built.draft });
        if (!alive.current) return;
        setBusy(false);
        if (answer && answer.slots) setResult(answer);
        else setTestError(translated(t, `err.${answer && answer.code}`, { message: answer && answer.message, status: answer && answer.status }) || (answer && answer.message) || t('test.fail'));
      };

      const tiles = h('div', { key: 'tabs', className: 'dsp-tabs', role: 'tablist', 'aria-label': t('title') },
        SLOTS.map((name) => h(SlotTile, { key: name, t, slot: name, state, selected: slot === name, onSelect: () => setSlot(name), result: result && result.slots ? result.slots[name] : undefined })));

      const endpoints = result && Array.isArray(result.endpoints) ? result.endpoints : undefined;

      return h(P.SettingsForm, { labels: formLabels(t), state, onSave: props.save, onDiscard: props.discard }, [
        migrated ? h('p', { key: 'migrated', className: 'dsp-notice' }, t('migrated')) : null,
        tiles,
        h(SlotEditor, { key: slot, ...common, t, slot, field: state[SLOT_FIELD[slot]], state, busy, onTest: runTest, result: result && result.slots ? result.slots[slot] : undefined }),
        testError ? h('p', { key: 'terr', className: 'dsp-error', style: { margin: '-12px 0 24px' } }, testError) : null,
        endpoints ? h(EndpointList, { key: 'endpoints', t, endpoints }) : null,
        h('section', { key: 'rules' }, [
          h('h3', { key: 'h', className: 'dsp-sec-title' }, t('rules')),
          h('p', { key: 'd', className: 'dsp-hint', style: { marginBottom: 10 } }, t('rulesDesc')),
          h('div', { key: 'card', className: 'dsp-card dsp-rules' }, [
            h('div', { key: 'bp', className: 'dsp-rule' }, h(ToggleRow, { label: t('bypassPrivate'), hint: t('bypassPrivateHint'), field: state.bypassPrivate, disabled, onChange: (checked) => edit('bypassPrivate', checked ? 'true' : 'false') })),
            h('div', { key: 'by', className: 'dsp-rule' }, h(TextRow, { ...common, name: 'bypass', field: state.bypass, placeholder: 'corp.example.com, 192.168.1.50' })),
            h('div', { key: 'lh', className: 'dsp-rule' }, h(TextRow, { ...common, name: 'llmHosts', field: state.llmHosts, placeholder: 'api.example.com' })),
          ]),
        ]),
        h('div', { key: 'foot', className: 'dsp-foot' }, h(P.Tag, { tone: 'quiet' }, `v${PANEL_VERSION}`)),
      ]);
    }

    async function fetchProxyState() {
      const transport = globalThis.__DSH_TRANSPORT__;
      const send = transport && typeof transport.fetch === 'function' ? transport.fetch : (input, init) => globalThis.fetch(input, init);
      try {
        const response = await send(STATE_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000) });
        if (!response.ok) return { ok: false };
        return await response.json();
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) };
      }
    }

    /** Sidebar-foot indicator light: green when a proxy mode is on, grey when off. */
    function ProxyIndicator(props) {
      const { t } = props;
      const [state, setState] = useState(undefined);
      useEffect(() => {
        let alive = true;
        const load = async () => { const s = await fetchProxyState(); if (alive) setState(s); };
        load();
        const id = setInterval(load, 8000);
        const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') load(); };
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
        if (typeof window !== 'undefined') window.addEventListener('focus', load);
        return () => {
          alive = false; clearInterval(id);
          if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
          if (typeof window !== 'undefined') window.removeEventListener('focus', load);
        };
      }, []);
      if (!state) return null;
      const ok = state.ok !== false;
      const enabled = ok && Boolean(state.enabled);
      const mode = ok ? String(state.mode || 'off') : 'off';
      let kind = 'off';
      if (!ok) kind = 'error';
      else if (!enabled) kind = 'off';
      else if (mode === 'dsh') kind = 'dsh';
      else if (mode === 'llm') kind = 'llm';
      else if (mode === 'all') kind = state.llmProxyEnabled ? 'split' : 'all';
      const title = translated(t, `state.${kind}`) || t('state.error');
      const shortText = translated(t, `short.${kind}`) || t('indicator.label');
      return h('div', { className: 'dsp-ind', 'data-on': enabled ? 'true' : 'false', 'data-err': ok ? 'false' : 'true', title, role: 'status', 'aria-label': title }, [
        h('span', { key: 'd', className: 'dsp-ind-dot' }),
        props.wide ? h('span', { key: 't', className: 'dsp-ind-txt' }, shortText) : null,
      ]);
    }

    return {
      /** Exposed for the test suite, which checks it against lib/parse-proxy.js. */
      parseProxyInput,
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        ctx.effect(() => installStyles(), 'socks-proxy: styles');
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'socks-proxy: dictionaries');
        const form = new ProxyForm(ctx.configForms.get(ENTRY_ID));
        ctx.effect(() => () => form.dispose(), 'socks-proxy: form');
        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register({ name: 'plugins.bundle.config', key: PACKAGE, locale: NS, inject: () => form.inject() }, ProxySettings),
        );
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register({ name: 'sidebar.footer.action', id: 'socks-proxy-indicator', order: -10, locale: NS }, ProxyIndicator),
        );
      },
    };
  },
});
