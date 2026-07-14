import { NextResponse } from 'next/server'

import { activateAccessToken, getValidAccessToken } from '@/lib/access'
import { getTrustedClientIp } from '@/lib/client-ip'
import { recordPortalAccessConsents } from '@/lib/legal-consent'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const token = String(body.token || '')
    const accessToken = await getValidAccessToken(token)
    if (!accessToken) throw new Error('ACCESS_LINK_INVALID')
    if (body.termsAccepted !== true || body.privacyAccepted !== true) throw new Error('LEGAL_CONSENT_REQUIRED')
    await activateAccessToken({
      token,
      email: String(body.email || ''),
      password: String(body.password || ''),
    })
    await recordPortalAccessConsents({
      userId: accessToken.userId,
      transcriptionAccepted: body.transcriptionAccepted === true,
      ip: getTrustedClientIp(request.headers),
      userAgent: request.headers.get('user-agent') || '',
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo activar el acceso.'
    const errors: Record<string, string> = {
      ACCESS_LINK_INVALID: 'El enlace no existe, ya fue usado o venció.',
      ACCESS_EMAIL_MISMATCH: 'El correo no coincide con esta invitación.',
      PASSWORD_TOO_SHORT: 'La contraseña debe tener mínimo 8 caracteres.',
      LEGAL_CONSENT_REQUIRED: 'Debes aceptar los términos y la política de privacidad para activar el acceso.',
    }
    return NextResponse.json({ error: errors[message] || 'No se pudo activar el acceso.' }, { status: 400 })
  }
}
