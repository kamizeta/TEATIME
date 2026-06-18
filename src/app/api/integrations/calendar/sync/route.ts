export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const Item = z.object({
  id: z.string(),
  summary: z.string(),
  start: z.string(),
  end: z.string(),
  meetLink: z.string().optional(),
  teacherEmail: z.string().email(),
})

const Payload = z.object({ events: z.array(Item) })

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
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
