// Start a 测试升级 (test upgrade) job on member .3 through the same service code
// the panel button uses, wait for it, and print the job + log tail.
import { MeshService } from '/root/ws/dsh-plugins/dsh-mesh/src/lib/service.mjs'

const dataDir = '/root/.dsh/dsh-web-linux/data/home/mesh'
const member = process.argv[2] ?? '10.66.66.3'
const pkg = process.argv[3] ?? 'dsh-mesh-0.2.2-rc.3-linux-x64.tar.gz'
const service = new MeshService({ dataDir, config: {}, log: line => console.log(`[service] ${line}`) })
const started = await service.testUpgradeMember({ member, package: pkg })
console.log(`queued ${started.job.id} mode=${started.job.mode} steps=${started.job.steps.map(s => s.key).join(',')}`)
const job = await service.waitDeploy(started.job.id, { timeoutMs: 20 * 60 * 1000 })
console.log(JSON.stringify({
  id: job.id,
  mode: job.mode,
  status: job.status,
  phase: job.phase,
  error: job.error,
  release: job.release,
  steps: job.steps.map(step => ({ key: step.key, status: step.status, detail: step.detail })),
}, null, 2))
console.log('--- log tail ---')
console.log(await service.deployLogs(started.job.id, 60))
process.exit(job.status === 'succeeded' ? 0 : 1)
