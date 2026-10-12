// Records one Qualified Model Configuration candidate on the live dataset:
//   pnpm test:evaluation:record <candidate>
// The candidates are declared in src/model-evaluation/model-configurations.ts; the provider key comes from the local
// environment only.
import { spawnSync } from 'node:child_process'

const candidate = process.argv[2]
if (candidate === undefined || candidate.startsWith('-')) {
  process.stderr.write('Usage: pnpm test:evaluation:record <candidate>, such as openai-structured or openai-writing\n')
  process.exit(1)
}

const result = spawnSync('vitest', ['run', '--maxWorkers=1', '--reporter=verbose',
  'src/model-evaluation/model-qualification-recording.evaluation.test.ts'], {
  env: { ...process.env, MODEL_QUALIFICATION_CANDIDATE: candidate },
  shell: process.platform === 'win32',
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
