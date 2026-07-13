import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrStaffPermission } from '@/lib/staff-permissions'
import { prisma } from '@/lib/prisma'

function getWeekBounds(raw?: string | null) {
  const base = raw ? new Date(`${raw}T00:00:00`) : new Date()
  const day = base.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const weekStart = new Date(base)
  weekStart.setDate(base.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return { weekStart, weekEnd }
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  await requireAdminOrStaffPermission('canCloseWeeks')
  const { searchParams } = new URL(request.url)
  const { weekStart, weekEnd } = getWeekBounds(searchParams.get('week'))

  const classes = await prisma.classEvent.findMany({
    where: { startAt: { gte: weekStart, lte: weekEnd } },
    include: {
      teacher: { include: { user: true } },
      instructorAttendance: true,
      enrollments: { include: { student: { include: { user: true } }, attendance: true } },
      cancellations: true,
    },
    orderBy: { startAt: 'asc' },
  })

  const rows = [
    ['class_id', 'title', 'teacher', 'students', 'start_at', 'status', 'teacher_marked', 'missing_students', 'late_cancellations'],
    ...classes.map((classEvent) => [
      classEvent.id,
      classEvent.title,
      classEvent.teacher.user.name,
      classEvent.enrollments.map((item) => item.student.user.name).join('; '),
      classEvent.startAt.toISOString(),
      classEvent.status,
      classEvent.instructorAttendance ? 'yes' : 'no',
      classEvent.enrollments.filter((item) => item.status === 'CONFIRMED' && !item.attendance).length,
      classEvent.cancellations.filter((item) => !item.wasAllowed).length,
    ]),
  ]

  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="teatime-weekly-closing-${weekStart.toISOString().slice(0, 10)}.csv"`,
    },
  })
}
