import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { loginAction } from '@/lib/actions/session'

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.headers.get('x-real-ip') || 'local'
}

function hashIp(ip: string) {
  const pepper = process.env.RATE_LIMIT_PEPPER || process.env.JWT_SECRET || 'dev-rate-limit-pepper'
  return createHash('sha256').update(`${pepper}:${ip}`).digest('hex')
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL no está configurada' }, { status: 500 })
  }

  const fd = await req.formData()
  fd.set('__ipHash', hashIp(getClientIp(req)))
  fd.set('__userAgent', req.headers.get('user-agent') || '')
  const result = await loginAction(fd)
  return NextResponse.json(result, { status: result.ok ? 200 : 401 })
}
