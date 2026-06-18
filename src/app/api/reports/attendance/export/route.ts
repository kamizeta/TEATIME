export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const rows = await prisma.classEnrollment.findMany({
    include: {
      student: { include: { user: true } },
      classEvent: true,
      package: true,
      attendance: true,
    },
  })

  const lines = ['class_id,student,student_code,fecha,status,package_used,package_total,meet']
  for (const r of rows) {
    lines.push([
      r.classEvent.id,
      r.student.user.name,
      r.student.studentCode,
      new Date(r.classEvent.startAt).toISOString(),
      r.attendance?.status || 'pending',
      String(r.package.usedHours),
      String(r.package.totalHours),
      r.classEvent.meetUrl || '',
    ].join(','))
  }

  return new NextResponse(lines.join('\n'), {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="reporte_asistencia.csv"' },
  })
}
