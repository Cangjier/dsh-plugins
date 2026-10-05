/**
 * One entry point for the shared dependency directory every plugin in this family uses.
 *
 * The plugins resolve `~/.dsh-plugins` on their own — this script does not sit in their code
 * path, because a plugin installed on its own must not need a checkout of this repository to find
 * its own binaries. What it is for is the two jobs that are about the *machine* rather than about
 * a plugin:
 *
 *   - `status`  say what is in the shared home right now, and which plugin's `vendor/` still holds
 *               a legacy copy that the shared home would now shadow;
 *   - `migrate` move those legacy copies into the shared home (a move, not a copy — the whole
 *               point is to stop paying for the same 200 MB twice), verify each file's SHA-256 on
 *               the way, and leave a `SOURCE.json` recording where it came from.
 *
 * Usage:
 *   node tools/shared-home.mjs status
 *   node tools/shared-home.mjs migrate            # report only
 *   node tools/shared-home.mjs migrate --apply    # actually move
 *
 * `DSH_PLUGIN_HOME` selects a different root, exactly as it does for the plugins.
 *
 * @module dsh-plugins/tools/shared-home
 */
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/** The repository root: the directory holding every plugin checkout. */
export const REPO_ROOT = resolve(HERE, '..')

/** Environment variable that overrides the shared root. */
export const HOME_ENV = 'DSH_PLUGIN_HOME'

/** The directory name shared by every plugin in this family. */
export const HOME_DIR_NAME = '.dsh-plugins'

/** The shared root, resolved from the environment or the home directory. */
export const SHARED_ROOT = resolve(
  process.env[HOME_ENV]?.trim() ? process.env[HOME_ENV].trim() : join(homedir(), HOME_DIR_NAME),
)

/** Every plugin checkout this repository knows about, in the order reports list them. */
export const PLUGINS = [
  'dsh-ffmpeg',
  'dsh-video-audio',
  'video-factory',
  'dsh-ocr',
  'dsh-tts',
  'dsh-computer-use',
]

/**
 * What a legacy copy is, where it belongs, and which plugin owns it.
 *
 * `owner` matters for the same reason it does in the plugins: a file in the shared home is a
 * *shared* file, and an install must not delete a directory another plugin's model lives in.
 *
 * `target` is the shared-home directory the asset moves to, and `include` lists the sub-entries
 * that are part of the asset — a scratch directory (`extract/`, `.download/`) is not, and would
 * otherwise be installed as if it were.
 */
export const ASSETS = [
  {
    id: 'ffmpeg',
    label: 'ffmpeg 静态构建（ffmpeg.exe / ffprobe.exe / ffplay.exe）',
    owner: 'dsh-ffmpeg',
    source: 'vendor/ffmpeg',
    target: 'ffmpeg',
    include: ['bin'],
  },
  {
    id: 'ocr',
    label: '离线 OCR 引擎',
    owner: 'dsh-ocr',
    source: 'vendor/ocr',
    target: 'ocr',
    include: ['.'],
  },
  {
    id: 'yamnet',
    label: 'YAMNet 模型',
    owner: 'dsh-video-audio',
    source: 'vendor/audio',
    target: 'models/yamnet',
    // The model files sit at the root of the shared directory, not under a `yamnet/` subdirectory:
    // that one level is what the legacy tree used to separate the model from the runtime beside it.
    include: ['yamnet/yamnet.onnx', 'yamnet/yamnet_class_map.csv', 'SOURCE.json'],
    flatten: 'yamnet',
  },
  {
    id: 'onnxruntime',
    label: 'ONNX WASM 运行时（抠像与音频事件共用）',
    owner: 'dsh-video-audio',
    source: 'vendor/audio',
    target: 'lib/onnxruntime-web',
    // npm's own shape is preserved — `node_modules/<pkg>` — because the WASM entry point imports
    // flatbuffers / long / protobufjs by bare specifier and Node resolves those by walking up.
    include: ['runtime/node_modules'],
    flatten: 'runtime',
  },
  {
    id: 'matte',
    label: 'U²-Net 抠像模型',
    owner: 'video-factory',
    source: 'vendor/matte',
    target: 'models/u2netp',
    include: ['.'],
  },
]

/** Raised when a migration step cannot be completed safely. */
export class SharedHomeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SharedHomeError'
  }
}

/**
 * SHA-256 of a file.
 * @param {string} path - the file.
 * @returns {Promise<string>} lowercase hex digest.
 */
export async function sha256Of(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

/**
 * Every file below a directory, as paths relative to it.
 * @param {string} directory - the directory to walk.
 * @returns {string[]} relative file paths with forward slashes.
 */
function walkFiles(directory) {
  const out = []
  const walk = (current) => {
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push(relative(directory, full).split('\\').join('/'))
    }
  }
  walk(directory)
  return out
}

/**
 * What one asset looks like right now: in the shared home, and in any plugin's `vendor/`.
 *
 * @param {object} asset - one entry of {@link ASSETS}.
 * @returns {{id: string, label: string, owner: string, target: string, targetPresent: boolean, targetFiles: string[], legacy: {plugin: string, directory: string, files: string[], bytes: number}[]}} the state.
 */
export function assetState(asset) {
  const target = join(SHARED_ROOT, ...asset.target.split('/'))
  const targetFiles = existsSync(target) ? walkFiles(target).filter((file) => file !== 'SOURCE.json') : []

  const legacy = []
  for (const plugin of PLUGINS) {
    const directory = join(REPO_ROOT, plugin, ...asset.source.split('/'))
    if (!existsSync(directory)) continue
    const files = walkFiles(directory)
    if (files.length === 0) continue
    let bytes = 0
    for (const file of files) {
      try {
        bytes += statSync(join(directory, file)).size
      } catch {
        // A file that vanished mid-listing simply does not count.
      }
    }
    legacy.push({ plugin, directory, files, bytes })
  }

  return {
    id: asset.id,
    label: asset.label,
    owner: asset.owner,
    target,
    targetPresent: targetFiles.length > 0,
    targetFiles,
    legacy,
  }
}

/**
 * The whole shared home as a report.
 * @returns {{sharedRoot: string, fromEnv: boolean, assets: object[]}} the state.
 */
export function sharedHomeState() {
  return {
    sharedRoot: SHARED_ROOT,
    fromEnv: typeof process.env[HOME_ENV] === 'string' && process.env[HOME_ENV].trim() !== '',
    assets: ASSETS.map(assetState),
  }
}

/**
 * Move one legacy copy into the shared home, hashing every file before it is trusted.
 *
 * A file is copied, verified, and only then is the source removed: a move that fails midway must
 * leave the machine working, and a half-moved 200 MB binary is worse than either end state.
 *
 * @param {object} options - `{ asset, legacy, apply, onProgress }`.
 * @returns {Promise<object>} what happened.
 * @throws {SharedHomeError} when the destination already holds a different asset.
 */
export async function migrateAsset(options) {
  const { asset, legacy } = options
  const apply = options.apply === true
  const onProgress = options.onProgress ?? (() => {})

  const target = join(SHARED_ROOT, ...asset.target.split('/'))
  const already = existsSync(target) ? walkFiles(target).filter((file) => file !== 'SOURCE.json') : []
  if (already.length > 0) {
    return {
      id: asset.id,
      action: 'skipped',
      reason: `${target} 已经有 ${already.length} 个文件，不覆盖。要重装请用插件自己的安装动作。`,
      target,
    }
  }

  // Only the wanted subtrees are carried; a scratch directory (`extract/`, `.download/`) is not
  // part of the asset and would otherwise be installed as if it were. `flatten` drops one leading
  // segment, which is how a legacy `yamnet/yamnet.onnx` becomes a shared `yamnet.onnx`.
  const flatten = asset.flatten ?? null
  const wanted = []
  for (const entry of asset.include) {
    const from = entry === '.' ? legacy.directory : join(legacy.directory, ...entry.split('/'))
    if (!existsSync(from)) continue
    // The destination stem for this entry: the entry itself, minus the flattened segment when it
    // has one. `runtime/node_modules` therefore lands as `node_modules`, which is what a resolver
    // handed the shared runtime directory expects to walk into.
    const stem = flatten !== null && entry.startsWith(`${flatten}/`) ? entry.slice(flatten.length + 1) : entry
    if (statSync(from).isDirectory()) {
      for (const file of walkFiles(from)) {
        wanted.push({ from: join(from, file), tail: stem === '' ? file : `${stem}/${file}` })
      }
    } else {
      wanted.push({ from, tail: stem })
    }
  }
  if (wanted.length === 0) return { id: asset.id, action: 'skipped', reason: '没有可迁移的文件。', target }

  const hashes = []
  let bytes = 0
  for (const item of wanted) {
    const digest = await sha256Of(item.from)
    const size = statSync(item.from).size
    bytes += size
    hashes.push({ path: item.tail, bytes: size, sha256: digest })
    onProgress(`  校验 ${item.tail}（${(size / 1024 / 1024).toFixed(1)} MB）`)
  }

  if (!apply) return { id: asset.id, action: 'planned', from: legacy.directory, target, files: hashes, bytes }

  for (const item of wanted) {
    const to = join(target, item.tail)
    mkdirSync(dirname(to), { recursive: true })
    cpSync(item.from, to)
    // Verified again at the destination: the copy is what will be executed, so the copy is what
    // has to match the hash, not the file that was read.
    const actual = await sha256Of(to)
    const expected = hashes.find((entry) => entry.path === item.tail)
    if (expected !== undefined && actual !== expected.sha256) {
      throw new SharedHomeError(`复制到 ${to} 后摘要不符（期望 ${expected.sha256}，实得 ${actual}）；源文件保持不动。`)
    }
  }

  const record = {
    migratedFrom: legacy.directory,
    sourcePlugin: legacy.plugin,
    owner: asset.owner,
    files: hashes,
    migratedAt: new Date().toISOString(),
    note: '从插件 vendor/ 迁入共享目录；内容未变，摘要逐文件复核过。',
  }
  writeFileSync(join(target, 'SOURCE.json'), `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8' })

  rmSync(legacy.directory, { recursive: true, force: true })
  // The plugin's `vendor/` is only removed when nothing else in it survives — `vendor/` is a
  // directory a user may also have put something else in.
  const vendorRoot = dirname(legacy.directory)
  try {
    if (readdirSync(vendorRoot).length === 0) rmSync(vendorRoot, { recursive: true, force: true })
  } catch {
    // Leaving an empty directory behind is not a failure.
  }

  return { id: asset.id, action: 'moved', from: legacy.directory, target, files: hashes, bytes }
}

/**
 * Run `status`.
 * @returns {object} the report.
 */
export function statusReport() {
  const state = sharedHomeState()
  return {
    ...state,
    present: state.assets.filter((asset) => asset.targetPresent).map((asset) => asset.id),
    legacyCopies: state.assets.flatMap((asset) =>
      asset.legacy.map((entry) => ({ asset: asset.id, plugin: entry.plugin, directory: entry.directory, bytes: entry.bytes })),
    ),
  }
}

/**
 * Run `migrate` over every asset that has a legacy copy.
 * @param {{apply?: boolean, onProgress?: (line: string) => void}} [options] - `apply` moves; without it nothing changes.
 * @returns {Promise<object>} the report.
 */
export async function migrateAll(options = {}) {
  const onProgress = options.onProgress ?? (() => {})
  const results = []
  for (const asset of ASSETS) {
    const state = assetState(asset)
    for (const legacy of state.legacy) {
      onProgress(`${asset.label}：${legacy.plugin}/${asset.source} → ${state.target}`)
      results.push(await migrateAsset({ asset, legacy, apply: options.apply, onProgress }))
    }
  }
  return { applied: options.apply === true, results, state: sharedHomeState() }
}
