import { ClassType, PrismaClient, UserRole } from '@prisma/client'

const databaseUrl = process.env.DATABASE_URL || ''
if (!databaseUrl.includes('_test_')) throw new Error('DOMAIN_TEST_REQUIRES_DISPOSABLE_DATABASE')

const { prisma } = await import('../src/lib/prisma')
const { hashPassword } = await import('../src/lib/auth')
const {
  createAvailabilityBlockForTeacher,
  createBookingForStudent,
  listBookableSlotsForStudent,
} = await import('../src/lib/booking')
const { requestCancellation } = await import('../src/lib/cancellations')
const { settleClassLedger } = await import('../src/lib/class-closing')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function expectError(work: () => Promise<unknown>, expected: string) {
  try {
    await work()
  } catch (error) {
    assert(error instanceof Error && error.message === expected, `Esperaba ${expected}, recibí ${String(error)}`)
    return
  }
  throw new Error(`Debió fallar con ${expected}`)
}

async function createStudent(name: string, email: string, teacherId: string, password: string) {
  const user = await prisma.user.create({
    data: { name, email, password, role: UserRole.STUDENT, isActive: true },
  })
  const student = await prisma.student.create({ data: { userId: user.id, studentCode: `TEST-${name.replace(/\s/g, '').toUpperCase()}` } })
  const hourPackage = await prisma.hourPackage.create({
    data: {
      studentId: student.id,
      totalHours: 4,
      totalMinutes: 240,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      allowedClassTypes: 'ONE_ON_ONE,GROUP',
      allowedDurations: '60',
      classLanguage: 'Inglés',
    },
  })
  await prisma.studentTeacherAssignment.create({
    data: { studentId: student.id, teacherId, assignedByUserId: user.id, isPrimary: true },
  })
  return { user, student, hourPackage }
}

async function main() {
  const password = await hashPassword('domain-test-password')
  const teacherUser = await prisma.user.create({
    data: { name: 'Profesora de Prueba', email: 'teacher.domain@test.local', password, role: UserRole.TEACHER, isActive: true },
  })
  const teacher = await prisma.teacher.create({ data: { userId: teacherUser.id, timezone: 'America/Bogota' } })
  const primary = await createStudent('Alumno Principal', 'student.primary@test.local', teacher.id, password)
  const secondary = await createStudent('Alumno Secundario', 'student.secondary@test.local', teacher.id, password)

  await prisma.bookingRule.create({
    data: { minimumNoticeHours: 6, maximumNoticeDays: 30, bufferMinutes: 0 },
  })

  for (let weekday = 0; weekday <= 6; weekday += 1) {
    await createAvailabilityBlockForTeacher(teacherUser.id, {
      weekday,
      startLocalTime: '08:00',
      endLocalTime: '12:00',
      durationMinutes: 60,
      classType: ClassType.ONE_ON_ONE,
      capacity: 1,
    })
  }
  await expectError(
    () => createAvailabilityBlockForTeacher(teacherUser.id, {
      weekday: 1,
      startLocalTime: '08:00',
      endLocalTime: '12:00',
      durationMinutes: 60,
      classType: ClassType.ONE_ON_ONE,
      capacity: 1,
    }),
    'AVAILABILITY_OVERLAPS_EXISTING'
  )

  const firstSlots = await listBookableSlotsForStudent(primary.user.id)
  assert(firstSlots.slots.length > 0, 'No se generaron slots reservables')
  await expectError(() => createBookingForStudent(primary.user.id, `${firstSlots.slots[0].token}tampered`), 'INVALID_SLOT_TOKEN')

  const booked = await createBookingForStudent(primary.user.id, firstSlots.slots[0].token)
  const reservedPackage = await prisma.hourPackage.findUniqueOrThrow({ where: { id: primary.hourPackage.id } })
  assert(reservedPackage.reservedMinutes === 60, 'La reserva no separó 1 hora del paquete')

  const earlyCancellation = await requestCancellation({
    classId: booked.id,
    userId: primary.user.id,
    role: 'STUDENT',
    reason: 'Prueba de cancelación dentro del plazo',
    scope: 'SELF',
  })
  assert(earlyCancellation.ok, 'La cancelación dentro del plazo fue rechazada')
  const releasedPackage = await prisma.hourPackage.findUniqueOrThrow({ where: { id: primary.hourPackage.id } })
  assert(releasedPackage.reservedMinutes === 0, 'La cancelación permitida no liberó la hora')

  const lateStart = new Date(Date.now() + 60 * 60 * 1000)
  const lateClass = await prisma.classEvent.create({
    data: {
      title: 'Clase de cancelación tardía', startAt: lateStart, endAt: new Date(lateStart.getTime() + 60 * 60 * 1000),
      teacherId: teacher.id, classType: ClassType.ONE_ON_ONE, durationMinutes: 60, capacity: 1, status: 'RESERVED',
    },
  })
  await prisma.classEnrollment.create({
    data: { classEventId: lateClass.id, studentId: primary.student.id, packageId: primary.hourPackage.id, reservedMinutes: 60, reservedHours: 1 },
  })
  await prisma.hourPackage.update({ where: { id: primary.hourPackage.id }, data: { reservedMinutes: { increment: 60 }, reservedHours: { increment: 1 } } })
  const lateCancellation = await requestCancellation({
    classId: lateClass.id, userId: primary.user.id, role: 'STUDENT', reason: 'Prueba fuera de plazo', scope: 'SELF',
  })
  assert(!lateCancellation.ok, 'La cancelación fuera de plazo fue aceptada')
  const latePackage = await prisma.hourPackage.findUniqueOrThrow({ where: { id: primary.hourPackage.id } })
  assert(latePackage.reservedMinutes === 60, 'La cancelación fuera de plazo liberó saldo')

  const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const noShowClass = await prisma.classEvent.create({
    data: {
      title: 'Clase no asistió', startAt: pastStart, endAt: new Date(pastStart.getTime() + 60 * 60 * 1000),
      teacherId: teacher.id, classType: ClassType.ONE_ON_ONE, durationMinutes: 60, capacity: 1, status: 'RESERVED',
    },
  })
  await prisma.classEnrollment.create({
    data: { classEventId: noShowClass.id, studentId: secondary.student.id, packageId: secondary.hourPackage.id, reservedMinutes: 60, reservedHours: 1 },
  })
  await prisma.hourPackage.update({ where: { id: secondary.hourPackage.id }, data: { reservedMinutes: 60, reservedHours: 1 } })
  await prisma.attendanceRecord.create({
    data: { classEventId: noShowClass.id, studentId: secondary.student.id, status: 'no_show', markedBy: teacherUser.id },
  })
  await settleClassLedger(noShowClass.id)
  const settledPackage = await prisma.hourPackage.findUniqueOrThrow({ where: { id: secondary.hourPackage.id } })
  const settledEnrollment = await prisma.classEnrollment.findUniqueOrThrow({ where: { classEventId_studentId: { classEventId: noShowClass.id, studentId: secondary.student.id } } })
  assert(settledPackage.usedMinutes === 60 && settledPackage.reservedMinutes === 0, 'No asistió no consumió exactamente una hora')
  assert(settledEnrollment.consumedMinutes === 60 && settledEnrollment.reservedMinutes === 0, 'El ledger de la matrícula no quedó cerrado')

  console.log('OK token firmado, disponibilidad única, reserva, cancelaciones y No asistió')
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
