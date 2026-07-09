export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function csvCell(value: string | number) {
  const normalized = String(value ?? '')
  return `"${normalized.replace(/"/g, '""')}"`
}

export async function GET() {
  const rows = await prisma.classEnrollment.findMany({
    include: {
      student: { include: { user: true } },
      classEvent: {
        include: {
          teacher: { include: { user: true } },
          cancellations: true,
        },
      },
      package: true,
      attendance: true,
    },
    orderBy: { classEvent: { startAt: 'desc' } },
  })

  const lines = [[
    'class_id',
    'class_title',
    'teacher',
    'student',
    'student_code',
    'start_at',
    'class_status',
    'attendance_status',
    'reserved_minutes',
    'consumed_minutes',
    'package_used_minutes',
    'package_total_minutes',
    'meet_url',
    'cancellation_count',
  ].join(',')]

  for (const row of rows) {
    lines.push(
      [
        row.classEvent.id,
        row.classEvent.title,
        row.classEvent.teacher.user.name,
        row.student.user.name,
        row.student.studentCode,
        new Date(row.classEvent.startAt).toISOString(),
        row.classEvent.status,
        row.attendance?.status || 'pending',
        row.reservedMinutes,
        row.consumedMinutes,
        row.package.usedMinutes,
        row.package.totalMinutes,
        row.classEvent.meetUrl || '',
        row.classEvent.cancellations.length,
      ].map(csvCell).join(',')
    )
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="reporte_asistencia_operativo.csv"',
    },
  })
}
