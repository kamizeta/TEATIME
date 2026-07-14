import { ClassType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildClassTitle, normalizeClassLanguage, syncClassTitle } from '@/lib/class-title'
import { syncClassEventToGoogleCalendar } from '@/lib/google-calendar'
import { isSignedValueValid, signValue } from '@/lib/security'

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
    classLanguage: string
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
  expiresAtIso: string
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
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${signValue(encoded)}`
}

function decodeSlotToken(token: string): SlotTokenPayload {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature || !isSignedValueValid(encoded, signature)) throw new Error('INVALID_SLOT_TOKEN')
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SlotTokenPayload
  if (!payload.expiresAtIso || new Date(payload.expiresAtIso).getTime() <= Date.now()) throw new Error('SLOT_TOKEN_EXPIRED')
  return payload
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

function getZonedDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function getTeacherCalendarDay(date: Date, timezone: string) {
  const local = getZonedDateParts(date, timezone)
  return new Date(Date.UTC(local.year, local.month - 1, local.day))
}

function zonedDateTimeToUtc(day: Date, minutesFromMidnight: number, timezone: string) {
  const year = day.getUTCFullYear()
  const month = day.getUTCMonth()
  const date = day.getUTCDate()
  const hour = Math.floor(minutesFromMidnight / 60)
  const minute = minutesFromMidnight % 60
  const utcGuess = Date.UTC(year, month, date, hour, minute, 0)
  const getOffset = (instant: Date) => {
    const local = getZonedDateParts(instant, timezone)
    return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - instant.getTime()
  }
  let timestamp = utcGuess - getOffset(new Date(utcGuess))
  timestamp = utcGuess - getOffset(new Date(timestamp))
  return new Date(timestamp)
}

function getTeacherLocalTime(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[values.weekday]
  return { weekday, minutes: Number(values.hour) * 60 + Number(values.minute) }
}

async function assertSlotMatchesActiveAvailability(
  client: typeof prisma | Prisma.TransactionClient,
  context: PrimaryBookingContext,
  slot: SlotTokenPayload,
  startAt: Date,
  endAt: Date
) {
  const duration = endAt.getTime() - startAt.getTime()
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || duration !== slot.durationMinutes * 60_000) {
    throw new Error('INVALID_SLOT_RANGE')
  }

  const local = getTeacherLocalTime(startAt, context.teacher.timezone)
  const matchingBlocks = await client.teacherAvailabilityBlock.findMany({
    where: {
      teacherId: context.teacher.id,
      weekday: local.weekday,
      isActive: true,
      durationMinutes: slot.durationMinutes,
      classType: slot.classType,
      capacity: slot.capacity,
    },
  })
  const slotEndMinutes = local.minutes + slot.durationMinutes
  const validBlock = matchingBlocks.find((block) => {
    const startMinutes = parseTimeToMinutes(block.startLocalTime)
    const endMinutes = parseTimeToMinutes(block.endLocalTime)
    return local.minutes >= startMinutes && slotEndMinutes <= endMinutes && (local.minutes - startMinutes) % slot.durationMinutes === 0
  })
  if (!validBlock) throw new Error('SLOT_NO_LONGER_AVAILABLE')

  const now = new Date()
  const hoursUntilStart = (startAt.getTime() - now.getTime()) / 3_600_000
  if (hoursUntilStart < context.bookingRule.minimumNoticeHours || hoursUntilStart > context.bookingRule.maximumNoticeDays * 24) {
    throw new Error('SLOT_OUTSIDE_BOOKING_WINDOW')
  }

  const unavailable = await client.teacherAvailabilityException.findFirst({
    where: {
      teacherId: context.teacher.id,
      type: 'UNAVAILABLE',
      startsAt: { lt: endAt },
      endsAt: { gt: startAt },
    },
  })
  if (unavailable) throw new Error('SLOT_UNAVAILABLE_EXCEPTION')
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

export function getPackageProgress(totalMinutes: number, usedMinutes: number, reservedMinutes: number) {
  const consumedMinutes = Math.max(usedMinutes, 0)
  const scheduledMinutes = Math.max(consumedMinutes + reservedMinutes, consumedMinutes)
  const availableMinutes = Math.max(totalMinutes - scheduledMinutes, 0)

  return {
    consumedMinutes,
    scheduledMinutes,
    contractedMinutes: totalMinutes,
    availableMinutes,
  }
}

export function formatPackageProgress(totalMinutes: number, usedMinutes: number, reservedMinutes: number) {
  const progress = getPackageProgress(totalMinutes, usedMinutes, reservedMinutes)
  const formatHours = (minutes: number) => {
    const hours = minutes / 60
    const value = Number.isInteger(hours)
      ? String(hours)
      : hours.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    return `${value} h`
  }

  return `${formatHours(progress.consumedMinutes)} / ${formatHours(progress.scheduledMinutes)} / ${formatHours(progress.contractedMinutes)}`
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
      classLanguage: activePackage.classLanguage,
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

  const rangeStartDay = getTeacherCalendarDay(new Date(), context.teacher.timezone)
  const rangeEndDay = addDays(rangeStartDay, daysAhead)
  const rangeStart = zonedDateTimeToUtc(rangeStartDay, 0, context.teacher.timezone)
  const rangeEnd = zonedDateTimeToUtc(rangeEndDay, 23 * 60 + 59, context.teacher.timezone)

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
    const currentDay = addDays(rangeStartDay, dayOffset)
    const weekday = currentDay.getUTCDay()
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
        const startAt = zonedDateTimeToUtc(currentDay, cursorMinutes, context.teacher.timezone)
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
            expiresAtIso: new Date(Date.now() + 10 * 60_000).toISOString(),
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
  await assertSlotMatchesActiveAvailability(prisma, context, slot, startAt, endAt)

  const bookedClass = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${context.teacher.id}:${startAt.toISOString()}`}))`
    await assertSlotMatchesActiveAvailability(tx, context, slot, startAt, endAt)

    const pack = await tx.hourPackage.findUnique({ where: { id: context.package.id } })
    if (!pack) throw new Error('PACKAGE_NOT_FOUND')

    const currentRemaining = pack.totalMinutes - pack.usedMinutes - pack.reservedMinutes
    if (currentRemaining < slot.durationMinutes) throw new Error('INSUFFICIENT_PACKAGE_BALANCE')

    const rule = await tx.bookingRule.findFirst({ orderBy: { createdAt: 'asc' } })
    const bufferMinutes = rule?.bufferMinutes ?? context.bookingRule.bufferMinutes
    let classEvent = slot.existingClassId
      ? await tx.classEvent.findUnique({
          where: { id: slot.existingClassId },
          include: { enrollments: true },
        })
      : null

    if (classEvent && (
      classEvent.teacherId !== context.teacher.id ||
      classEvent.status === 'CANCELED' ||
      classEvent.classType !== 'GROUP' ||
      classEvent.startAt.getTime() !== startAt.getTime() ||
      classEvent.endAt.getTime() !== endAt.getTime() ||
      classEvent.durationMinutes !== slot.durationMinutes ||
      classEvent.capacity !== slot.capacity
    )) throw new Error('INVALID_EXISTING_GROUP_CLASS')
    if (classEvent && classEvent.enrollments.filter((item) => item.status === 'CONFIRMED').length >= classEvent.capacity) {
      throw new Error('GROUP_CLASS_FULL')
    }
    if (classEvent && normalizeClassLanguage(classEvent.classLanguage) !== normalizeClassLanguage(pack.classLanguage)) {
      throw new Error('PACKAGE_LANGUAGE_MISMATCH')
    }

    const conflict = await tx.classEvent.findFirst({
      where: {
        teacherId: context.teacher.id,
        id: classEvent ? { not: classEvent.id } : undefined,
        status: { in: ['SCHEDULED', 'RESERVED'] },
        startAt: { lt: new Date(endAt.getTime() + bufferMinutes * 60_000) },
        endAt: { gt: new Date(startAt.getTime() - bufferMinutes * 60_000) },
      },
    })
    if (conflict) throw new Error('SLOT_ALREADY_TAKEN')

    if (!classEvent) {
      classEvent = await tx.classEvent.create({
        data: {
          title: buildClassTitle({
            classLanguage: context.package.classLanguage,
            studentNames: [context.student.userName],
            teacherName: context.teacher.userName,
          }),
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
          classLanguage: normalizeClassLanguage(context.package.classLanguage),
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
        reservedHours: { increment: Math.ceil(slot.durationMinutes / 60) },
      },
    })

    await syncClassTitle(tx, classEvent.id)

    return classEvent
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  await syncClassEventToGoogleCalendar(bookedClass.id, 'upsert')
  return bookedClass
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

  const activeBlocks = await prisma.teacherAvailabilityBlock.findMany({
    where: { teacherId: teacher.id, weekday: input.weekday, isActive: true },
  })
  const startsAt = parseTimeToMinutes(input.startLocalTime)
  const endsAt = parseTimeToMinutes(input.endLocalTime)
  if (activeBlocks.some((block) => startsAt < parseTimeToMinutes(block.endLocalTime) && endsAt > parseTimeToMinutes(block.startLocalTime))) {
    throw new Error('AVAILABILITY_OVERLAPS_EXISTING')
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
