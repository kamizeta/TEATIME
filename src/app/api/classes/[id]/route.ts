export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(['ADMIN', 'STAFF', 'TEACHER', 'STUDENT'])
    const accessFilter = session.role === 'TEACHER'
      ? { teacher: { userId: session.userId } }
      : session.role === 'STUDENT'
        ? { enrollments: { some: { student: { userId: session.userId } } } }
        : {}
    const enrollmentWhere = session.role === 'STUDENT' ? { student: { userId: session.userId } } : undefined
    const event = await prisma.classEvent.findFirst({
      where: { id: params.id, ...accessFilter },
      include: {
        teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
        enrollments: {
          where: enrollmentWhere,
          include: {
            student: { include: { user: { select: { id: true, name: true, email: true } } } },
            package: true,
            attendance: true,
          },
        },
      },
    })

    if (!event) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true, event })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: error.message === 'UNAUTHORIZED' ? 401 : 500 })
  }
}
