export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const Item = z.object({
  id: z.string().min(1).max(255),
  summary: z.string().min(1).max(500),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  meetLink: z.string().url().max(2_000).optional(),
  teacherEmail: z.string().email(),
})

const Payload = z.object({ events: z.array(Item).max(200) })

export async function POST(req: Request) {
  try {
    await requireRole(['ADMIN'])
    const body = Payload.parse(await req.json())

    for (const ev of body.events) {
      const user = await prisma.user.findUnique({ where: { email: ev.teacherEmail.toLowerCase() } })
      if (!user) continue
      const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } })
      if (!teacher) continue

      const startAt = new Date(ev.start)
      const endAt = new Date(ev.end)
      if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || startAt >= endAt) continue

      await prisma.classEvent.upsert({
        where: { googleEventId: ev.id },
        update: {
          title: ev.summary,
          startAt,
          endAt,
          meetUrl: ev.meetLink,
          teacherId: teacher.id,
        },
        create: {
          googleEventId: ev.id,
          title: ev.summary,
          startAt,
          endAt,
          meetUrl: ev.meetLink,
          teacherId: teacher.id,
        },
      })

      await prisma.calendarSyncEvent.create({ data: { source: 'google', eventId: ev.id, status: 'synced', payload: JSON.stringify(ev) } })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const invalidInput = error instanceof z.ZodError
    return NextResponse.json(
      { ok: false, error: invalidInput ? 'Los datos de sincronización no son válidos.' : 'No fue posible sincronizar el calendario.' },
      { status: invalidInput ? 400 : 500 }
    )
  }
}
