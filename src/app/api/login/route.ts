import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { loginAction } from '@/lib/actions/session'
import { getTrustedClientIp } from '@/lib/client-ip'

function hashIp(ip: string) {
  const pepper = process.env.RATE_LIMIT_PEPPER || process.env.JWT_SECRET || 'dev-rate-limit-pepper'
  return createHash('sha256').update(`${pepper}:${ip}`).digest('hex')
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'El acceso no está disponible temporalmente.' }, { status: 503 })
  }

  try {
    const fd = await req.formData()
    fd.set('__ipHash', hashIp(getTrustedClientIp(req.headers)))
    fd.set('__userAgent', req.headers.get('user-agent') || '')
    const result = await loginAction(fd)
    return NextResponse.json(result, { status: result.ok ? 200 : 401 })
  } catch {
    return NextResponse.json({ ok: false, error: 'No fue posible procesar el acceso.' }, { status: 400 })
  }
}
