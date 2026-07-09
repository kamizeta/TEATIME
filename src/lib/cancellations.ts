import type { AppRole } from '@/lib/navigation'
import { prisma } from '@/lib/prisma'
import { buildLedgerReleaseUpdate } from '@/lib/package-ledger'

type CancellationScope = 'SELF' | 'CLASS'

function diffHoursUntil(startAt: Date, now = new Date()) {
  return (startAt.getTime() - now.getTime()) / (1000 * 60 * 60)
}

export async function getCancellationPolicy() {
  const bookingRule = await prisma.bookingRule.findFirst({ orderBy: { createdAt: 'asc' } })
  return {
    minimumNoticeHours: bookingRule?.minimumNoticeHours ?? 6,
    allowStudentReschedule: bookingRule?.allowStudentReschedule ?? true,
    allowTeacherReschedule: bookingRule?.allowTeacherReschedule ?? true,
    allowStaffOverride: bookingRule?.allowStaffOverride ?? true,
  }
}

export async function requestCancellation(input: {
  classId: string
  userId: string
  role: AppRole
  reason: string
  scope: CancellationScope
}) {
  const { classId, userId, role, reason, scope } = input
  const policy = await getCancellationPolicy()

  const classEvent = await prisma.classEvent.findUnique({
    where: { id: classId },
    include: {
      teacher: { include: { user: true } },
      enrollments: {
        include: {
          student: { include: { user: true } },
          package: true,
        },
      },
    },
  })

  if (!classEvent) throw new Error('CLASS_NOT_FOUND')
  if (classEvent.status === 'COMPLETED') throw new Error('CLASS_ALREADY_COMPLETED')
  if (classEvent.status === 'CANCELED') throw new Error('CLASS_ALREADY_CANCELED')

  const requesterEnrollment = classEvent.enrollments.find((enrollment) => enrollment.student.userId === userId)
  const isTeacherOwner = classEvent.teacher.userId === userId
  const isStaffOverride = role === 'ADMIN' || role === 'STAFF'

  if (role === 'STUDENT' && !requesterEnrollment) throw new Error('STUDENT_NOT_ENROLLED')
  if (role === 'TEACHER' && !isTeacherOwner) throw new Error('TEACHER_NOT_OWNER')
  if (scope === 'CLASS' && role === 'STUDENT') throw new Error('STUDENT_CANNOT_CANCEL_CLASS')
  if (scope === 'SELF' && role !== 'STUDENT') throw new Error('INVALID_SCOPE_FOR_ROLE')

  const diffHours = diffHoursUntil(classEvent.startAt)
  const allowedByWindow = diffHours >= policy.minimumNoticeHours
  const overrideUsed = isStaffOverride && !allowedByWindow && policy.allowStaffOverride
  const allowed = isStaffOverride ? allowedByWindow || overrideUsed : allowedByWindow

  await prisma.cancellation.create({
    data: {
      classEventId: classId,
      requestedBy: userId,
      reason,
      wasAllowed: allowed,
      graceHours: policy.minimumNoticeHours,
    },
  })

  if (!allowed) {
    return {
      ok: false as const,
      reason: 'WINDOW_EXPIRED',
      minimumNoticeHours: policy.minimumNoticeHours,
      diffHours,
    }
  }

  await prisma.$transaction(async (tx) => {
    if (scope === 'SELF') {
      const enrollment = requesterEnrollment
      if (!enrollment) throw new Error('STUDENT_NOT_ENROLLED')

      const reservedMinutes = enrollment.reservedMinutes || classEvent.durationMinutes || 60
      if (reservedMinutes > 0) {
        await tx.hourPackage.update({
          where: { id: enrollment.packageId },
          data: buildLedgerReleaseUpdate(reservedMinutes),
        })
      }

      await tx.classEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'CANCELLED',
          reservedMinutes: 0,
          reservedHours: 0,
        },
      })

      const remainingConfirmed = classEvent.enrollments.filter(
        (item) => item.id !== enrollment.id && item.status === 'CONFIRMED'
      ).length

      if (remainingConfirmed === 0) {
        await tx.classEvent.update({
          where: { id: classId },
          data: { status: 'CANCELED' },
        })
      }

      return
    }

    for (const enrollment of classEvent.enrollments.filter((item) => item.status === 'CONFIRMED')) {
      const reservedMinutes = enrollment.reservedMinutes || classEvent.durationMinutes || 60
      if (reservedMinutes > 0) {
        await tx.hourPackage.update({
          where: { id: enrollment.packageId },
          data: buildLedgerReleaseUpdate(reservedMinutes),
        })
      }

      await tx.classEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'CANCELLED',
          reservedMinutes: 0,
          reservedHours: 0,
        },
      })
    }

    await tx.classEvent.update({
      where: { id: classId },
      data: { status: 'CANCELED' },
    })
  })

  return {
    ok: true as const,
    scope,
    minimumNoticeHours: policy.minimumNoticeHours,
    diffHours,
    overrideUsed,
  }
}
