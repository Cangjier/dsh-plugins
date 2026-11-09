#!/usr/bin/env node
/**
 * Regenerate `index.json` — the format-1 DSH plugin market index for every
 * submodule of this repository.
 *
 *   node tools/market-index.mjs           write index.json
 *   node tools/market-index.mjs --check   exit 1 when index.json is stale
 *
 * The document is derived from facts only:
 *   - `.gitmodules`        submodule path, repository URL, tracked branch
 *   - `<submodule>/package.json`   name, version, os, and whether it declares `dsh.bundle`
 *   - the parent's gitlink pinned commit and that commit's time (publishTimestamp)
 *
 * Plus the curated display metadata in this file (title, description, category,
 * keywords). A submodule with no entry below is a hard error, so a newly added
 * plugin cannot be published without being listed. A submodule that declares no
 * `dsh.bundle` is not installable as a plugin and is reported as skipped instead:
 * index entries are installable bundles only.
 *
 * Format 1 is a strict format and dsh rejects the whole document on the first
 * violation. `validate()` mirrors the rules of the official parser
 * (`@deepseek-ai/dsh-plugin-market-index`) closely enough to catch generator
 * mistakes; the authoritative check is that parser, see the README section
 * "插件市场索引 index.json".
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = join(ROOT, 'index.json')

const INDEX_TITLE = {
  en: "Cangjier's DSH Plugins",
  zh: 'Cangjier 的 DSH 插件集',
}
const INDEX_DESCRIPTION = {
  en: 'DeepSeek Harness plugins from this repository, each installed from its own Git repository at the pinned commit.',
  zh: '本仓库收录的 DeepSeek Harness 插件，每条都从各自的 Git 仓库按钉定的 commit 安装。',
}

/** Category ids, in the order the plugins are grouped in the document. */
const CATEGORIES = {
  agent: { en: 'Agent control', zh: '智能体控制' },
  screen: { en: 'Screen & input', zh: '屏幕与输入' },
  vision: { en: 'Vision & OCR', zh: '视觉与文字识别' },
  media: { en: 'Video & image', zh: '视频与图像' },
  audio: { en: 'Audio & speech', zh: '音频与语音' },
  notify: { en: 'Notifications', zh: '通知与回信' },
  network: { en: 'Network & remote access', zh: '网络与互联' },
  files: { en: 'Files & reading', zh: '文件与阅读' },
}

/** Label ids. `windows-only` is not curated: it follows `os` in package.json. */
const LABELS = {
  'windows-only': { en: 'Windows only', zh: '仅 Windows' },
}

/** Display metadata, keyed by submodule path. */
const DISPLAY = {
  'dsh-controller': {
    title: { en: 'DSH Controller', zh: 'DSH 控制' },
    description: {
      en: "Lets the agent control DSH itself — conversations, plugins and the host — through DSH's own APIs first, falling back to desktop automation only when an API is unavailable.",
      zh: '让 agent 控制 DSH 自身（会话、插件、宿主）：先走 DSH 自己的 API，走不通才退回桌面自动化。',
    },
    category: 'agent',
    keywords: ['agent control', 'sessions', 'plugins', 'host restart', '会话管理'],
  },
  'dsh-keep-alive': {
    title: { en: 'Keep Alive', zh: '对话保活' },
    description: {
      en: 'Decides once per conversation whether it should be kept alive, then starts a new conversation with the same user message when a turn ends and no other conversation is running in the workspace.',
      zh: '每条对话开始时判定一次要不要保活；对话正常结束且同工作区没有别的对话在跑时，用完全相同的 user message 新建一条对话继续。',
    },
    category: 'agent',
    keywords: ['continuation', 'auto resume', 'conversation', '保活', '接力'],
  },
  'dsh-computer-use': {
    title: { en: 'Computer Use', zh: '电脑操作' },
    description: {
      en: 'Turns the screen, mouse, keyboard and on-screen text into first-class tools: screenshot, click, type, find text, and verify what happened. Single-step actions only — every decision stays with DSH.',
      zh: '把屏幕、鼠标、键盘与屏幕文字定位变成一等工具：截图、点击、打字、找字，并把每一步的结果验证回来。只提供单步动作，判断全部归 DSH。',
    },
    category: 'screen',
    keywords: ['desktop automation', 'mouse', 'keyboard', 'screenshot', 'ocr', '桌面自动化'],
  },
  'dsh-screen-recorder': {
    title: { en: 'Screen Recorder', zh: '录屏分析' },
    description: {
      en: 'Records the screen and reads the recording into structured semantics: timeline segments, OCR text, region segmentation, YOLO detection and speech transcription, fused into one JSON with evidence.',
      zh: '录屏，并把录屏读成结构化语义：时间轴分段 + OCR 文字 + 区域语义分割 + YOLO 目标检测 + 语音转文字，融成一份带证据的 JSON。',
    },
    category: 'screen',
    keywords: ['screen capture', 'recording', 'yolo', 'speech to text', '录屏'],
  },
  'dsh-ocr': {
    title: { en: 'OCR', zh: '图文识别' },
    description: {
      en: "Turns text in pixels into usable data: every line's content, confidence and pixel box, or the clickable center of a given string; also reads burned-in subtitles back from video frames.",
      zh: '把像素里的文字变成可用的数据：每行的内容、置信度与像素框，或按文字找出它在图上的可点击中心；也能回读画面上烧录的字幕。',
    },
    category: 'vision',
    keywords: ['text recognition', 'subtitle', 'coordinates', '文字识别', '字幕'],
  },
  'dsh-ffmpeg': {
    title: { en: 'FFmpeg', zh: 'FFmpeg 工具' },
    description: {
      en: 'Makes ffmpeg a set of deterministic, verifiable tools: transcode, trim, extract frames, compose, record the screen, and turn one recording into a video plus its semantic structure.',
      zh: '把 ffmpeg 变成一套确定、可验证的工具：转码、裁剪、抽帧、拼合、录屏，以及一次录屏进、视频加语义结构出。',
    },
    category: 'media',
    keywords: ['video', 'transcode', 'screen recording', 'frames', '视频处理'],
  },
  'video-factory': {
    title: { en: 'Video Factory', zh: '成片工厂' },
    description: {
      en: 'Materials in, finished video out: deterministic tools that render images, clips, music and a script into a publishable mp4; the flow and creative decisions stay with DSH.',
      zh: '素材进，成片出：把图片、视频片段、音乐和一段文案确定性渲染成可发布的 mp4；流程与创作决策全部归 DSH。',
    },
    category: 'media',
    keywords: ['video production', 'render', 'mp4', '成片', '视频制作'],
  },
  'dsh-tts': {
    title: { en: 'TTS', zh: '文字转语音' },
    description: {
      en: 'Turns text into speech with the engine kept outside the plugin: Edge reading by default (no key, word-level timestamps), or any local TTS command line through a template; multi-speaker scripts get one file per line plus a sample-accurate timeline.',
      zh: '文字变声音，引擎留在插件之外：默认走 Edge 朗读（免 Key、带逐词时间戳），或把任意本地 TTS 命令行用模板接进来；多人脚本每行一个文件 + 一条采样级时间线。',
    },
    category: 'audio',
    keywords: ['text to speech', 'voice', 'edge tts', 'timestamps', '语音合成'],
  },
  'dsh-video-audio': {
    title: { en: 'Video Audio', zh: '音频工具' },
    description: {
      en: 'Builds, repairs and measures audio: exact test signals, sample-accurate assembly, explicit repair chains with re-measurement, plus loudness, levels, clipping, noise, sync and audio-event measurements — numbers and files only.',
      zh: '造声音、修声音、量声音：参数完全指定的测试信号、采样级拼装、显式修复链与回测，以及响度、电平、削波、噪声、同步与声学事件测量——只出数字与文件。',
    },
    category: 'audio',
    keywords: ['audio', 'loudness', 'noise', 'recording', '音频测量'],
  },
  'dsh-wireguard': {
    title: { en: 'WireGuard', zh: 'WireGuard 组网' },
    description: {
      en: 'Turns a Windows or Linux machine into a WireGuard server, or joins it to one, from a panel in the Harness Web UI: start the service, hand out VPN addresses, and bring up local tunnels without changing the default internet route.',
      zh: '把 Windows 或 Linux 机器变成 WireGuard 服务器，或把它加入其中一个：在 Harness Web UI 面板里启动服务、分配 VPN 地址并拉通本地隧道，不改默认上网路由。',
    },
    category: 'network',
    keywords: ['wireguard', 'vpn', 'mesh', 'lan', '组网', '内网'],
  },
  'dsh-mail-notify': {
    title: { en: 'Mail Notify', zh: '邮件通知' },
    description: {
      en: 'Connects every agent turn to your mailbox, both ways: a notification mail when a turn ends or the agent asks a question, and replying to that mail continues the conversation.',
      zh: '把 agent 的每一轮回答和你的邮箱接起来，双向：结束时（或提问时）发通知邮件，回复邮件又能接着原来的上下文再起一轮。',
    },
    category: 'notify',
    keywords: ['email', 'smtp', 'imap', 'notification', '邮件通知'],
  },
  'dsh-quick-read': {
    title: { en: 'Quick Read', zh: '快速读取' },
    description: {
      en: 'Two tools for reading files without getting stuck: byte-paged text reading that recovers from a wrong path, and intent-driven structural summaries of large files through sliding windows.',
      zh: '两个让读文件不再卡住的工具：按字节分页读文本（路径写错时在所在目录容错找回），以及按意图把大文件切成滑动窗口、逐窗输出结构化信息。',
    },
    category: 'files',
    keywords: ['read file', 'pagination', 'large file', 'structure', '分页读取'],
  },
}

// ---------------------------------------------------------------------------
// Facts from the repository
// ---------------------------------------------------------------------------

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function parseGitmodules(text) {
  const modules = []
  let current
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#') || line.startsWith(';')) continue
    const section = /^\[submodule\s+"(.*)"\]$/.exec(line)
    if (section) {
      current = { name: section[1], path: '', url: '', branch: '' }
      modules.push(current)
      continue
    }
    if (current === undefined) continue
    const pair = /^([A-Za-z][\w-]*)\s*=\s*(.*)$/.exec(line)
    if (pair) current[pair[1]] = pair[2]
  }
  return modules
}

function localized(text) {
  return { en: text.en, zh: text.zh }
}

function ownerAndRepo(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean)
  const owner = parts.at(-2)
  const repo = parts.at(-1).replace(/\.git$/u, '')
  return { owner, repo }
}

function readPackage(module) {
  try {
    return JSON.parse(readFileSync(join(ROOT, module.path, 'package.json'), 'utf8'))
  } catch {
    throw new Error(`submodule ${module.path} is not checked out; run "git submodule update --init --recursive"`)
  }
}

function isInstallableBundle(pkg) {
  return pkg?.dsh?.bundle?.patch !== undefined
}

function submoduleFacts(module, pkg) {
  const dir = join(ROOT, module.path)

  // The commit this repository pins, not whatever the submodule happens to have
  // checked out: index.json must describe what `git clone --recurse-submodules` gives.
  // Read the staged gitlink first, so a submodule added in this very commit can be
  // indexed before the commit exists; fall back to HEAD for a committed tree.
  const staged = /^160000 ([0-9a-f]{40}) \d\t/u.exec(git('ls-files', '-s', '--', module.path))
  const recorded = staged ?? /^160000 commit ([0-9a-f]{40})\t/u.exec(git('ls-tree', 'HEAD', '--', module.path))
  if (recorded === null) {
    throw new Error(`submodule ${module.path} is not recorded in the index or in HEAD; run "git add ${module.path}" before generating index.json`)
  }
  const commit = recorded[1]

  let commitTime
  try {
    commitTime = execFileSync('git', ['-C', dir, 'show', '-s', '--format=%ct', commit], { encoding: 'utf8' }).trim()
  } catch {
    throw new Error(`submodule ${module.path}: pinned commit ${commit} is missing locally; run "git submodule update --init --recursive"`)
  }

  if (!URL.canParse(module.url)) throw new Error(`submodule ${module.path}: URL ${module.url} is not absolute`)
  const { owner, repo } = ownerAndRepo(module.url)
  const windowsOnly = Array.isArray(pkg.os) && pkg.os.includes('win32')
  return {
    dir: module.path,
    packageName: pkg.name,
    version: pkg.version,
    commit,
    publishTimestamp: Number(commitTime),
    sourceUrl: module.url,
    repositoryUrl: `https://github.com/${owner}/${repo}`,
    author: owner,
    labels: windowsOnly ? ['windows-only'] : [],
  }
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

function buildIndex() {
  const modules = parseGitmodules(readFileSync(join(ROOT, '.gitmodules'), 'utf8'))
  const categoryOrder = Object.keys(CATEGORIES)

  // index.json lists installable bundles only. A submodule that declares no
  // `dsh.bundle` (for example a documentation set) cannot be added by `dsh plugin add`,
  // so it is reported as skipped rather than published as a broken entry.
  const installable = []
  const skipped = []
  for (const module of modules) {
    const pkg = readPackage(module)
    if (isInstallableBundle(pkg)) installable.push({ module, pkg })
    else skipped.push(module.path)
  }

  const unknown = installable.filter(({ module }) => DISPLAY[module.path] === undefined)
  if (unknown.length > 0) {
    throw new Error(
      `no display metadata for submodule(s): ${unknown.map(({ module }) => module.path).join(', ')}. ` +
        'Add them to DISPLAY in tools/market-index.mjs so they are not silently left out of index.json.',
    )
  }

  const plugins = installable.map(({ module, pkg }) => {
    const facts = submoduleFacts(module, pkg)
    const display = DISPLAY[module.path]
    return {
      name: facts.packageName,
      title: localized(display.title),
      description: localized(display.description),
      author: facts.author,
      repository: { url: facts.repositoryUrl },
      metadata: {
        category: display.category,
        keywords: display.keywords,
        labels: facts.labels,
      },
      versions: [
        {
          version: facts.version,
          publishTimestamp: facts.publishTimestamp,
          source: {
            type: 'git',
            url: facts.sourceUrl,
            commit: facts.commit,
          },
        },
      ],
    }
  })

  // Group by the declared category order; the document order is dsh's default order.
  const rank = (plugin) => {
    const at = categoryOrder.indexOf(plugin.metadata.category)
    return at === -1 ? categoryOrder.length : at
  }
  plugins.sort((left, right) => rank(left) - rank(right) || left.name.localeCompare(right.name))

  return {
    index: {
      format: 1,
      title: localized(INDEX_TITLE),
      description: localized(INDEX_DESCRIPTION),
      metadata: {
        categories: Object.fromEntries(Object.entries(CATEGORIES).map(([id, text]) => [id, { title: localized(text) }])),
        labels: Object.fromEntries(Object.entries(LABELS).map(([id, text]) => [id, { title: localized(text) }])),
      },
      plugins,
    },
    skipped,
  }
}

// ---------------------------------------------------------------------------
// Validation (mirrors the format-1 rules that the generator can get wrong)
// ---------------------------------------------------------------------------

const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/u
const COMMIT = /^[0-9a-f]{40}$/u
const LANGUAGE_ID = /^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/u

function fail(path, reason) {
  throw new Error(`${path} ${reason}`)
}

function checkLocalized(value, path) {
  if (typeof value === 'string') {
    if (value.trim() === '') fail(path, 'must not be empty')
    return
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be a string or a language object')
  const keys = Object.keys(value)
  if (keys.length === 0) fail(path, 'must not be empty')
  for (const key of keys) {
    if (!LANGUAGE_ID.test(key)) fail(`${path}.${key}`, 'must be keyed by a lowercase language id')
    if (typeof value[key] !== 'string' || value[key].trim() === '') fail(`${path}.${key}`, 'must be a non-empty string')
  }
  if (!Object.hasOwn(value, 'en')) fail(path, 'must contain en')
}

function validate(index) {
  if (index.format !== 1) fail('$.format', 'must be 1')
  checkLocalized(index.title, '$.title')
  if (index.description !== undefined) checkLocalized(index.description, '$.description')

  const categories = index.metadata?.categories ?? {}
  const labels = index.metadata?.labels ?? {}
  for (const [id, declaration] of Object.entries(categories)) {
    if (id === '') fail('$.metadata.categories', 'must not declare an empty id')
    checkLocalized(declaration.title, `$.metadata.categories.${id}.title`)
  }
  for (const [id, declaration] of Object.entries(labels)) {
    if (id === '') fail('$.metadata.labels', 'must not declare an empty id')
    checkLocalized(declaration.title, `$.metadata.labels.${id}.title`)
  }

  if (!Array.isArray(index.plugins)) fail('$.plugins', 'must be an array')
  const seen = new Set()
  index.plugins.forEach((plugin, position) => {
    const at = `$.plugins[${String(position)}]`
    if (typeof plugin.name !== 'string' || !PACKAGE_NAME.test(plugin.name)) fail(`${at}.name`, 'must be a valid npm package name')
    if (plugin.name.length > 214) fail(`${at}.name`, 'must not exceed 214 characters')
    if (seen.has(plugin.name)) fail(`${at}.name`, `duplicates ${plugin.name}`)
    seen.add(plugin.name)

    if (plugin.title !== undefined) checkLocalized(plugin.title, `${at}.title`)
    if (plugin.description !== undefined) checkLocalized(plugin.description, `${at}.description`)
    if (plugin.author !== undefined && (typeof plugin.author !== 'string' || plugin.author.trim() === '')) {
      fail(`${at}.author`, 'must be a non-empty string')
    }
    if (plugin.repository !== undefined) {
      const url = new URL(plugin.repository.url)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') fail(`${at}.repository.url`, 'must use https: or http:')
      if (url.search !== '' || url.hash !== '') fail(`${at}.repository.url`, 'must not contain a query or fragment')
    }

    const metadata = plugin.metadata ?? {}
    if (metadata.category !== undefined && !Object.hasOwn(categories, metadata.category)) {
      fail(`${at}.metadata.category`, `references undeclared id ${JSON.stringify(metadata.category)}`)
    }
    for (const [index2, label] of (metadata.labels ?? []).entries()) {
      if (!Object.hasOwn(labels, label)) fail(`${at}.metadata.labels[${String(index2)}]`, `references undeclared id ${JSON.stringify(label)}`)
    }
    if (new Set(metadata.labels ?? []).size !== (metadata.labels ?? []).length) fail(`${at}.metadata.labels`, 'must not repeat a label')

    if (!Array.isArray(plugin.versions) || plugin.versions.length === 0) fail(`${at}.versions`, 'must be a non-empty array')
    const versions = new Set()
    plugin.versions.forEach((version, position2) => {
      const vat = `${at}.versions[${String(position2)}]`
      if (typeof version.version !== 'string' || !SEMVER.test(version.version)) fail(`${vat}.version`, 'must be an exact SemVer version')
      if (versions.has(version.version)) fail(`${vat}.version`, `duplicates ${version.version}`)
      versions.add(version.version)
      if (!Number.isInteger(version.publishTimestamp) || version.publishTimestamp < 0 || version.publishTimestamp >= 1e11) {
        fail(`${vat}.publishTimestamp`, 'must be an integer number of Unix seconds in [0, 10^11)')
      }
      const source = version.source
      if (source?.type === 'git') {
        if (!COMMIT.test(source.commit)) fail(`${vat}.source.commit`, 'must be a lowercase 40-hex-digit commit SHA')
        const url = new URL(source.url)
        if (url.protocol !== 'https:') fail(`${vat}.source.url`, 'must use https:')
        if (url.href !== source.url) fail(`${vat}.source.url`, 'must be a canonical URL')
        if (url.search !== '' || url.hash !== '') fail(`${vat}.source.url`, 'must not contain a query or fragment')
        if (url.pathname.split('/').filter(Boolean).length < 2) fail(`${vat}.source.url`, 'must name a repository with at least two path segments')
      } else if (source?.type !== 'npm') {
        fail(`${vat}.source.type`, 'must be "npm" or "git"')
      }
    })
  })
  return index
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const { index: built, skipped } = buildIndex()
const index = validate(built)
const text = `${JSON.stringify(index, null, 2)}\n`
const skippedNote =
  skipped.length === 0 ? '' : `; skipped ${String(skipped.length)} submodule(s) without dsh.bundle: ${skipped.join(', ')}`

if (process.argv.includes('--check')) {
  let current
  try {
    current = readFileSync(OUTPUT, 'utf8')
  } catch {
    console.error(`index.json is missing; run: node tools/market-index.mjs`)
    process.exit(1)
  }
  if (current !== text) {
    console.error('index.json is stale; run: node tools/market-index.mjs')
    process.exit(1)
  }
  console.log(`index.json is up to date (${String(index.plugins.length)} plugins)${skippedNote}`)
} else {
  writeFileSync(OUTPUT, text)
  const rows = index.plugins.map((plugin) => {
    const version = plugin.versions[0]
    return `  ${plugin.name.padEnd(20)} ${version.version.padEnd(7)} ${version.source.commit.slice(0, 7)}  ${plugin.metadata.category}`
  })
  console.log(`wrote index.json (${String(index.plugins.length)} plugins, format 1)${skippedNote}`)
  console.log(rows.join('\n'))
}
