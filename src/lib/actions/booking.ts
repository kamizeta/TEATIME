'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAvailabilityBlockForTeacher, createBookingForStudent } from '@/lib/booking'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { settleClassLedger } from '@/lib/class-closing'

const AvailabilitySchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  startLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
  endLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.coerce.number().int().min(30).max(180),
  classType: z.enum(['ONE_ON_ONE', 'GROUP']),
  capacity: z.coerce.number().int().min(1).max(12),
})

export async function saveAvailabilityBlockAction(formData: FormData) {
  const session = await requireRole(['TEACHER'])
  const parsed = AvailabilitySchema.parse({
    weekday: formData.get('weekday'),
    startLocalTime: formData.get('startLocalTime'),
    endLocalTime: formData.get('endLocalTime'),
    durationMinutes: formData.get('durationMinutes'),
    classType: formData.get('classType'),
    capacity: formData.get('capacity'),
  })

  await createAvailabilityBlockForTeacher(session.userId, parsed)
  revalidatePath('/teacher/availability')
}

export async function deactivateAvailabilityBlockAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF', 'TEACHER'])
  const blockId = String(formData.get('blockId') ?? '')
  const redirectPath = String(formData.get('redirectPath') ?? '/teacher/availability')

  if (!blockId) throw new Error('MISSING_AVAILABILITY_BLOCK_ID')

  const block = await prisma.teacherAvailabilityBlock.findUnique({
    where: { id: blockId },
    include: { teacher: true },
  })

  if (!block) throw new Error('AVAILABILITY_BLOCK_NOT_FOUND')
  if (session.role === 'TEACHER' && block.teacher.userId !== session.userId) {
    throw new Error('FORBIDDEN_AVAILABILITY_BLOCK')
  }

  if (block.isActive) {
    await prisma.$transaction(async (tx) => {
      await tx.teacherAvailabilityBlock.update({
        where: { id: block.id },
        data: { isActive: false },
      })
      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: 'AVAILABILITY_BLOCK_DEACTIVATED',
          entityType: 'TEACHER_AVAILABILITY_BLOCK',
          entityId: block.id,
          before: JSON.stringify({ isActive: true }),
          after: JSON.stringify({ isActive: false }),
        },
      })
    })
  }

  revalidatePath('/teacher/availability')
  revalidatePath('/teacher/today')
  revalidatePath('/student/book')
  revalidatePath('/student/home')
  revalidatePath('/admin/teachers')
  revalidatePath(`/admin/teachers/${block.teacherId}`)
  redirect(`${redirectPath}${redirectPath.includes('?') ? '&' : '?'}availability=deleted`)
}

export async function bookSlotAction(formData: FormData) {
  const session = await requireRole(['STUDENT'])
  const slotToken = String(formData.get('slotToken') || '')
  if (!slotToken) throw new Error('MISSING_SLOT_TOKEN')

  await createBookingForStudent(session.userId, slotToken)
  revalidatePath('/student/book')
  revalidatePath('/student/home')
  revalidatePath('/teacher/today')
  revalidatePath('/admin/dashboard')
}

export async function closeClassAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF', 'TEACHER'])
  const classId = String(formData.get('classId') || '')
  if (!classId) throw new Error('MISSING_CLASS_ID')

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
  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { id: classEvent.teacherId } })
    if (!teacher || teacher.userId !== session.userId) throw new Error('TEACHER_NOT_OWNER')
  }
  if (classEvent.status === 'COMPLETED') throw new Error('CLASS_ALREADY_CLOSED')
  if (classEvent.status === 'CANCELED') {
    redirect(`/admin/classes/${classId}?ops=error&code=CLASS_CANCELED`)
  }
  if (classEvent.endAt.getTime() > Date.now()) {
    redirect(`/admin/classes/${classId}?ops=error&code=CLASS_NOT_FINISHED`)
  }

  const confirmedEnrollments = classEvent.enrollments.filter((enrollment) => enrollment.status === 'CONFIRMED')
  if (confirmedEnrollments.some((enrollment) => !enrollment.attendance)) {
    redirect(`/admin/classes/${classId}?ops=error&code=MISSING_ATTENDANCE`)
  }

  await settleClassLedger(classId)

  revalidatePath(`/admin/classes/${classId}`)
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/packages')
  revalidatePath('/student/home')
  revalidatePath('/teacher/today')
  revalidatePath('/teacher/dashboard')
  revalidatePath(`/admin/teachers/${classEvent.teacherId}`)
}
