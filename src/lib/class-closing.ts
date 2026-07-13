import { prisma } from '@/lib/prisma'
import { buildLedgerConsumeUpdate, buildLedgerReleaseUpdate, shouldConsumeAttendance } from '@/lib/package-ledger'

export async function settleClassLedger(classId: string) {
  const classEvent = await prisma.classEvent.findUnique({
    where: { id: classId },
    include: {
      enrollments: {
        include: {
          attendance: true,
          package: true,
        },
      },
    },
  })

  if (!classEvent) throw new Error('CLASS_NOT_FOUND')
  if (classEvent.status === 'COMPLETED') throw new Error('CLASS_ALREADY_CLOSED')
  if (classEvent.status === 'CANCELED') throw new Error('CLASS_CANCELED')
  if (classEvent.endAt.getTime() > Date.now()) throw new Error('CLASS_NOT_FINISHED')

  const confirmedEnrollments = classEvent.enrollments.filter((enrollment) => enrollment.status === 'CONFIRMED')
  if (confirmedEnrollments.some((enrollment) => !enrollment.attendance)) throw new Error('MISSING_ATTENDANCE')

  await prisma.$transaction(async (tx) => {
    for (const enrollment of confirmedEnrollments) {
      const reservedMinutes = enrollment.reservedMinutes
      const attendanceStatus = enrollment.attendance?.status
      if (reservedMinutes <= 0) continue

      if (attendanceStatus && shouldConsumeAttendance(attendanceStatus)) {
        await tx.hourPackage.update({
          where: { id: enrollment.packageId },
          data: buildLedgerConsumeUpdate(reservedMinutes),
        })
        await tx.classEnrollment.update({
          where: { id: enrollment.id },
          data: {
            consumedMinutes: reservedMinutes,
            consumedHours: Math.ceil(reservedMinutes / 60),
            reservedMinutes: 0,
            reservedHours: 0,
          },
        })
      } else {
        await tx.hourPackage.update({
          where: { id: enrollment.packageId },
          data: buildLedgerReleaseUpdate(reservedMinutes),
        })
        await tx.classEnrollment.update({
          where: { id: enrollment.id },
          data: { reservedMinutes: 0, reservedHours: 0 },
        })
      }
    }

    await tx.classEvent.update({ where: { id: classId }, data: { status: 'COMPLETED' } })
  })

  return { classId, teacherId: classEvent.teacherId }
}
