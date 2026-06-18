import { NextResponse } from 'next/server'
import { loginAction } from '@/lib/actions/session'

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL no está configurada' }, { status: 500 })
  }

  const fd = await req.formData()
  const result = await loginAction(fd)
  return NextResponse.json(result, { status: result.ok ? 200 : 401 })
}
