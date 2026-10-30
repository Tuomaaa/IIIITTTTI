#!/usr/bin/env -S npx tsx
// Agent-facing CLI for data/plan.json. Run `npm run plan -- help`.
// The commands live in src/core/commands.ts so the MCP endpoint runs the same code.
import { readFileSync, writeFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020.js'
import { CmdError, parseArgv, runCommand } from '../src/core/commands.ts'
import { formatJSON } from '../src/core/format.ts'
import type { Plan } from '../src/core/types.ts'

// `npm run plan -- summary | head` should not crash.
process.stdout.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EPIPE') process.exit(0)
  throw e
})

function die(msg: string): never {
  console.error(`✕ ${msg}`)
  process.exit(1)
}

function schemaIssues(p: Plan): string[] {
  const schema = JSON.parse(readFileSync(new URL('../data/schema.json', import.meta.url), 'utf8'))
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  const validate = ajv.compile(schema)
  if (validate(p)) return []
  return (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}${e.params && 'additionalProperty' in e.params ? `：${e.params.additionalProperty}` : ''}`)
}

const argv = process.argv.slice(2)
try {
  const file = parseArgv(argv).opt.file ?? 'data/plan.json'
  let plan: Plan
  try {
    plan = JSON.parse(readFileSync(file, 'utf8')) as Plan
  } catch (e) {
    die(`读不了 ${file}：${e instanceof Error ? e.message : e}`)
  }
  const res = runCommand(plan, argv, { schemaIssues })
  for (const w of res.warn) console.warn(`⚠ ${w}`)
  for (const e of res.errors) console.error(`✕ ${e}`)
  if (res.errors.length) process.exit(1)
  if (res.out.length) console.log(res.out.join('\n'))
  if (res.next) {
    if (res.opt.dry) console.log(`（--dry）会执行：${res.what}`)
    else {
      writeFileSync(file, formatJSON(res.next))
      console.log(`✓ ${res.what}`)
    }
  }
} catch (e) {
  if (e instanceof CmdError) die(e.message)
  throw e
}
