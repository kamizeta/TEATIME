import { ClassType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type PrimaryBookingContext = {
  student: {
    id: string
    userId: string
    userName: string
  }
  teacher: {
    id: string
    userName: string
    timezone: string
  }
  package: {
    id: string
    totalMinutes: number
    usedMinutes: number
    reservedMinutes: number
    allowedClassTypes: string
    allowedDurations: string
  }
  bookingRule: {
    minimumNoticeHours: number
    maximumNoticeDays: number
    bufferMinutes: number
  }
}

export type BookableSlot = {
  token: string
  startsAtIso: string
  endsAtIso: string
  durationMinutes: number
  classType: ClassType
  capacity: number
  availableSeats: number
  teacherName: string
  teacherId: string
  existingClassId?: string
}

type SlotTokenPayload = {
  teacherId: string
  startAtIso: string
  endAtIso: string
  durationMinutes: number
  classType: ClassType
  capacity: number
  existingClassId?: string
}

function parseCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseCsvNumbers(value: string) {
  return parseCsv(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
}

function encodeSlotToken(payload: SlotTokenPayload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeSlotToken(token: string): SlotTokenPayload {
  return JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as SlotTokenPayload
}

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function cloneDate(date: Date) {
  return new Date(date.getTime())
}

function startOfDay(date: Date) {
  const copy = cloneDate(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfDay(date: Date) {
  const copy = cloneDate(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function addDays(date: Date, days: number) {
  const copy = cloneDate(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function setTime(date: Date, minutesFromMidnight: number) {
  const copy = startOfDay(date)
  copy.setMinutes(minutesFromMidnight)
  return copy
}

function overlapsWithBuffer(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date, bufferMinutes: number) {
  const bufferedAStart = aStart.getTime() - bufferMinutes * 60_000
  const bufferedAEnd = aEnd.getTime() + bufferMinutes * 60_000
  return bufferedAStart < bEnd.getTime() && bufferedAEnd > bStart.getTime()
}

export function formatMinutesLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes} min`
  if (!minutes) return `${hours} h`
  return `${hours} h ${minutes} min`
}

export async function getPrimaryBookingContextForUser(userId: string): Promise<PrimaryBookingContext | null> {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      user: true,
      teacherAssignments: {
        where: { isPrimary: true, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
        include: { teacher: { include: { user: true } } },
        orderBy: { startsAt: 'desc' },
        take: 1,
      },
      packages: {
        where: { status: 'ACTIVE', validTo: { gte: new Date() } },
        orderBy: { validTo: 'asc' },
        take: 1,
      },
    },
  })

  if (!student) return null

  const assignment = student.teacherAssignments[0]
  const activePackage = student.packages[0]
  if (!assignment || !activePackage) return null

  const bookingRule =
    (await prisma.bookingRule.findFirst({
      orderBy: { createdAt: 'asc' },
    })) ?? {
      minimumNoticeHours: 6,
      maximumNoticeDays: 30,
      bufferMinutes: 15,
    }

  return {
    student: {
      id: student.id,
      userId: student.userId,
      userName: student.user.name,
    },
    teacher: {
      id: assignment.teacher.id,
      userName: assignment.teacher.user.name,
      timezone: assignment.teacher.timezone,
    },
    package: {
      id: activePackage.id,
      totalMinutes: activePackage.totalMinutes,
      usedMinutes: activePackage.usedMinutes,
      reservedMinutes: activePackage.reservedMinutes,
      allowedClassTypes: activePackage.allowedClassTypes,
      allowedDurations: activePackage.allowedDurations,
    },
    bookingRule: {
      minimumNoticeHours: bookingRule.minimumNoticeHours,
      maximumNoticeDays: bookingRule.maximumNoticeDays,
      bufferMinutes: bookingRule.bufferMinutes,
    },
  }
}

export async function listBookableSlotsForStudent(userId: string, daysAhead = 14) {
  const context = await getPrimaryBookingContextForUser(userId)
  if (!context) {
    return { context: null, slots: [] as BookableSlot[] }
  }

  const availableMinutes =
    context.package.totalMinutes - context.package.usedMinutes - context.package.reservedMinutes

  if (availableMinutes <= 0) {
    return { context, slots: [] as BookableSlot[] }
  }

  const allowedTypes = parseCsv(context.package.allowedClassTypes).filter((item): item is ClassType =>
    item === 'ONE_ON_ONE' || item === 'GROUP'
  )
  const allowedDurations = parseCsvNumbers(context.package.allowedDurations)

  const blocks = await prisma.teacherAvailabilityBlock.findMany({
    where: { teacherId: context.teacher.id, isActive: true },
    orderBy: [{ weekday: 'asc' }, { startLocalTime: 'asc' }],
  })

  const rangeStart = startOfDay(new Date())
  const rangeEnd = endOfDay(addDays(rangeStart, daysAhead))

  const [exceptions, existingClasses] = await Promise.all([
    prisma.teacherAvailabilityException.findMany({
      where: {
        teacherId: context.teacher.id,
        startsAt: { lte: rangeEnd },
        endsAt: { gte: rangeStart },
      },
    }),
    prisma.classEvent.findMany({
      where: {
        teacherId: context.teacher.id,
        startAt: { gte: rangeStart, lte: rangeEnd },
        status: { in: ['SCHEDULED', 'RESERVED'] },
      },
      include: { enrollments: true },
      orderBy: { startAt: 'asc' },
    }),
  ])

  const now = new Date()
  const slots: BookableSlot[] = []

  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset += 1) {
    const currentDay = addDays(rangeStart, dayOffset)
    const weekday = currentDay.getDay()
    const dayBlocks = blocks.filter((block) => block.weekday === weekday)

    for (const block of dayBlocks) {
      if (!allowedTypes.includes(block.classType)) continue
      if (!allowedDurations.includes(block.durationMinutes)) continue
      if (block.durationMinutes > availableMinutes) continue

      const blockStartMinutes = parseTimeToMinutes(block.startLocalTime)
      const blockEndMinutes = parseTimeToMinutes(block.endLocalTime)

      for (
        let cursorMinutes = blockStartMinutes;
        cursorMinutes + block.durationMinutes <= blockEndMinutes;
        cursorMinutes += block.durationMinutes
      ) {
        const startAt = setTime(currentDay, cursorMinutes)
        const endAt = new Date(startAt.getTime() + block.durationMinutes * 60_000)

        const hoursUntilStart = (startAt.getTime() - now.getTime()) / 3_600_000
        if (hoursUntilStart < context.bookingRule.minimumNoticeHours) continue
        if (hoursUntilStart > context.bookingRule.maximumNoticeDays * 24) continue

        const hitsException = exceptions.some(
          (exception) =>
            exception.type === 'UNAVAILABLE' &&
            overlapsWithBuffer(startAt, endAt, exception.startsAt, exception.endsAt, 0)
        )
        if (hitsException) continue

        const exactGroupClass = existingClasses.find(
          (item) =>
            item.classType === block.classType &&
            item.startAt.getTime() === startAt.getTime() &&
            item.endAt.getTime() === endAt.getTime()
        )

        const conflictingClass = existingClasses.find((item) => {
          if (exactGroupClass && item.id === exactGroupClass.id && block.classType === 'GROUP') return false
          return overlapsWithBuffer(startAt, endAt, item.startAt, item.endAt, context.bookingRule.bufferMinutes)
        })

        if (conflictingClass) continue

        let availableSeats = block.capacity
        let existingClassId: string | undefined

        if (exactGroupClass) {
          existingClassId = exactGroupClass.id
          availableSeats = Math.max(0, exactGroupClass.capacity - exactGroupClass.enrollments.length)
        }

        if (availableSeats <= 0) continue

        slots.push({
          token: encodeSlotToken({
            teacherId: context.teacher.id,
            startAtIso: startAt.toISOString(),
            endAtIso: endAt.toISOString(),
            durationMinutes: block.durationMinutes,
            classType: block.classType,
            capacity: block.capacity,
            existingClassId,
          }),
          startsAtIso: startAt.toISOString(),
          endsAtIso: endAt.toISOString(),
          durationMinutes: block.durationMinutes,
          classType: block.classType,
          capacity: block.capacity,
          availableSeats,
          teacherName: context.teacher.userName,
          teacherId: context.teacher.id,
          existingClassId,
        })
      }
    }
  }

  slots.sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso))
  return { context, slots }
}

export async function createBookingForStudent(userId: string, slotToken: string) {
  const context = await getPrimaryBookingContextForUser(userId)
  if (!context) {
    throw new Error('BOOKING_CONTEXT_MISSING')
  }

  const slot = decodeSlotToken(slotToken)
  if (slot.teacherId !== context.teacher.id) {
    throw new Error('INVALID_TEACHER_FOR_STUDENT')
  }

  const remainingMinutes =
    context.package.totalMinutes - context.package.usedMinutes - context.package.reservedMinutes
  if (remainingMinutes < slot.durationMinutes) {
    throw new Error('INSUFFICIENT_PACKAGE_BALANCE')
  }

  const startAt = new Date(slot.startAtIso)
  const endAt = new Date(slot.endAtIso)

  const rule = await prisma.bookingRule.findFirst()
  const bufferMinutes = rule?.bufferMinutes ?? context.bookingRule.bufferMinutes

  const conflictingClass = await prisma.classEvent.findFirst({
    where: {
      teacherId: context.teacher.id,
      id: slot.existingClassId ? { not: slot.existingClassId } : undefined,
      status: { in: ['SCHEDULED', 'RESERVED'] },
      startAt: { lt: new Date(endAt.getTime() + bufferMinutes * 60_000) },
      endAt: { gt: new Date(startAt.getTime() - bufferMinutes * 60_000) },
    },
  })

  if (conflictingClass) {
    throw new Error('SLOT_ALREADY_TAKEN')
  }

  return prisma.$transaction(async (tx) => {
    const pack = await tx.hourPackage.findUnique({ where: { id: context.package.id } })
    if (!pack) throw new Error('PACKAGE_NOT_FOUND')

    const currentRemaining = pack.totalMinutes - pack.usedMinutes - pack.reservedMinutes
    if (currentRemaining < slot.durationMinutes) throw new Error('INSUFFICIENT_PACKAGE_BALANCE')

    let classEvent = slot.existingClassId
      ? await tx.classEvent.findUnique({
          where: { id: slot.existingClassId },
          include: { enrollments: true },
        })
      : null

    if (classEvent && classEvent.classType === 'GROUP' && classEvent.enrollments.length >= classEvent.capacity) {
      throw new Error('GROUP_CLASS_FULL')
    }

    if (!classEvent) {
      classEvent = await tx.classEvent.create({
        data: {
          title:
            slot.classType === 'GROUP'
              ? `Clase grupal con ${context.teacher.userName}`
              : `Clase 1:1 con ${context.teacher.userName}`,
          startAt,
          endAt,
          timezone: 'America/Bogota',
          status: 'RESERVED',
          classType: slot.classType,
          durationMinutes: slot.durationMinutes,
          capacity: slot.capacity,
          teacherId: context.teacher.id,
          bookedById: userId,
          bookingSource: 'STUDENT',
        },
        include: { enrollments: true },
      })
    }

    const existingEnrollment = await tx.classEnrollment.findUnique({
      where: {
        classEventId_studentId: {
          classEventId: classEvent.id,
          studentId: context.student.id,
        },
      },
    })

    if (existingEnrollment) {
      throw new Error('STUDENT_ALREADY_BOOKED')
    }

    await tx.classEnrollment.create({
      data: {
        classEventId: classEvent.id,
        studentId: context.student.id,
        packageId: context.package.id,
        status: 'CONFIRMED',
        reservedMinutes: slot.durationMinutes,
      },
    })

    await tx.hourPackage.update({
      where: { id: context.package.id },
      data: {
        reservedMinutes: { increment: slot.durationMinutes },
      },
    })

    return classEvent
  })
}

export async function createAvailabilityBlockForTeacher(userId: string, input: {
  weekday: number
  startLocalTime: string
  endLocalTime: string
  durationMinutes: number
  classType: ClassType
  capacity: number
}) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } })
  if (!teacher) throw new Error('TEACHER_PROFILE_NOT_FOUND')

  if (parseTimeToMinutes(input.endLocalTime) <= parseTimeToMinutes(input.startLocalTime)) {
    throw new Error('INVALID_AVAILABILITY_RANGE')
  }

  return prisma.teacherAvailabilityBlock.create({
    data: {
      teacherId: teacher.id,
      weekday: input.weekday,
      startLocalTime: input.startLocalTime,
      endLocalTime: input.endLocalTime,
      durationMinutes: input.durationMinutes,
      classType: input.classType,
      capacity: input.capacity,
      timezone: teacher.timezone,
    },
  })
}

export function getWeekdayLabel(weekday: number) {
  return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][weekday] || `Día ${weekday}`
}
