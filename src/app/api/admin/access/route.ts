import { NextResponse } from 'next/server'

import { AccessTokenPurpose } from '@prisma/client'

import { generateTemporaryPassword, issueUserAccessLink } from '@/lib/access'
import { requireRole } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await requireRole(['ADMIN'])
    const body = await request.json()
    const userId = String(body.userId || '')
    const action = String(body.action || '')
    if (!userId || !['invite', 'copy', 'reset', 'temporary'].includes(action)) {
      return NextResponse.json({ error: 'Solicitud de acceso inválida.' }, { status: 400 })
    }

    if (action === 'temporary') {
      const result = await generateTemporaryPassword(userId, session.userId)
      return NextResponse.json(result)
    }

    const purpose = action === 'reset' ? AccessTokenPurpose.RESET : AccessTokenPurpose.INVITATION
    const result = await issueUserAccessLink({
      userId,
      createdById: session.userId,
      purpose,
      sendEmail: action !== 'copy',
    })
    return NextResponse.json(result)
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const knownErrors: Record<string, string> = {
      USER_NOT_FOUND: 'La persona no existe.',
      USER_NOT_ELIGIBLE: 'Solo se puede gestionar acceso de alumnos o profesores.',
      UNAUTHORIZED: 'No autorizado.',
    }
    return NextResponse.json({ error: knownErrors[code] || 'No se pudo gestionar el acceso.' }, { status: code === 'UNAUTHORIZED' ? 401 : 400 })
  }
}
