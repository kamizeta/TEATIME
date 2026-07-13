export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrStaffPermission } from '@/lib/staff-permissions'

function csvCell(value: string | number) {
  const normalized = String(value ?? '')
  return `"${normalized.replace(/"/g, '""')}"`
}

export async function GET() {
  await requireAdminOrStaffPermission('canCloseWeeks')
  const adjustments = await prisma.auditLog.findMany({
    where: { entityType: 'PACKAGE_LEDGER' },
    include: { actor: true },
    orderBy: { createdAt: 'desc' },
  })

  const enrollments = await prisma.classEnrollment.findMany({
    include: {
      student: { include: { user: true } },
      classEvent: {
        include: {
          cancellations: {
            orderBy: { requestTime: 'desc' },
            take: 1,
          },
        },
      },
      package: true,
    },
    orderBy: { classEvent: { startAt: 'desc' } },
  })

  const lines = [['date', 'package_id', 'student', 'movement_type', 'minutes', 'note', 'actor'].join(',')]

  for (const enrollment of enrollments) {
    if (enrollment.reservedMinutes > 0) {
      lines.push(
        [
          enrollment.classEvent.startAt.toISOString(),
          enrollment.packageId,
          enrollment.student.user.name,
          'RESERVE',
          enrollment.reservedMinutes,
          enrollment.classEvent.title,
          'system',
        ].map(csvCell).join(',')
      )
    }

    if (enrollment.consumedMinutes > 0) {
      lines.push(
        [
          enrollment.classEvent.startAt.toISOString(),
          enrollment.packageId,
          enrollment.student.user.name,
          'CONSUME',
          enrollment.consumedMinutes,
          enrollment.classEvent.title,
          'system',
        ].map(csvCell).join(',')
      )
    }

    if (enrollment.status === 'CANCELLED') {
      lines.push(
        [
          enrollment.classEvent.startAt.toISOString(),
          enrollment.packageId,
          enrollment.student.user.name,
          'RELEASE',
          enrollment.classEvent.durationMinutes || 60,
          enrollment.classEvent.cancellations[0]?.reason || 'Cancelación operativa',
          'system',
        ].map(csvCell).join(',')
      )
    }
  }

  for (const adjustment of adjustments) {
    const after = adjustment.after ? JSON.parse(adjustment.after) : {}
    lines.push(
      [
        adjustment.createdAt.toISOString(),
        adjustment.entityId,
        'manual',
        'ADJUST',
        Number(after.deltaMinutes || 0),
        String(after.note || adjustment.action),
        adjustment.actor.name,
      ].map(csvCell).join(',')
    )
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="reporte_ledger_paquetes.csv"',
    },
  })
}
