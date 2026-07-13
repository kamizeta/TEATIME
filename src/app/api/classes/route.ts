export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export async function GET(req: Request) {
  try {
  const session = await requireRole(['ADMIN', 'STAFF', 'TEACHER', 'STUDENT'])
  const q = new URL(req.url).searchParams
  const from = q.get('from')
  const to = q.get('to')

  const startFilters: Record<string, Date> = {}
  if (from) startFilters.gte = new Date(from)
  if (to) startFilters.lte = new Date(to)

  const accessFilter = session.role === 'TEACHER'
    ? { teacher: { userId: session.userId } }
    : session.role === 'STUDENT'
      ? { enrollments: { some: { student: { userId: session.userId } } } }
      : {}
  const enrollmentWhere = session.role === 'STUDENT' ? { student: { userId: session.userId } } : undefined
  const events = await prisma.classEvent.findMany({
    where: { ...accessFilter, ...(Object.keys(startFilters).length ? { startAt: startFilters } : {}) },
    include: {
      teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
      enrollments: {
        where: enrollmentWhere,
        include: { student: { include: { user: { select: { id: true, name: true, email: true } } } }, attendance: true },
      },
    },
    orderBy: { startAt: 'asc' },
  })

  return NextResponse.json({ ok: true, events })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: error.message === 'UNAUTHORIZED' ? 401 : 500 })
  }
}
