import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function check(name: string, ok: boolean, detail: string) {
  return { name, ok, detail }
}

export async function GET() {
  const checks = []

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.push(check('database', true, 'Postgres reachable'))
  } catch {
    checks.push(check('database', false, 'Postgres is not reachable'))
  }

  checks.push(check('database_url', Boolean(process.env.DATABASE_URL), 'DATABASE_URL configured'))
  checks.push(
    check(
      'jwt_secret',
      Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET !== 'dev-secret-insecure' && process.env.JWT_SECRET.length >= 32),
      'JWT_SECRET should be set and at least 32 characters'
    )
  )
  checks.push(check('app_base_url', Boolean(process.env.APP_BASE_URL), 'APP_BASE_URL configured'))
  checks.push(
    check(
      'google_oauth',
      Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      'Google OAuth credentials configured'
    )
  )
  checks.push(
    check(
      'whatsapp',
      Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_TOKEN),
      'WhatsApp provider credentials configured'
    )
  )
  checks.push(
    check(
      'node_env',
      process.env.NODE_ENV === 'production',
      `NODE_ENV is ${process.env.NODE_ENV || 'undefined'}`
    )
  )

  const ok = checks.every((item) => item.ok)
  return NextResponse.json(
    {
      ok,
      service: 'teatime-ops',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  )
}
