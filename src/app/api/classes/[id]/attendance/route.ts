export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const Body = z.object({
  studentId: z.string(),
  status: z.enum(['attended', 'absent', 'late', 'no_show']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(['ADMIN', 'TEACHER'])
    const { id } = await params
    const { studentId, status } = Body.parse(await req.json())

    const classEvent = await prisma.classEvent.findUnique({
      where: { id },
      include: { teacher: true },
    })
    if (!classEvent) return NextResponse.json({ ok: false, error: 'Clase no encontrada' }, { status: 404 })
    if (session.role === 'TEACHER' && classEvent.teacher.userId !== session.userId) {
      return NextResponse.json({ ok: false, error: 'No puedes registrar asistencia de otra profesora o profesor.' }, { status: 403 })
    }
    if (classEvent.status === 'CANCELED' || classEvent.status === 'COMPLETED') {
      return NextResponse.json({ ok: false, error: 'La asistencia de esta clase ya no se puede modificar.' }, { status: 409 })
    }

    const enrollment = await prisma.classEnrollment.findUnique({
      where: { classEventId_studentId: { classEventId: id, studentId } },
      include: { package: true }
    })
    if (!enrollment) return NextResponse.json({ ok: false, error: 'Matrícula inválida' }, { status: 404 })

    await prisma.attendanceRecord.upsert({
      where: { classEventId_studentId: { classEventId: id, studentId } },
      update: { status, markedBy: session.userId, markedAt: new Date() },
      create: { classEventId: id, studentId, status, markedBy: session.userId },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: e.message === 'UNAUTHORIZED' ? 401 : 500 })
  }
}
