#!/usr/bin/env node
/**
 * CLI for the shared dependency directory.
 *
 *   node tools/shared-home.mjs status
 *   node tools/shared-home.mjs migrate            # 只报告，不动任何文件
 *   node tools/shared-home.mjs migrate --apply    # 真正搬进 ~/.dsh-plugins
 *
 * The JSON goes to stdout and the narrative to stderr, so `| ConvertFrom-Json` or `| jq` gets a
 * document and a human still sees what happened.
 *
 * @module dsh-plugins/tools/shared-home-cli
 */
import { migrateAll, statusReport, ASSETS } from './shared-home.mjs'

const args = process.argv.slice(2)
const command = args.find((argument) => !argument.startsWith('-')) ?? 'status'
const apply = args.includes('--apply')

/** Print the human half of the answer. */
function narrate(line) {
  process.stderr.write(`${line}\n`)
}

/** Pretty sizes, because 200 MB and 204800000 are the same fact and only one is readable. */
function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

if (command === 'status' || command === 'migrate') {
  const report = statusReport()
  narrate(`共享目录：${report.sharedRoot}${report.fromEnv ? '（来自 DSH_PLUGIN_HOME）' : ''}`)
  for (const asset of report.assets) {
    const legacy = asset.legacy.length === 0 ? '' : `；旧位置：${asset.legacy.map((entry) => `${entry.plugin}/${entry.directory.split(/[\\/]/).slice(-2).join('/')}`).join(', ')}`
    narrate(`  ${asset.targetPresent ? '✓' : '·'} ${asset.label} → ${asset.target}${legacy}`)
  }

  if (command === 'status') {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else {
    const result = await migrateAll({
      apply,
      onProgress: (line) => narrate(line),
    })
    for (const entry of result.results) {
      if (entry.action === 'planned') narrate(`计划迁移：${entry.from} → ${entry.target}（${mb(entry.bytes)}）`)
      else if (entry.action === 'moved') narrate(`已迁移：${entry.from} → ${entry.target}（${mb(entry.bytes)}）`)
      else narrate(`跳过：${entry.reason}`)
    }
    if (!apply) narrate('这是预演。加 --apply 才会真的搬。')
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  }
} else if (command === 'layout') {
  process.stdout.write(`${JSON.stringify({ sharedRoot: statusReport().sharedRoot, assets: ASSETS }, null, 2)}\n`)
} else {
  narrate(`用法：node tools/shared-home.mjs status|migrate [--apply]|layout`)
  process.exitCode = 2
}
