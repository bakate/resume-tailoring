import { execFile } from 'node:child_process'

import type { MemoryMeasurementResult } from './pdf-capacity-benchmark'

type ProcessMemoryRow = Readonly<{
  parentProcessId: number
  processId: number
  residentMemoryKilobytes: number
}>

export async function readProcessTreeResidentMemoryBytes(): Promise<MemoryMeasurementResult> {
  const processTable = await readProcessTable()
  if (!processTable.ok) return memoryMeasurementUnavailableResult
  const parsedTable = parseProcessTable({ processTable: processTable.value })
  if (!parsedTable.ok) return parsedTable
  const processIds = findDescendantProcessIds({ rootProcessId: process.pid, rows: parsedTable.value })
  const residentMemoryKilobytes = parsedTable.value
    .filter(({ processId }) => processIds.has(processId))
    .reduce((totalKilobytes, row) => totalKilobytes + row.residentMemoryKilobytes, 0)
  return { ok: true, value: residentMemoryKilobytes * 1_024 }
}

function readProcessTable(): Promise<
  Readonly<{ ok: true; value: string }> | Readonly<{ ok: false }>
> {
  return new Promise((resolve) => {
    execFile('ps', ['-axo', 'pid=,ppid=,rss='], { maxBuffer: 4 * 1_024 * 1_024 }, (error, stdout) => {
      resolve(error === null ? { ok: true, value: stdout } : { ok: false })
    })
  })
}

function parseProcessTable({ processTable }: Readonly<{ processTable: string }>) {
  const rows: ProcessMemoryRow[] = []
  for (const line of processTable.split('\n')) {
    if (line.trim() === '') continue
    const values = line.trim().split(/\s+/u).map(Number)
    const [processId, parentProcessId, residentMemoryKilobytes] = values
    if (values.length !== 3 || !values.every(Number.isFinite)) {
      return memoryMeasurementUnavailableResult
    }
    rows.push({ parentProcessId, processId, residentMemoryKilobytes } as ProcessMemoryRow)
  }
  return { ok: true, value: rows } as const
}

const memoryMeasurementUnavailableResult = {
  ok: false,
  error: { type: 'memory-measurement-unavailable' },
} as const satisfies MemoryMeasurementResult

function findDescendantProcessIds({ rootProcessId, rows }: Readonly<{
  rootProcessId: number
  rows: readonly ProcessMemoryRow[]
}>) {
  const processIds = new Set([rootProcessId])
  let previousProcessCount = 0
  while (previousProcessCount !== processIds.size) {
    previousProcessCount = processIds.size
    for (const row of rows) {
      if (processIds.has(row.parentProcessId)) processIds.add(row.processId)
    }
  }
  return processIds
}
