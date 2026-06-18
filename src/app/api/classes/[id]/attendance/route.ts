import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const Body = z.object({
  studentId: z.string(),
  status: z.enum(['attended', 'absent', 'late', 'no_show']),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(['ADMIN', 'TEACHER'])
    const { studentId, status } = Body.parse(await req.json())

    const enrollment = await prisma.classEnrollment.findUnique({
      where: { classEventId_studentId: { classEventId: params.id, studentId } },
      include: { package: true }
    })
    if (!enrollment) return NextResponse.json({ ok: false, error: 'Matrícula inválida' }, { status: 404 })

    const previous = await prisma.attendanceRecord.findUnique({
      where: { classEventId_studentId: { classEventId: params.id, studentId } },
    })

    await prisma.attendanceRecord.upsert({
      where: { classEventId_studentId: { classEventId: params.id, studentId } },
      update: { status, markedBy: session.userId, markedAt: new Date() },
      create: { classEventId: params.id, studentId, status, markedBy: session.userId },
    })

    if (status === 'attended' && (!previous || previous.status !== 'attended')) {
      await prisma.hourPackage.update({
        where: { id: enrollment.package.id },
        data: { usedHours: { increment: 1 } },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
