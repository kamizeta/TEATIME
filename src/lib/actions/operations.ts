'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  const title = String(formData.get('title') || '').trim()
  const teacherId = String(formData.get('teacherId') || '')
  const packageId = String(formData.get('packageId') || '')
  const startAtRaw = String(formData.get('startAt') || '')
  const durationMinutes = Number(formData.get('durationMinutes') || 60)
  const meetUrl = String(formData.get('meetUrl') || '').trim()
  const classType = String(formData.get('classType') || 'ONE_ON_ONE') as 'ONE_ON_ONE' | 'GROUP'

  if (!title || !teacherId || !packageId || !startAtRaw) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'MISSING_MANUAL_CLASS_FIELDS' }))
  }

  const startAt = new Date(startAtRaw)
  if (isNaN(startAt.getTime())) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'INVALID_START_AT' }))
  }
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000)

  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, include: { user: true } })
  const hourPackage = await prisma.hourPackage.findUnique({ where: { id: packageId } })
  const student = hourPackage
    ? await prisma.student.findUnique({ where: { id: hourPackage.studentId }, include: { user: true } })
    : null

  if (!teacher || !student || !hourPackage) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'RELATED_ENTITY_NOT_FOUND' }))
  }

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

  const availableMinutes = hourPackage.totalMinutes - hourPackage.usedMinutes - hourPackage.reservedMinutes
  if (availableMinutes < durationMinutes) {
    redirect(withQuery(redirectPath, { ops: 'error', code: 'INSUFFICIENT_PACKAGE_BALANCE' }))
  }

  await prisma.$transaction(async (tx) => {
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
        capacity: classType === 'GROUP' ? 6 : 1,
        teacherId,
        bookedById: session.userId,
        bookingSource: 'STAFF_MANUAL',
      },
    })

    await tx.classEnrollment.create({
      data: {
        classEventId: createdClass.id,
        studentId: student.id,
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

    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'MANUAL_CLASS_CREATED',
        entityType: 'CLASS_EVENT',
        entityId: createdClass.id,
        after: JSON.stringify({
          title,
          teacherId,
          studentId: student.id,
          packageId,
          startAt: startAt.toISOString(),
          durationMinutes,
        }),
      },
    })
  })

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/calendar')
  revalidatePath('/admin/packages')
  revalidatePath('/student/home')
  revalidatePath('/teacher/today')
  redirect(withQuery(redirectPath, { ops: 'created' }))
}

export async function adjustPackageMinutesAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/packages')

  const packageId = String(formData.get('packageId') || '')
  const deltaMinutes = Number(formData.get('deltaMinutes') || 0)
  const note = String(formData.get('note') || '').trim()

  if (!packageId || !deltaMinutes || !note) {
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
