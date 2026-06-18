import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { canCancel } from '@/lib/rules'

const Body = z.object({ reason: z.string().min(3) })

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(['ADMIN', 'TEACHER', 'STUDENT'])
    const { reason } = Body.parse(await req.json())

    const event = await prisma.classEvent.findUnique({ where: { id: params.id } })
    if (!event) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })

    const rule = await canCancel(event.startAt)
    await prisma.cancellation.create({
      data: {
        classEventId: params.id,
        requestedBy: session.userId,
        reason,
        wasAllowed: rule.allowed,
        graceHours: rule.graceHours,
      },
    })

    if (!rule.allowed) {
      return NextResponse.json({ ok: false, error: 'Cancelación fuera de plazo', allowed: false }, { status: 409 })
    }

    await prisma.classEvent.update({ where: { id: params.id }, data: { status: 'CANCELED' } })
    return NextResponse.json({ ok: true, allowed: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
