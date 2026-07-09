import { mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

function readEnvValue(key) {
  if (process.env[key]) return process.env[key]
  if (!existsSync('.env')) return ''
  const lines = readFileSync('.env', 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match || match[1] !== key) continue
    return match[2].trim().replace(/^"|"$/g, '')
  }
  return ''
}

const databaseUrl = readEnvValue('DATABASE_URL')
if (!databaseUrl) {
  console.error('DATABASE_URL is required for pg_dump backup')
  process.exit(1)
}

const outputDir = process.env.BACKUP_DIR || 'backups'
await mkdir(outputDir, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outputPath = path.join(outputDir, `teatime-pgdump-${timestamp}.sql`)

function runLocalPgDump() {
  return spawn('pg_dump', ['--no-owner', '--no-privileges', '--file', outputPath, databaseUrl], {
    stdio: 'inherit',
  })
}

function runDockerPgDump() {
  const url = new URL(databaseUrl)
  const container = process.env.BACKUP_DOCKER_CONTAINER || 'teatime-postgres'
  const user = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)
  const database = url.pathname.replace(/^\//, '')
  const output = createWriteStream(outputPath)
  const child = spawn(
    'docker',
    ['exec', '-e', `PGPASSWORD=${password}`, container, 'pg_dump', '--no-owner', '--no-privileges', '-U', user, '-d', database],
    { stdio: ['ignore', 'pipe', 'inherit'] }
  )
  child.stdout.pipe(output)
  return child
}

let child = runLocalPgDump()
let usedDockerFallback = false

child.on('error', (error) => {
  if (!usedDockerFallback && error.code === 'ENOENT') {
    usedDockerFallback = true
    console.warn('Local pg_dump not found. Trying Docker fallback with container teatime-postgres...')
    child = runDockerPgDump()
    attachHandlers(child)
    return
  }
  console.error(`Failed to run pg_dump: ${error.message}`)
  console.error('Install PostgreSQL client tools, set BACKUP_DOCKER_CONTAINER, or use npm run backup:json as a fallback.')
  process.exit(1)
})

function attachHandlers(processHandle) {
  processHandle.on('error', (error) => {
    console.error(`Failed to run backup command: ${error.message}`)
    console.error('Install PostgreSQL client tools, set BACKUP_DOCKER_CONTAINER, or use npm run backup:json as a fallback.')
    process.exit(1)
  })
  processHandle.on('close', (code) => {
    if (code !== 0) {
      console.error(`pg_dump exited with code ${code}`)
      process.exit(code || 1)
    }
    console.log(`Postgres dump exported: ${outputPath}`)
  })
}

child.on('close', (code) => {
  if (usedDockerFallback) return
  if (code !== 0) {
    console.error(`pg_dump exited with code ${code}`)
    process.exit(code || 1)
  }
  console.log(`Postgres dump exported: ${outputPath}`)
})
