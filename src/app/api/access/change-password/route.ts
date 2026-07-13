import { NextResponse } from 'next/server'

import { hashPassword, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await requireRole(['ADMIN', 'STAFF', 'TEACHER', 'STUDENT'])
    const body = await request.json()
    const password = String(body.password || '')
    if (password.length < 8) return NextResponse.json({ error: 'La contraseña debe tener mínimo 8 caracteres.' }, { status: 400 })
    await prisma.user.update({
      where: { id: session.userId },
      data: { password: await hashPassword(password), forcePasswordChange: false, passwordExpiresAt: null },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'No tienes una sesión válida.' }, { status: 401 })
  }
}
