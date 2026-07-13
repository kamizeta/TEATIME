'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildClassTitle, normalizeClassLanguage, syncClassTitle } from '@/lib/class-title'
import { syncClassEventToGoogleCalendar } from '@/lib/google-calendar'

function toLegacyHourUnits(minutes: number) {
  return Math.ceil(minutes / 60)
}

function withQuery(path: string, entries: Record<string, string>) {
  const [pathname, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  for (const [key, value] of Object.entries(entries)) params.set(key, value)
  return `${pathname}?${params.toString()}`
}

export async function createManualClassAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/dashboard')

  const teacherId = String(formData.get('teacherId') || '')
  const packageIds = formData
    .getAll('packageIds')
    .map((value) => String(value))
    .filter(Boolean)
  const packageId = String(formData.get('packageId') || '')
  const startAtRaw = String(formData.get('startAt') || '')
  const durationMinutes = Number(formData.get('durationMinutes') || 60)
  const meetUrl = String(formData.get('meetUrl') || '').trim()
  const classType = String(formData.get('classType') || 'ONE_ON_ONE') as 'ONE_ON_ONE' | 'GROUP'
  const selectedPackageIds = packageIds.length ? packageIds : packageId ? [packageId] : []

  if (!teacherId || !selectedPackageIds.length || !startAtRaw) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'MISSING_MANUAL_CLASS_FIELDS' }))
  }

  const startAt = new Date(startAtRaw)
  if (isNaN(startAt.getTime())) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'INVALID_START_AT' }))
  }
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000)

  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, include: { user: true } })
  const packages = await prisma.hourPackage.findMany({
    where: { id: { in: selectedPackageIds }, status: 'ACTIVE' },
    include: { student: { include: { user: true } } },
  })

  if (!teacher || packages.length !== selectedPackageIds.length) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'RELATED_ENTITY_NOT_FOUND' }))
  }

  if (classType === 'ONE_ON_ONE' && packages.length !== 1) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'ONE_ON_ONE_REQUIRES_ONE_STUDENT' }))
  }

  const languages = [...new Set(packages.map((pack) => normalizeClassLanguage(pack.classLanguage)))]
  if (languages.length !== 1) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'PACKAGE_LANGUAGE_MISMATCH' }))
  }
  const classLanguage = languages[0]
  const title = buildClassTitle({
    classLanguage,
    studentNames: packages.map((pack) => pack.student.user.name),
    teacherName: teacher.user.name,
  })

  const conflict = await prisma.classEvent.findFirst({
    where: {
      teacherId,
      status: { in: ['SCHEDULED', 'RESERVED'] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  })

  if (conflict) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'TEACHER_TIME_CONFLICT' }))
  }

  const packageWithoutBalance = packages.find(
    (pack) => pack.totalMinutes - pack.usedMinutes - pack.reservedMinutes < durationMinutes
  )
  if (packageWithoutBalance) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'INSUFFICIENT_PACKAGE_BALANCE' }))
  }

  const createdClassId = await prisma.$transaction(async (tx) => {
    const createdClass = await tx.classEvent.create({
      data: {
        title,
        startAt,
        endAt,
        timezone: teacher.timezone,
        meetUrl: meetUrl || null,
        status: 'RESERVED',
        classType,
        durationMinutes,
        capacity: classType === 'GROUP' ? Math.max(6, packages.length) : 1,
        teacherId,
        bookedById: session.userId,
        bookingSource: 'STAFF_MANUAL',
        classLanguage,
      },
    })

    for (const pack of packages) {
      await tx.classEnrollment.create({
        data: {
          classEventId: createdClass.id,
          studentId: pack.studentId,
          packageId: pack.id,
          status: 'CONFIRMED',
          reservedMinutes: durationMinutes,
          reservedHours: toLegacyHourUnits(durationMinutes),
        },
      })

      await tx.hourPackage.update({
        where: { id: pack.id },
        data: {
          reservedMinutes: { increment: durationMinutes },
          reservedHours: { increment: toLegacyHourUnits(durationMinutes) },
        },
      })
    }

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'MANUAL_CLASS_CREATED',
        entityType: 'CLASS_EVENT',
        entityId: createdClass.id,
        after: JSON.stringify({
          title,
          teacherId,
          studentIds: packages.map((pack) => pack.studentId),
          packageIds: packages.map((pack) => pack.id),
          startAt: startAt.toISOString(),
          durationMinutes,
        }),
      },
    })

    return createdClass.id
  })

  await syncClassEventToGoogleCalendar(createdClassId, 'upsert')

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/calendar')
  revalidatePath('/admin/packages')
  revalidatePath('/student/home')
  revalidatePath('/teacher/today')
  redirect(withQuery(redirectPath, { ops: 'created' }))
}

export async function rescheduleClassAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const classId = String(formData.get('classId') || '')
  const redirectPath = String(formData.get('redirectPath') || `/admin/classes/${classId}`)
  const teacherId = String(formData.get('teacherId') || '')
  const startAtRaw = String(formData.get('startAt') || '')
  const durationMinutes = Number(formData.get('durationMinutes') || 60)
  const meetUrl = String(formData.get('meetUrl') || '').trim()

  if (!classId || !teacherId || !startAtRaw) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'MISSING_RESCHEDULE_FIELDS' }))
  }

  const startAt = new Date(startAtRaw)
  if (isNaN(startAt.getTime())) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'INVALID_START_AT' }))
  }
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000)

  const classEvent = await prisma.classEvent.findUnique({
    where: { id: classId },
    include: { enrollments: { include: { package: true } } },
  })
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })

  if (!classEvent || !teacher) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'RELATED_ENTITY_NOT_FOUND' }))
  }
  if (classEvent.status === 'COMPLETED' || classEvent.status === 'CANCELED') {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'CLASS_NOT_EDITABLE' }))
  }

  const conflict = await prisma.classEvent.findFirst({
    where: {
      id: { not: classId },
      teacherId,
      status: { in: ['SCHEDULED', 'RESERVED'] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  })
  if (conflict) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'TEACHER_TIME_CONFLICT' }))
  }

  const currentReservedMinutes = classEvent.durationMinutes || 60
  const deltaMinutes = durationMinutes - currentReservedMinutes

  if (deltaMinutes > 0) {
    const insufficient = classEvent.enrollments.find(
      (enrollment) =>
        enrollment.status === 'CONFIRMED' &&
        enrollment.package.totalMinutes - enrollment.package.usedMinutes - enrollment.package.reservedMinutes < deltaMinutes
    )
    if (insufficient) {
      redirect(withQuery(redirectPath, { ops: 'error', code: 'INSUFFICIENT_PACKAGE_BALANCE' }))
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.classEvent.update({
      where: { id: classId },
      data: {
        teacherId,
        startAt,
        endAt,
        timezone: teacher.timezone,
        durationMinutes,
        meetUrl: meetUrl || null,
      },
    })

    if (deltaMinutes !== 0) {
      for (const enrollment of classEvent.enrollments.filter((item) => item.status === 'CONFIRMED')) {
        await tx.classEnrollment.update({
          where: { id: enrollment.id },
          data: {
            reservedMinutes: { increment: deltaMinutes },
            reservedHours: toLegacyHourUnits(durationMinutes),
          },
        })
        await tx.hourPackage.update({
          where: { id: enrollment.packageId },
          data: {
            reservedMinutes: { increment: deltaMinutes },
            reservedHours: { increment: toLegacyHourUnits(durationMinutes) - toLegacyHourUnits(currentReservedMinutes) },
          },
        })
      }
    }

    await syncClassTitle(tx, classId)

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'CLASS_RESCHEDULED',
        entityType: 'CLASS_EVENT',
        entityId: classId,
        before: JSON.stringify({
          teacherId: classEvent.teacherId,
          startAt: classEvent.startAt.toISOString(),
          durationMinutes: classEvent.durationMinutes,
        }),
        after: JSON.stringify({ teacherId, startAt: startAt.toISOString(), durationMinutes }),
      },
    })
  })

  await syncClassEventToGoogleCalendar(classId, 'upsert')

  revalidatePath('/admin/calendar')
  revalidatePath('/admin/dashboard')
  revalidatePath(`/admin/classes/${classId}`)
  revalidatePath('/student/home')
  revalidatePath('/teacher/today')
  redirect(withQuery(redirectPath, { ops: 'rescheduled' }))
}

export async function addStudentToClassAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const classId = String(formData.get('classId') || '')
  const packageId = String(formData.get('packageId') || '')
  const redirectPath = String(formData.get('redirectPath') || `/admin/classes/${classId}`)

  if (!classId || !packageId) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'MISSING_GROUP_FIELDS' }))
  }

  const classEvent = await prisma.classEvent.findUnique({ where: { id: classId }, include: { enrollments: true } })
  const hourPackage = await prisma.hourPackage.findUnique({ where: { id: packageId } })

  if (!classEvent || !hourPackage) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'RELATED_ENTITY_NOT_FOUND' }))
  }
  if (classEvent.status === 'COMPLETED' || classEvent.status === 'CANCELED') {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'CLASS_NOT_EDITABLE' }))
  }
  if (classEvent.classType !== 'GROUP') {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'CLASS_NOT_GROUP' }))
  }
  if (classEvent.enrollments.filter((item) => item.status === 'CONFIRMED').length >= classEvent.capacity) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'GROUP_CLASS_FULL' }))
  }
  if (classEvent.enrollments.some((item) => item.studentId === hourPackage.studentId)) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'STUDENT_ALREADY_BOOKED' }))
  }

  const durationMinutes = classEvent.durationMinutes || 60
  const availableMinutes = hourPackage.totalMinutes - hourPackage.usedMinutes - hourPackage.reservedMinutes
  if (availableMinutes < durationMinutes) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'INSUFFICIENT_PACKAGE_BALANCE' }))
  }

  await prisma.$transaction(async (tx) => {
    await tx.classEnrollment.create({
      data: {
        classEventId: classId,
        studentId: hourPackage.studentId,
        packageId,
        status: 'CONFIRMED',
        reservedMinutes: durationMinutes,
        reservedHours: toLegacyHourUnits(durationMinutes),
      },
    })
    await tx.hourPackage.update({
      where: { id: packageId },
      data: {
        reservedMinutes: { increment: durationMinutes },
        reservedHours: { increment: toLegacyHourUnits(durationMinutes) },
      },
    })
    await syncClassTitle(tx, classId)
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'GROUP_STUDENT_ADDED',
        entityType: 'CLASS_EVENT',
        entityId: classId,
        after: JSON.stringify({ packageId, studentId: hourPackage.studentId }),
      },
    })
  })

  await syncClassEventToGoogleCalendar(classId, 'upsert')

  revalidatePath(`/admin/classes/${classId}`)
  revalidatePath('/admin/calendar')
  revalidatePath('/admin/packages')
  redirect(withQuery(redirectPath, { ops: 'student_added' }))
}

export async function assignTeacherToStudentAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const studentId = String(formData.get('studentId') || '')
  const teacherId = String(formData.get('teacherId') || '')
  const notes = String(formData.get('notes') || '').trim()
  const redirectPath = String(formData.get('redirectPath') || '/admin/students')

  if (!studentId || !teacherId) {
    redirect(withQuery(redirectPath, { assign: 'error', code: 'MISSING_ASSIGNMENT_FIELDS' }))
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } })
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
  if (!student || !teacher) {
    redirect(withQuery(redirectPath, { assign: 'error', code: 'RELATED_ENTITY_NOT_FOUND' }))
  }

  await prisma.$transaction(async (tx) => {
    await tx.studentTeacherAssignment.updateMany({
      where: { studentId, isPrimary: true, endsAt: null },
      data: { isPrimary: false, endsAt: new Date() },
    })
    await tx.studentTeacherAssignment.create({
      data: {
        studentId,
        teacherId,
        assignedByUserId: session.userId,
        isPrimary: true,
        notes: notes || null,
      },
    })
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'STUDENT_TEACHER_ASSIGNED',
        entityType: 'STUDENT',
        entityId: studentId,
        after: JSON.stringify({ teacherId, notes }),
      },
    })
  })

  revalidatePath('/admin/students')
  revalidatePath('/admin/dashboard')
  redirect(withQuery(redirectPath, { assign: 'ok' }))
}

export async function adjustPackageMinutesAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/packages')

  const packageId = String(formData.get('packageId') || '')
  const deltaHoursRaw = formData.get('deltaHours')
  const deltaMinutesRaw = formData.get('deltaMinutes')
  const deltaHours = deltaHoursRaw ? Number(deltaHoursRaw) : Number(deltaMinutesRaw || 0) / 60
  const deltaMinutes = deltaHours * 60
  const note = String(formData.get('note') || '').trim()

  if (!packageId || !Number.isFinite(deltaHours) || !Number.isInteger(deltaHours) || !deltaMinutes || !note) {
    redirect(withQuery(redirectPath, { package: 'error', code: 'MISSING_PACKAGE_ADJUSTMENT_FIELDS' }))
  }

  const hourPackage = await prisma.hourPackage.findUnique({ where: { id: packageId } })
  if (!hourPackage) {
    redirect(withQuery(redirectPath, { package: 'error', code: 'PACKAGE_NOT_FOUND' }))
  }

  const nextTotalMinutes = hourPackage.totalMinutes + deltaMinutes
  if (nextTotalMinutes < hourPackage.usedMinutes + hourPackage.reservedMinutes) {
    redirect(withQuery(redirectPath, { package: 'error', code: 'PACKAGE_TOTAL_WOULD_BELOW_COMMITTED' }))
  }

  await prisma.$transaction(async (tx) => {
    await tx.hourPackage.update({
      where: { id: packageId },
      data: {
        totalMinutes: nextTotalMinutes,
        totalHours: toLegacyHourUnits(nextTotalMinutes),
      },
    })

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'PACKAGE_MINUTES_ADJUSTED',
        entityType: 'PACKAGE_LEDGER',
        entityId: packageId,
        before: JSON.stringify({
          totalMinutes: hourPackage.totalMinutes,
          totalHours: hourPackage.totalHours,
        }),
        after: JSON.stringify({
          totalMinutes: nextTotalMinutes,
          totalHours: toLegacyHourUnits(nextTotalMinutes),
          deltaHours,
          deltaMinutes,
          note,
        }),
      },
    })
  })

  revalidatePath('/admin/packages')
  revalidatePath('/admin/dashboard')
  redirect(withQuery(redirectPath, { package: 'adjusted' }))
}

export async function syncClassWithGoogleAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const classId = String(formData.get('classId') || '')
  const redirectPath = String(formData.get('redirectPath') || `/admin/classes/${classId}`)
  if (!classId) redirect(withQuery(redirectPath, { ops: 'error', code: 'MISSING_CLASS_ID' }))

  const result = await syncClassEventToGoogleCalendar(classId, 'upsert')
  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: 'GOOGLE_CLASS_SYNC_REQUESTED',
      entityType: 'CLASS_EVENT',
      entityId: classId,
      after: JSON.stringify(result),
    },
  })

  revalidatePath(`/admin/classes/${classId}`)
  revalidatePath('/admin/calendar')
  redirect(withQuery(redirectPath, { ops: result.ok ? 'google_synced' : 'google_failed' }))
}
