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
    const PANEL_VERSION = '0.11.2';
    const NS = 'socksProxy';
    const MODES = ['off', 'llm', 'dsh', 'all'];
    const INPUT_MODES = ['url', 'fields'];
    const PROXY_TYPES = ['socks5', 'http', 'https'];
    const TYPE_LABELS = { socks5: 'SOCKS5', http: 'HTTP', https: 'HTTPS' };
    const STYLE_ID = '@st-open/dsh-socks-proxy/panel.css';

    const zh = {
      title: '代理（SOCKS5 / HTTP）',
      description: '让 DSH 走代理：分别控制「DSH 自身」和「大模型」是否走代理，并可为大模型单独指定一条代理。',
      mode: '代理模式',
      'mode.off': '关闭',
      'mode.llm': '仅大模型',
      'mode.dsh': '仅 DSH 本身',
      'mode.all': '全部流量',
      'modeDesc.off': '不改变任何流量的路由。',
      'modeDesc.llm': '只有发往大模型接口的请求走代理（自动包含模型设置里各 provider 的地址），其余保持原样。',
      'modeDesc.dsh': 'DSH 自身的出站请求走代理（联网搜索、网页抓取、MCP，以及之后启动的终端命令），但大模型接口保持直连。',
      'modeDesc.all': 'DSH 的全部出站请求走代理：大模型 + DSH 本身（搜索、抓取、MCP、终端命令）。等于「DSH 本身 + 大模型」。',
      modeHint: '保存后立即生效。',
      server: '代理服务器',
      proxyType: '代理类型',
      proxyTypeHint: 'HTTPS 表示与代理服务器之间使用 TLS 加密连接（https:// 代理）。',
      'inputMode.url': '粘贴地址',
      'inputMode.fields': '分项填写',
      proxyPlaceholder: 'socks5h://user:pass@127.0.0.1:7890',
      proxyHint: '直接粘贴服务商给的内容：socks5:// 或 http(s):// 地址、export HTTPS_PROXY=… / ALL_PROXY=…、curl -x / --socks5 命令，或 主机:端口:用户:密码（按 SOCKS5 处理）。',
      invalidProxy: '没能识别出代理地址，请检查格式。',
      parsedAs: '识别为',
      host: '服务器地址',
      hostPlaceholder: '127.0.0.1',
      invalidHost: '只填主机名或 IP，不要带 socks5:// 或端口。',
      port: '端口',
      portPlaceholder: '7890',
      invalidPort: '端口须为 1–65535。',
      username: '用户名',
      password: '密码',
      optional: '不需要认证可留空',
      showPassword: '显示密码',
      hidePassword: '隐藏密码',
      remoteDns: '由代理服务器解析域名',
      remoteDnsHint: '即 socks5h，推荐开启，可避免本地 DNS 被污染。',
      passwordNote: '用户名和密码以明文保存在 profile 的 cordis.patch.yml 中。',
      testTitle: '连接测试',
      testHint: '用当前填写的内容（无需先保存）检测代理服务器本身，并按当前设置逐个检测模型接口能否连通。不访问任何网站、不发送模型请求，不影响正在使用的代理。',
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
      advanced: '高级设置',
      bypassPrivate: '局域网地址直连',
      bypassPrivateHint: '10.x、172.16–31.x、192.168.x 等内网 IP 不走代理。如果内网模型地址只能经代理访问，请关闭。',
      bypass: '始终直连的主机',
      bypassHint: '逗号分隔；example.com 同时匹配子域名，“10.1.” 按 IP 前缀匹配。',
      llmHosts: '额外的大模型主机',
      llmHostsHint: '仅「仅大模型」模式使用，逗号分隔。模型设置里的接口地址已自动包含。',
      llmProxyEnabled: '大模型走独立代理',
      llmProxyEnabledHint: '大模型单独走这条代理；留空则用上面的主代理。',
      llmProxy: '大模型代理服务器（可选）',
      llmProxyHint: '填了就大模型单独走这条；留空则大模型也用 DSH 同一条主代理。格式同主代理。',
      'test.llmUpstream': '大模型代理',
      proxyFor: '代理开关',
      'proxyFor.dsh': 'DSH 自己的流量走代理',
      'proxyFor.dshHint': '网页搜索、网页抓取、MCP、终端命令等 DSH 自身的联网。',
      'proxyFor.llm': '大模型流量走代理',
      'proxyFor.llmHint': '你模型设置里的各大模型接口地址。',
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
      bothOnHint: '两个都开时：填了「大模型代理服务器」= 各自走各自代理；留空 = 都走同一条主代理。',
      dshProxyTitle: 'DSH 代理服务器',
      primaryForLlm: '主代理（大模型使用）',
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
    };
    const en = {
      title: 'Proxy (SOCKS5 / HTTP)',
      description: "Proxy DSH's traffic: switch on DSH itself and/or the LLM independently, and give the LLM its own proxy if you want.",
      mode: 'Proxy mode',
      'mode.off': 'Off',
      'mode.llm': 'LLM only',
      'mode.dsh': 'DSH only',
      'mode.all': 'All traffic',
      'modeDesc.off': 'Routing is left unchanged.',
      'modeDesc.llm': "Only requests to LLM endpoints use SOCKS5 (every provider endpoint from your model settings is included).",
      'modeDesc.dsh': "DSH's own outbound requests use SOCKS5 (web search, web fetch, MCP and terminal commands started afterwards), while LLM endpoints stay direct.",
      'modeDesc.all': 'Every outbound DSH request uses SOCKS5: models plus DSH itself (search, fetch, MCP, terminal commands). This equals "DSH only" + "LLM only".',
      modeHint: 'Applies as soon as you save.',
      server: 'Proxy server',
      proxyType: 'Proxy type',
      proxyTypeHint: 'HTTPS means the connection to the proxy itself is TLS-encrypted (an https:// proxy).',
      'inputMode.url': 'Paste address',
      'inputMode.fields': 'Fields',
      proxyPlaceholder: 'socks5h://user:pass@127.0.0.1:7890',
      proxyHint: 'Paste what your provider gave you: a socks5:// or http(s):// URL, export HTTPS_PROXY=… / ALL_PROXY=…, a curl -x / --socks5 command, or host:port:user:pass (treated as SOCKS5).',
      invalidProxy: 'No proxy address recognised; check the format.',
      parsedAs: 'Recognised as',
      host: 'Server',
      hostPlaceholder: '127.0.0.1',
      invalidHost: 'Host name or IP only, without socks5:// or a port.',
      port: 'Port',
      portPlaceholder: '7890',
      invalidPort: 'Port must be 1–65535.',
      username: 'Username',
      password: 'Password',
      optional: 'Leave empty without authentication',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      remoteDns: 'Let the proxy resolve host names',
      remoteDnsHint: 'socks5h; recommended, avoids polluted local DNS.',
      passwordNote: 'Username and password are stored in plain text in the profile cordis.patch.yml.',
      testTitle: 'Connection test',
      testHint: 'Checks the proxy server itself with the values above (no need to save) and probes each model endpoint the way these settings would reach it. No website is visited and no model request is sent; live routing is untouched.',
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
      advanced: 'Advanced',
      bypassPrivate: 'Connect LAN addresses directly',
      bypassPrivateHint: 'Private IPs (10.x, 172.16–31.x, 192.168.x …) skip the proxy. Turn off if an in-house model endpoint is only reachable through the proxy.',
      bypass: 'Always-direct hosts',
      bypassHint: 'Comma separated; example.com also matches subdomains, "10.1." matches an IPv4 prefix.',
      llmHosts: 'Extra LLM hosts',
      llmHostsHint: 'LLM-only mode, comma separated. Endpoints from your model settings are already included.',
      llmProxyEnabled: 'Separate proxy for LLM',
      llmProxyEnabledHint: 'Send the LLM through this proxy; empty reuses the primary proxy.',
      llmProxy: 'LLM proxy server (optional)',
      llmProxyHint: 'If set, the LLM uses this proxy; empty reuses the same DSH primary proxy. Same formats as the primary.',
      'test.llmUpstream': 'LLM proxy',
      proxyFor: 'Proxy switches',
      'proxyFor.dsh': "DSH's own traffic uses a proxy",
      'proxyFor.dshHint': 'DSH itself: web search, web fetch, MCP, terminal commands.',
      'proxyFor.llm': 'LLM traffic uses a proxy',
      'proxyFor.llmHint': 'The model endpoints from your model settings.',
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
      bothOnHint: 'Both on: a filled LLM proxy server = each uses its own; empty = both use the same primary proxy.',
      dshProxyTitle: 'DSH proxy server',
      primaryForLlm: 'Primary proxy (for the LLM)',
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
    const FIELDS = [
      { field: 'mode', format: str, parse: (text) => (MODES.includes(text) ? { kind: 'set', value: text } : undefined) },
      { field: 'inputMode', format: (v) => (v === 'fields' ? 'fields' : 'url'), parse: (text) => (INPUT_MODES.includes(text) ? { kind: 'set', value: text } : undefined) },
      {
        field: 'proxy',
        format: str,
        parse: (text) => {
          if (text.trim() === '') return { kind: 'clear' };
          const parsed = parseProxyInput(text);
          return parsed ? { kind: 'set', value: parsed.url } : undefined;
        },
      },
      textField('host', (v) => !/[\s/@]/.test(v) && !/^socks/i.test(v)),
      {
        field: 'port',
        format: (v) => (v === undefined || v === null ? '' : String(v)),
        parse: (text) => {
          if (text.trim() === '') return { kind: 'clear' };
          const port = validPort(text.trim());
          return port ? { kind: 'set', value: port } : undefined;
        },
      },
      { field: 'username', format: str, parse: (text) => (text === '' ? { kind: 'clear' } : { kind: 'set', value: text }) },
      { field: 'password', format: str, parse: (text) => (text === '' ? { kind: 'clear' } : { kind: 'set', value: text }) },
      { field: 'proxyType', format: (v) => (PROXY_TYPES.includes(v) ? v : 'socks5'), parse: (text) => (PROXY_TYPES.includes(text) ? { kind: 'set', value: text } : undefined) },
      boolField('remoteDns'),
      boolField('bypassPrivate'),
      { field: 'bypass', format: listFormat, parse: listParse },
      { field: 'llmHosts', format: listFormat, parse: listParse },
      {
        field: 'llmProxy',
        format: str,
        parse: (text) => {
          if (text.trim() === '') return { kind: 'clear' };
          const parsed = parseProxyInput(text);
          return parsed ? { kind: 'set', value: parsed.url } : undefined;
        },
      },
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
      '.dsp-field{display:flex;flex-direction:column;gap:8px;padding:16px 0;border-top:.5px solid var(--dsw-alias-border-l2)}',
      '.dsp-field:first-child{border-top:0;padding-top:4px}',
      '.dsp-head{display:flex;align-items:center;gap:8px;min-height:28px}',
      '.dsp-label{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.dsp-hint{margin:0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}',
      '.dsp-error{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary)}',
      '.dsp-reset{border:0;background:none;padding:0;font:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dsp-reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}',
      '.dsp-input{box-sizing:border-box;width:100%;height:34px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.dsp-input::placeholder{color:var(--dsw-alias-label-dimmed,var(--dsw-alias-label-tertiary))}',
      '.dsp-input:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary)}',
      '.dsp-input[aria-invalid=true]{border-color:var(--dsw-alias-state-error-primary)}',
      '.dsp-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}',
      'textarea.dsp-input{height:auto;min-height:64px;padding:9px 12px;resize:vertical;font-family:var(--ds-font-family-code);font-size:12.5px;line-height:1.6;word-break:break-all}',
      '.dsp-segment{align-self:flex-start}',
      '.dsp-grid{display:grid;grid-template-columns:minmax(0,1fr) 112px;gap:12px}',
      '.dsp-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}',
      '.dsp-sub{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.dsp-sublabel{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
      '.dsp-wrap{position:relative}',
      '.dsp-wrap .dsp-input{padding-right:38px}',
      '.dsp-eye{position:absolute;top:50%;right:4px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.dsp-eye:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.dsp-toggle{display:flex;align-items:center;justify-content:space-between;gap:16px}',
      '.dsp-toggle-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.dsp-toggle-label{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.dsp-parsed{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.dsp-code{font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;padding:1px 6px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);word-break:break-all}',
      '.dsp-note{display:flex;align-items:flex-start;gap:6px;margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.dsp-note svg{flex:none;margin-top:2px}',
      '.dsp-status{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l2)}',
      '.dsp-status-dot{flex:none;display:inline-flex;align-items:center;height:20px}',
      '.dsp-status-main{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.dsp-status-title{font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}',
      '.dsp-status[data-state=error] .dsp-status-title{color:var(--dsw-alias-state-error-primary)}',
      '.dsp-status-meta{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);word-break:break-word}',
      '.dsp-mono{font-family:var(--ds-font-family-code)}',
      '.dsp-list{display:flex;flex-direction:column;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);overflow:hidden}',
      '.dsp-list-head{padding:7px 12px;font-size:11px;font-weight:500;line-height:16px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-3);border-bottom:.5px solid var(--dsw-alias-border-l2)}',
      '.dsp-row{display:grid;grid-template-columns:10px minmax(72px,max-content) minmax(0,1fr) auto minmax(64px,auto);align-items:center;column-gap:12px;padding:9px 12px;font-size:12.5px;line-height:18px}',
      '.dsp-row+.dsp-row{border-top:.5px solid var(--dsw-alias-border-l2)}',
      '.dsp-route{font-weight:500;color:var(--dsw-alias-label-primary);white-space:nowrap}',
      '.dsp-host{font-family:var(--ds-font-family-code);font-size:12px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsp-ms{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.dsp-ms[data-error]{color:var(--dsw-alias-state-error-primary)}',
      '.dsp-actions{display:flex;align-items:center;gap:10px}',
      '.dsp-advanced{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;padding:0;border:0;background:none;font:inherit;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dsp-advanced:hover{color:var(--dsw-alias-label-primary)}',
      '.dsp-advanced svg{transition:transform .15s ease}',
      '.dsp-advanced[aria-expanded=true] svg{transform:rotate(90deg)}',
      '.dsp-nested{display:flex;flex-direction:column;gap:16px;padding:4px 0 0}',
      '.dsp-nested .dsp-sub+.dsp-sub,.dsp-nested .dsp-toggle+.dsp-sub{padding-top:16px;border-top:.5px solid var(--dsw-alias-border-l2)}',
      '@media (max-width:520px){.dsp-grid,.dsp-grid2{grid-template-columns:minmax(0,1fr)}}',
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

    // ---- building blocks ---------------------------------------------------------------------
    function FieldHead(props) {
      const { t, label, htmlFor, field, disabled, onReset, children } = props;
      return h('div', { className: 'dsp-head' }, [
        h('label', { key: 'l', className: 'dsp-label', htmlFor }, label),
        field && field.overridden ? h(P.Tag, { key: 'tag', tone: 'neutral' }, t('overridden')) : null,
        field && field.overridden && onReset ? h('button', { key: 'reset', type: 'button', className: 'dsp-reset', disabled, onClick: onReset }, t('reset')) : null,
        children ? h(React.Fragment, { key: 'extra' }, children) : null,
      ]);
    }

    /** A labelled input inside a grid (no own divider). */
    function SubInput(props) {
      const { name, label, field, disabled, edit, placeholder, invalidLabel, type, mono } = props;
      const [reveal, setReveal] = useState(false);
      const id = `plugin-config-socks-proxy-${name}`;
      const input = h('input', {
        id,
        className: 'dsp-input' + (mono ? ' dsp-mono' : ''),
        type: type === 'password' && !reveal ? 'password' : 'text',
        autoComplete: type === 'password' ? 'new-password' : 'off',
        spellCheck: false,
        placeholder,
        value: field.text,
        disabled,
        'aria-invalid': field.invalid || undefined,
        onChange: (event) => edit(name, event.target.value),
      });
      return h('div', { className: 'dsp-sub' }, [
        h('label', { key: 'l', className: 'dsp-sublabel', htmlFor: id }, label),
        type === 'password'
          ? h('div', { key: 'w', className: 'dsp-wrap' }, [
              input,
              h('button', {
                key: 'eye',
                type: 'button',
                className: 'dsp-eye',
                title: props.t(reveal ? 'hidePassword' : 'showPassword'),
                'aria-label': props.t(reveal ? 'hidePassword' : 'showPassword'),
                onClick: () => setReveal(!reveal),
              }, reveal ? h(EyeOffIcon) : h(EyeIcon)),
            ])
          : h(React.Fragment, { key: 'i' }, input),
        field.invalid && invalidLabel ? h('p', { key: 'e', className: 'dsp-error' }, invalidLabel) : null,
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

    // ---- test section ------------------------------------------------------------------------
    function TestSection(props) {
      const { t, state, testConnection } = props;
      const [busy, setBusy] = useState(false);
      const [result, setResult] = useState(undefined);
      const alive = useRef(true);
      useEffect(() => () => {
        alive.current = false;
      }, []);

      const run = async () => {
        const inputMode = state.inputMode.text === 'fields' ? 'fields' : 'url';
        const draft = {
          inputMode,
          remoteDns: state.remoteDns.text !== 'false',
          mode: MODES.includes(state.mode.text) ? state.mode.text : 'llm',
          bypassPrivate: state.bypassPrivate.text !== 'false',
          bypass: state.bypass.text,
          llmHosts: state.llmHosts.text,
        };
        if (state.llmProxy.text.trim()) {
          const parsedLlm = parseProxyInput(state.llmProxy.text);
          if (parsedLlm) draft.llmProxy = parsedLlm.url;
        }
        if (inputMode === 'url') {
          const parsed = parseProxyInput(state.proxy.text);
          if (!parsed) {
            setResult({ ok: false, code: 'bad-config', message: t('invalidProxy') });
            return;
          }
          draft.proxy = parsed.url;
        } else {
          Object.assign(draft, {
            proxyType: PROXY_TYPES.includes(state.proxyType.text) ? state.proxyType.text : 'socks5',
            host: state.host.text.trim(),
            port: state.port.text.trim(),
            username: state.username.text,
            password: state.password.text,
          });
        }
        setBusy(true);
        setResult(undefined);
        const answer = await testConnection({ config: draft });
        if (!alive.current) return;
        setBusy(false);
        setResult(answer);
      };

      let status = null;
      if (busy) {
        status = h('div', { className: 'dsp-status', 'data-state': 'ongoing' }, [
          h('span', { key: 'd', className: 'dsp-status-dot' }, h(P.StateDot, { state: 'ongoing' })),
          h('div', { key: 'm', className: 'dsp-status-main' }, h('span', { className: 'dsp-status-title' }, t('testing'))),
        ]);
      } else if (result) {
        if (result.ok) {
          status = h('div', { className: 'dsp-status', 'data-state': 'done' }, [
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
          const text = translated(t, `err.${result.code}`, { message: result.message, status: result.status });
          status = h('div', { className: 'dsp-status', 'data-state': 'error' }, [
            h('span', { key: 'd', className: 'dsp-status-dot' }, h(P.StateDot, { state: 'error' })),
            h('div', { key: 'm', className: 'dsp-status-main' }, [
              h('span', { key: 't', className: 'dsp-status-title' }, t('test.fail')),
              h('span', { key: 'meta', className: 'dsp-status-meta' }, text || result.message),
              text && result.message && !/\{message\}/.test(t(`err.${result.code}`))
                ? h('span', { key: 'raw', className: 'dsp-status-meta dsp-mono' }, result.message)
                : null,
            ]),
          ]);
        }
      }

      const llm = !busy && result && result.llmUpstream ? result.llmUpstream : undefined;
      const llmStatus = llm
        ? h('div', { className: 'dsp-status', 'data-state': llm.ok ? 'done' : 'error' }, [
            h('span', { key: 'd', className: 'dsp-status-dot' }, h(P.StateDot, { state: llm.ok ? 'done' : 'error' })),
            h('div', { key: 'm', className: 'dsp-status-main' }, [
              h('span', { key: 't', className: 'dsp-status-title' }, [
                t('test.llmUpstream'),
                h(React.Fragment, { key: 'sp1' }, ' '),
                h(P.Tag, { key: 'type', tone: 'neutral' }, TYPE_LABELS[llm.type] || 'SOCKS5'),
                h(React.Fragment, { key: 'sp2' }, ' '),
                llm.ok
                  ? h(P.Tag, { key: 'auth', tone: 'success' }, t(llm.auth === 'password' ? 'test.auth.password' : 'test.auth.none'))
                  : h(P.Tag, { key: 'fail', tone: 'neutral' }, shortError(t, llm.code)),
              ]),
              llm.ok
                ? h('span', { key: 'meta', className: 'dsp-status-meta dsp-mono' }, `${llm.via} · ${llm.totalMs} ms`)
                : h('span', { key: 'meta', className: 'dsp-status-meta' }, translated(t, `err.${llm.code}`, { message: llm.message }) || llm.message),
            ]),
          ])
        : null;
      const endpoints = !busy && result && Array.isArray(result.endpoints) ? result.endpoints : undefined;
      const list = endpoints
        ? endpoints.length
          ? h('div', { className: 'dsp-list' }, [
              h('div', { key: 'head', className: 'dsp-list-head' }, t('testEndpoints')),
              ...endpoints.map((e, i) =>
                h('div', { key: `e${i}`, className: 'dsp-row', title: e.ok ? e.baseURL : `${e.baseURL}\n${e.message || ''}` }, [
                  h(P.StateDot, { key: 'dot', state: e.ok ? 'done' : 'error', size: 8 }),
                  h('span', { key: 'route', className: 'dsp-route' }, e.route),
                  h('span', { key: 'host', className: 'dsp-host' }, `${e.host}:${e.port}`),
                  h(P.Tag, { key: 'via', tone: e.via === 'proxy' ? 'info' : 'outline' }, e.via === 'proxy' ? (e.upstream === 'llm' ? `${t('test.via.proxy')} · ${t('test.llmUpstream')}` : t('test.via.proxy')) : t('test.via.direct')),
                  h('span', { key: 'ms', className: 'dsp-ms', 'data-error': e.ok ? undefined : '' }, e.ok ? `${e.ms} ms` : shortError(t, e.code)),
                ]),
              ),
            ])
          : h('p', { className: 'dsp-hint' }, t('test.noEndpoints'))
        : null;

      return h('div', { className: 'dsp-field' }, [
        h(FieldHead, { key: 'head', t, label: t('testTitle') }, [
          h(P.Tag, { key: 'ver', tone: 'quiet' }, `v${PANEL_VERSION}`),
          h(P.Button, { key: 'go', variant: 'outline', size: 'sm', disabled: busy || !state.available, onClick: run }, busy ? t('testing') : t('testButton')),
        ]),
        h('p', { key: 'hint', className: 'dsp-hint' }, t('testHint')),
        status ? h(React.Fragment, { key: 'status' }, status) : null,
        llmStatus ? h(React.Fragment, { key: 'llmstatus' }, llmStatus) : null,
        list ? h(React.Fragment, { key: 'list' }, list) : null,
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

    // ---- the page ----------------------------------------------------------------------------
    function ProxySettings(props) {
      const { t } = props;
      const state = props.useSocksProxyForm((s) => s);
      const [advanced, setAdvanced] = useState(false);
      if (props.view === 'summary') return t('description');

      const disabled = !state.writable || state.saving;
      const mode = MODES.includes(state.mode.text) ? state.mode.text : 'llm';
      const dshOn = mode === 'dsh' || mode === 'all';
      const llmOn = mode === 'llm' || mode === 'all';
      const setRouting = (dsh, llm) => edit('mode', dsh && llm ? 'all' : dsh ? 'dsh' : llm ? 'llm' : 'off');
      const inputMode = state.inputMode.text === 'fields' ? 'fields' : 'url';
      const proxyType = PROXY_TYPES.includes(state.proxyType.text) ? state.proxyType.text : 'socks5';
      const edit = props.edit;
      const common = { t, disabled, edit, resetField: props.resetField };
      const parsed = inputMode === 'url' && !state.proxy.invalid ? parseProxyInput(state.proxy.text) : undefined;
      const masked = parsed ? parsed.url.replace(/:([^:@/]+)@/, ':••••••@') : '';
      const showParsed = parsed && parsed.url !== state.proxy.text.trim();

      const serverBody =
        inputMode === 'url'
          ? [
              h('textarea', {
                key: 'ta',
                id: 'plugin-config-socks-proxy-proxy',
                className: 'dsp-input',
                rows: 2,
                spellCheck: false,
                placeholder: t('proxyPlaceholder'),
                value: state.proxy.text,
                disabled,
                'aria-invalid': state.proxy.invalid || undefined,
                onChange: (event) => edit('proxy', event.target.value),
              }),
              state.proxy.invalid
                ? h('p', { key: 'err', className: 'dsp-error' }, t('invalidProxy'))
                : showParsed
                  ? h('div', { key: 'parsed', className: 'dsp-parsed' }, [
                      h('span', { key: 'l' }, t('parsedAs')),
                      h(P.Tag, { key: 'type', tone: 'info' }, TYPE_LABELS[parsed.type] || 'SOCKS5'),
                      h('code', { key: 'c', className: 'dsp-code' }, masked),
                    ])
                  : null,
              h('p', { key: 'hint', className: 'dsp-hint' }, t('proxyHint')),
            ]
          : [
              h('div', { key: 'type', className: 'dsp-sub' }, [
                h('span', { key: 'l', className: 'dsp-sublabel' }, t('proxyType')),
                h(P.SegmentedControl, {
                  key: 'seg',
                  id: 'plugin-config-socks-proxy-type',
                  className: 'dsp-segment',
                  label: t('proxyType'),
                  value: proxyType,
                  disabled,
                  options: PROXY_TYPES.map((m) => ({ value: m, label: TYPE_LABELS[m] })),
                  onChange: (value) => edit('proxyType', value),
                }),
                proxyType === 'https' ? h('p', { key: 'h', className: 'dsp-hint' }, t('proxyTypeHint')) : null,
              ]),
              h('div', { key: 'hp', className: 'dsp-grid' }, [
                h(SubInput, { key: 'host', ...common, name: 'host', label: t('host'), field: state.host, placeholder: t('hostPlaceholder'), invalidLabel: t('invalidHost'), mono: true }),
                h(SubInput, { key: 'port', ...common, name: 'port', label: t('port'), field: state.port, placeholder: proxyType === 'socks5' ? '7890' : proxyType === 'https' ? '443' : '8080', invalidLabel: t('invalidPort'), mono: true }),
              ]),
              h('div', { key: 'up', className: 'dsp-grid2' }, [
                h(SubInput, { key: 'user', ...common, name: 'username', label: t('username'), field: state.username, placeholder: t('optional') }),
                h(SubInput, { key: 'pass', ...common, name: 'password', label: t('password'), field: state.password, placeholder: t('optional'), type: 'password' }),
              ]),
              // An HTTP proxy always resolves destination names itself; the choice only exists for SOCKS5.
              proxyType === 'socks5'
                ? h(ToggleRow, { key: 'dns', label: t('remoteDns'), hint: t('remoteDnsHint'), field: state.remoteDns, disabled, onChange: (checked) => edit('remoteDns', checked ? 'true' : 'false') })
                : null,
            ];

      const llmProxyFilled = state.llmProxy.text.trim() !== '';
      const primaryLabel = dshOn ? t('dshProxyTitle') : t('primaryForLlm');
      const primaryBlock = h('div', { key: 'primary', className: 'dsp-nested' }, [
        h(FieldHead, { key: 'head', t, label: primaryLabel, htmlFor: inputMode === 'url' ? 'plugin-config-socks-proxy-proxy' : undefined }, [
          h(P.SegmentedControl, {
            key: 'seg',
            id: 'plugin-config-socks-proxy-input',
            label: t('server'),
            value: inputMode,
            disabled,
            options: INPUT_MODES.map((m) => ({ value: m, label: t(`inputMode.${m}`) })),
            onChange: (value) => edit('inputMode', value),
          }),
        ]),
        ...serverBody,
        h('p', { key: 'note', className: 'dsp-note' }, [h(LockIcon, { key: 'i' }), h('span', { key: 't' }, t('passwordNote'))]),
      ]);
      const llmBlock = h('div', { key: 'llmproxy', className: 'dsp-nested' }, [
        h(TextRow, { key: 'lp', ...common, name: 'llmProxy', field: state.llmProxy, placeholder: t('proxyPlaceholder') }),
      ]);
      const modeSection = h('div', { key: 'mode', className: 'dsp-field' }, [
        h('div', { key: 'head', className: 'dsp-head' }, h('label', { className: 'dsp-label' }, t('proxyFor'))),
        h('div', { key: 'dshwrap', className: 'dsp-nested' }, [
          h(ToggleRow, { key: 'dsh', label: t('proxyFor.dsh'), hint: t('proxyFor.dshHint'), field: { text: dshOn ? 'true' : 'false' }, disabled, onChange: (checked) => setRouting(checked, llmOn) }),
          dshOn ? primaryBlock : null,
        ]),
        h('div', { key: 'llmwrap', className: 'dsp-nested' }, [
          h(ToggleRow, { key: 'llm', label: t('proxyFor.llm'), hint: t('proxyFor.llmHint'), field: { text: llmOn ? 'true' : 'false' }, disabled, onChange: (checked) => setRouting(dshOn, checked) }),
          (!dshOn && llmOn && !llmProxyFilled) ? primaryBlock : null,
          llmOn ? llmBlock : null,
        ]),
        h('p', { key: 'desc', className: 'dsp-hint' }, `${t('modeHint')} ${t('bothOnHint')}`),
      ]);

      const advancedSection = h('div', { key: 'adv', className: 'dsp-field' }, [
        h('button', { key: 'toggle', type: 'button', className: 'dsp-advanced', 'aria-expanded': advanced, onClick: () => setAdvanced(!advanced) }, [h(ChevronIcon, { key: 'i' }), t('advanced')]),
        advanced
          ? h('div', { key: 'body', className: 'dsp-nested' }, [
              h(ToggleRow, { key: 'bp', label: t('bypassPrivate'), hint: t('bypassPrivateHint'), field: state.bypassPrivate, disabled, onChange: (checked) => edit('bypassPrivate', checked ? 'true' : 'false') }),
              h(TextRow, { key: 'bypass', ...common, name: 'bypass', field: state.bypass, placeholder: 'corp.example.com, 192.168.1.50' }),
              llmOn ? h(TextRow, { key: 'llm', ...common, name: 'llmHosts', field: state.llmHosts, placeholder: 'api.example.com' }) : null,
            ])
          : null,
      ]);

      return h(P.SettingsForm, { labels: formLabels(t), state, onSave: props.save, onDiscard: props.discard }, [
        modeSection,
        h(TestSection, { key: 'test', t, state, testConnection: props.testConnection }),
        advancedSection,
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
