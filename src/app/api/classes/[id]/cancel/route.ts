export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { requestCancellation } from '@/lib/cancellations'

const Body = z.object({
  reason: z.string().min(3),
  scope: z.enum(['SELF', 'CLASS']).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(['ADMIN', 'STAFF', 'TEACHER', 'STUDENT'])
    const { id } = await params
    const { reason, scope } = Body.parse(await req.json())

    const result = await requestCancellation({
      classId: id,
      userId: session.userId,
      role: session.role,
      reason,
      scope: scope || (session.role === 'STUDENT' ? 'SELF' : 'CLASS'),
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cancelación fuera de plazo. Mínimo ${result.minimumNoticeHours} horas.`,
          allowed: false,
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ ok: true, allowed: true, alreadyCanceled: result.alreadyCanceled, overrideUsed: result.overrideUsed })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Indica un motivo de al menos 3 caracteres.' }, { status: 400 })
    }
    const code = error instanceof Error ? error.message : ''
    const status = code === 'CLASS_NOT_FOUND' ? 404 : code === 'UNAUTHORIZED' ? 401 : 500
    const message = code === 'CLASS_NOT_FOUND'
      ? 'Clase no encontrada.'
      : code === 'UNAUTHORIZED'
        ? 'No autorizado.'
        : 'No fue posible cancelar la clase.'
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
