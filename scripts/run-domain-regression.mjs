import { execFileSync } from 'child_process'
import { randomBytes } from 'crypto'
import { PrismaClient } from '@prisma/client'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv
const root = process.cwd()
loadEnvConfig(root)

const originalUrl = process.env.DATABASE_URL
if (!originalUrl) throw new Error('DATABASE_URL_MISSING')

const databaseName = `teatime_test_${randomBytes(6).toString('hex')}`
const testUrl = new URL(originalUrl)
testUrl.pathname = `/${databaseName}`
const adminUrl = new URL(originalUrl)
adminUrl.pathname = '/postgres'
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } })

function run(command, args, env = {}) {
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl.toString(), GOOGLE_DRY_RUN: 'true', ...env },
  })
}

try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`)
  run('npx', ['prisma', 'migrate', 'deploy'])
  run('./node_modules/.bin/tsx', ['scripts/domain-regression.mts'])
  console.log(`Prueba de dominio completada en ${databaseName}`)
} finally {
  await admin.$disconnect()
  const cleanup = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } })
  try {
    await cleanup.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
  } finally {
    await cleanup.$disconnect()
  }
}
