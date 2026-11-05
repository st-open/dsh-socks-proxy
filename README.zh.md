# @st-open/dsh-socks-proxy

![界面示意（非真实截图）](docs/preview.svg)

让 DeepSeek Harness 的出站流量走 **SOCKS5**、**HTTP** 或 **HTTPS**（与代理之间走 TLS）代理。两种模式：

| mode | 走代理的流量 | 其他流量 |
|---|---|---|
| `llm` | 仅 LLM API 请求（自动识别 `dsh-llm-pi-ai` 中各 provider 的 `baseURL` 主机 + 常见官方端点 + `llmHosts`） | 保持原路由（直连，或环境变量里的 HTTP 代理） |
| `all` | DSH 进程内全部出站：LLM、MCP HTTP、web_search、**web_fetch**、`node:http` 客户端（遥测），以及之后启动的子进程（bash/git/curl/pnpm 通过 `HTTP(S)_PROXY`） | — |
| `off` | 不做任何事 | — |

始终直连：loopback（localhost / 127.x / ::1）、`bypass` 列表，以及 `bypassPrivate: true` 时的内网 IP 字面量（10.x / 172.16-31.x / 192.168.x / 169.254.x / fc00::/7 / fe80::/10）。

## 第二条代理（按目标分流）

典型场景：**大模型 API 走主代理，但 GitHub 等网站需要另一条线路**。启用后，`all` 模式下命中 `secondHosts` 的主机会走 `secondProxy`（不同的代理服务器），其余主机仍走主代理 `proxy`。本地 HTTP 桥按目标主机选择上游，所以一个桥同时服务两条代理，子进程 / web_fetch 也一样生效。

- 仅 `all` 模式可用（`llm` 模式下非 LLM 主机本就保持直连）。
- `secondHosts` 支持逗号分隔与子域匹配：`github.com` 同时匹配 `api.github.com`；`*.githubusercontent.com` 等同。
- 关闭或留空 `secondProxy` / `secondHosts` 时完全不影响主代理。

在插件页「高级设置 → 启用第二条代理」里填写；或写进 `cordis.patch.yml`：

```yaml
    secondEnabled: true
    secondProxy: socks5h://127.0.0.1:7891     # GitHub 等走这条
    secondHosts: [github.com, '*.githubusercontent.com']
```

> 子进程（git/curl 等）只通过 `HTTP(S)_PROXY` 指向本地桥，桥再按目标主机选上游，所以同一个 `HTTP_PROXY` 也能让 GitHub 与其它网站各走各的代理。

## 原理

1. 插件在 `127.0.0.1:<随机端口>` 起一个本地 **HTTP 桥**，把请求转给上游代理（自写 SOCKS5 客户端和 HTTP CONNECT 客户端，支持用户名/密码认证，无第三方依赖）。上游是 HTTP(S) 代理时，`https://` 走 CONNECT 隧道，明文 `http://` 按绝对 URL 转发（很多代理只允许 CONNECT 到 443）。桥要求每次启动随机生成的 Basic 凭据，其他本机进程无法借用；上游代理的账号密码也不会出现在子进程环境变量里。
2. 用一个路由 dispatcher 替换 undici 全局 dispatcher（Node `fetch` 与 pi-ai/MCP 都经由它）：命中规则的请求交给指向桥的 `ProxyAgent`，其余交还给原 dispatcher。
3. `all` 模式额外调用 DSH 自带的 `@deepseek-ai/dsh-http-proxy`（从 DSH 安装目录加载同一实例），把桥注册为官方代理策略，因此 web_fetch、子进程环境与 `proxyRouteFor()` 一致生效；并替换 `http/https.globalAgent`。
4. 插件停用/卸载时按逆序恢复原 dispatcher、环境变量和 agent。

undici 与 dsh-http-proxy 都取自 DSH 安装本身，插件没有 npm 依赖。

## 在插件页配置（推荐）

左侧栏 **插件 → 已安装插件 → SOCKS5 代理**，页面上可以选择代理模式、填写 SOCKS5 服务器、设置局域网直连、直连主机和额外的大模型主机。点 **保存** 后立即生效（页面上的字段均为热更新字段，无需重启）。保存的值写入 profile 的 `cordis.patch.yml`。

代理服务器有两种填写方式：

- **粘贴地址或命令**：直接粘贴服务商给的内容，类型由内容自动判断：
  - SOCKS5：`socks5h://用户:密码@主机:端口`、`socks5://主机:端口`、`export ALL_PROXY=socks5://…`、`curl --socks5-hostname 主机:端口 --proxy-user 用户:密码 …`、`curl -x socks5h://…`
  - HTTP / HTTPS：`http://用户:密码@主机:端口`、`https://主机:端口`、`export HTTPS_PROXY=http://…`、`set http_proxy=主机:端口`、`curl -x http://…`、`curl --proxy 主机:端口 -U 用户:密码 …`
  - 不带协议的 `主机:端口`、`用户:密码@主机:端口`、`主机:端口:用户:密码` 按 SOCKS5 处理（要用 HTTP 请写成 `http://…`）。
  - 保存时自动整理为标准地址。
- **分项填写**：选择代理类型（SOCKS5 / HTTP / HTTPS），分别填写服务器地址、端口、用户名、密码；SOCKS5 还可以选是否由代理解析域名（socks5h）。HTTP 代理总是由代理解析域名。

**测试连接**：只检测代理服务器本身，不访问任何网站，也不影响正在生效的代理；用页面上当前填写的内容（无需先保存）。
- SOCKS5：连接端口、完成 SOCKS5 握手，填了账号时再做用户名/密码认证，然后断开。
- HTTP / HTTPS：连接端口（HTTPS 先完成 TLS 握手），发一个指向 `.invalid` 域名的请求——这种域名不可能被解析，所以不会访问任何网站，但代理会先校验账号：返回 407 说明需要认证或账号密码错误，其他任何 HTTP 应答都说明代理正常。
- 成功时显示类型、TCP 连接耗时、握手耗时以及认证情况；失败时给出具体原因（连接被拒绝、超时、域名解析失败、不是 SOCKS5 服务 / 不是 HTTP 代理（类型选错了）、TLS 握手失败、需要认证、用户名或密码错误等）。

测试结果下面还有一块 **模型接口连通性**：按当前设置**实际会走的那条路**（经代理或直连），逐个探测模型设置里每个 provider 的 `baseURL`（只建 TCP/SOCKS5 连接，不发模型请求）。哪一行是 ✗，就是对应模型跑不通的原因。

> **局域网地址直连**注意：若内网模型网关（如 `10.1.2.3:20000`）只能经代理访问，必须关闭「局域网地址直连」，否则该地址会被强制直连而超时。测试面板会直接把这种情况显示成 `via direct ✗ ETIMEDOUT`。

测试请求经 DSH 自身的认证接口 `POST /api/socks-proxy/test` 发送，只有已登录的本机页面能调用。

首次安装后需要重启一次 DSH，插件的宿主部分与配置页才会加载。

## 在文件中配置（`~/.dsh/profiles/<profile>/cordis.patch.yml`）

```yaml
- id: socks-proxy
  name: "@st-open/dsh-socks-proxy"
  config:
    mode: llm                     # "off" | llm | all（off 请加引号）
    proxy: socks5h://127.0.0.1:7890
    # proxy: socks5h://user:pass@host:1080   用户名/密码中的特殊字符需 URL 编码
    bypassPrivate: true           # 内网 IP 字面量直连
    bypass: []                    # 永远直连的主机，如 [corp.example.com, "10.1."]
    llmHosts: []                  # llm 模式下额外视为 LLM 的主机
    providers: []                 # 非空时，llm 模式只代理这些 provider 路由名（如 [chaoxing]）
    builtinHosts: true            # llm 模式是否包含内置常见 LLM 端点
    exportToChildren: true        # all 模式：子进程获得 HTTP(S)_PROXY 指向桥
    patchNodeHttp: true           # all 模式：替换 node:http(s) 全局 agent
    logTunnels: false             # 记录每条隧道（调试用）
```

也可不用 `proxy` URL，改用对象：

```yaml
    socks:
      host: 127.0.0.1
      port: 1080
      username: me
      passwordEnv: SOCKS_PASSWORD   # 从环境变量读取密码，避免明文写进 YAML
      remoteDns: true               # true = 代理端解析域名（socks5h）
      timeoutMs: 15000
```

`socks5h://` 由代理解析域名（推荐，防 DNS 污染）；`socks5://` 在本机解析后再交给代理。

修改后**重启 DSH** 生效。启动日志里会打印 `socks-proxy: mode=... via SOCKS5 ...` 以及当前识别到的 LLM 主机。

## 已知限制

- 仅 SOCKS5（不支持 SOCKS4/PAC/系统代理自动探测）。
- `llm` 模式按主机名判断：若某 LLM 网关与其他服务共用同一主机名，该主机的所有请求都会走代理。
- Worker 线程（workflow / PTC 运行时）有独立的全局 dispatcher，不受影响（DSH 官方代理同样如此）。
- 子进程只在 `all` 模式且 `exportToChildren: true` 时走代理，且只对插件启动**之后**启动的子进程生效；常驻终端会话需重开。
- 在插件启用前已建立的 keep-alive 连接会继续沿用旧路由直到关闭。

## 测试

```powershell
$env:ELECTRON_RUN_AS_NODE="1"
$env:DSH_SOCKS_PROXY_RUNTIME_DIR="C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\app.asar\dsh"
& "C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe" test/run.mjs
# 真实 TLS 端到端（可选第二个参数指定真实 SOCKS5 服务器）：
& "C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe" test/e2e-real.mjs https://api.deepseek.com/ socks5h://127.0.0.1:7890
```

macOS（桌面版装在「应用程序」里时；路径以你机器上的实际安装位置为准）：

```bash
export ELECTRON_RUN_AS_NODE=1
export DSH_SOCKS_PROXY_RUNTIME_DIR="/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh"
"/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" test/run.mjs
```

## 在其他电脑 / macOS 上安装

插件是纯 JavaScript，没有 npm 依赖，也没有任何 Windows 专用代码；undici、dsh-http-proxy、schemastery 都在运行时从 DSH 自己的安装目录加载，所以 macOS / Linux 的 DSH 桌面版同样适用。

1. 把整个 `dsh-socks-proxy` 文件夹拷到目标电脑，例如 `~/Documents/DEEPSEEK/dsh-socks-proxy`。
2. 打开 DSH →「插件」→「添加插件」，填入这个文件夹的**绝对路径**安装；或用命令行 `dsh plugin --profile desktop add link:/绝对路径/dsh-socks-proxy`。
3. 重启 DSH，在「插件 → 代理（SOCKS5 / HTTP）」里重新填写代理和模式（配置保存在各自电脑的 profile 里，不会随文件夹一起带过去）。
4. 先点「测试连接」：换了电脑，所在网络不同，哪些地址能直连、哪些必须走代理可能也不同，以测试结果为准。
