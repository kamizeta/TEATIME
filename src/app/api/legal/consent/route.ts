import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'
import { recordPortalAccessConsents } from '@/lib/legal-consent'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { transcriptionAccepted?: boolean }
  await recordPortalAccessConsents({
    userId: session.userId,
    transcriptionAccepted: body.transcriptionAccepted === true,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
    userAgent: request.headers.get('user-agent') || '',
  })
  return NextResponse.json({ ok: true, message: 'Tu consentimiento fue actualizado.' })
}
