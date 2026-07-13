import { NextResponse } from 'next/server'

import { activateAccessToken } from '@/lib/access'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await activateAccessToken({
      token: String(body.token || ''),
      email: String(body.email || ''),
      password: String(body.password || ''),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo activar el acceso.'
    const errors: Record<string, string> = {
      ACCESS_LINK_INVALID: 'El enlace no existe, ya fue usado o venció.',
      ACCESS_EMAIL_MISMATCH: 'El correo no coincide con esta invitación.',
      PASSWORD_TOO_SHORT: 'La contraseña debe tener mínimo 8 caracteres.',
    }
    return NextResponse.json({ error: errors[message] || 'No se pudo activar el acceso.' }, { status: 400 })
  }
}
