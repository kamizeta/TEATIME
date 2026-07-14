import { UserRole } from '@prisma/client'

const databaseUrl = process.env.DATABASE_URL || ''
if (!databaseUrl.includes('_test_')) throw new Error('MEET_TEST_REQUIRES_DISPOSABLE_DATABASE')

const { prisma } = await import('../src/lib/prisma')
const { encryptSecret } = await import('../src/lib/secret-crypto')
const { syncMeetClassAutomation } = await import('../src/lib/meet-automation')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const teacherUser = await prisma.user.create({
    data: { name: 'Profesora Automática', email: 'teacher.meet@test.local', password: 'test-only', role: UserRole.TEACHER },
  })
  const teacher = await prisma.teacher.create({ data: { userId: teacherUser.id } })
  const studentUser = await prisma.user.create({
    data: { name: 'Alumno Automático', email: 'student.meet@test.local', password: 'test-only', role: UserRole.STUDENT },
  })
  const student = await prisma.student.create({ data: { userId: studentUser.id, studentCode: 'MEET-TEST-001' } })
  const hourPackage = await prisma.hourPackage.create({
    data: {
      studentId: student.id,
      totalHours: 4,
      totalMinutes: 240,
      reservedHours: 1,
      reservedMinutes: 60,
      validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      allowedDurations: '60',
    },
  })
  const startAt = new Date(Date.now() - 70 * 60 * 1000)
  const endAt = new Date(Date.now() - 10 * 60 * 1000)
  const classEvent = await prisma.classEvent.create({
    data: {
      title: 'Clase Inglés TEA TIME - Alumno Automático - Prof. Profesora Automática',
      startAt,
      endAt,
      teacherId: teacher.id,
      classType: 'ONE_ON_ONE',
      durationMinutes: 60,
      capacity: 1,
      status: 'RESERVED',
      meetUrl: 'https://meet.google.com/abc-defg-hij',
      transcriptionRequested: true,
    },
  })
  await prisma.classEnrollment.create({
    data: { classEventId: classEvent.id, studentId: student.id, packageId: hourPackage.id, reservedHours: 1, reservedMinutes: 60 },
  })
  await prisma.setting.create({ data: { key: 'GOOGLE_CALENDAR_REFRESH_TOKEN', value: encryptSecret('test-refresh-token') } })

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 })
    }
    if (url.startsWith('https://meet.googleapis.com/v2/conferenceRecords?')) {
      return new Response(JSON.stringify({ conferenceRecords: [{ name: 'conferenceRecords/test-001', startTime: startAt.toISOString(), endTime: endAt.toISOString() }] }), { status: 200 })
    }
    if (url.includes('/conferenceRecords/test-001/participants')) {
      return new Response(JSON.stringify({ participants: [
        { signedinUser: { displayName: 'Profesora Automática' } },
        { signedinUser: { displayName: 'Alumno Automático' } },
      ] }), { status: 200 })
    }
    throw new Error(`Solicitud Meet inesperada: ${url}`)
  }) as typeof fetch

  try {
    const result = await syncMeetClassAutomation(classEvent.id)
    assert(result.status === 'auto_closed', `La clase no se cerró automáticamente: ${result.message}`)

    const closed = await prisma.classEvent.findUniqueOrThrow({ where: { id: classEvent.id } })
    const packageAfter = await prisma.hourPackage.findUniqueOrThrow({ where: { id: hourPackage.id } })
    const attendance = await prisma.attendanceRecord.findUniqueOrThrow({ where: { classEventId_studentId: { classEventId: classEvent.id, studentId: student.id } } })
    const evidence = await prisma.classMeetEvidence.findUniqueOrThrow({ where: { classEventId: classEvent.id } })
    const transcript = await prisma.classTranscript.findUniqueOrThrow({ where: { classEventId: classEvent.id } })

    assert(closed.status === 'COMPLETED', 'Meet no cerró la clase')
    assert(packageAfter.usedMinutes === 60 && packageAfter.reservedMinutes === 0, 'Meet no consumió exactamente la hora reservada')
    assert(attendance.status === 'attended', 'Meet no registró al alumno identificado como asistente')
    assert(evidence.status === 'AUTO_CLOSED' && evidence.teacherEvidence, 'No quedó evidencia suficiente del profesor')
    assert(transcript.status === 'CONSENT_MISSING', 'La falta de consentimiento de transcripción no quedó registrada')

    const futurePackage = await prisma.hourPackage.create({
      data: {
        studentId: student.id,
        totalHours: 2,
        totalMinutes: 120,
        reservedHours: 1,
        reservedMinutes: 60,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        allowedDurations: '60',
      },
    })
    const futureClass = await prisma.classEvent.create({
      data: {
        title: 'Clase futura con enlace reutilizado',
        startAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 49 * 60 * 60 * 1000),
        teacherId: teacher.id,
        classType: 'ONE_ON_ONE',
        durationMinutes: 60,
        capacity: 1,
        status: 'RESERVED',
        meetUrl: 'https://meet.google.com/abc-defg-hij',
      },
    })
    await prisma.classEnrollment.create({
      data: { classEventId: futureClass.id, studentId: student.id, packageId: futurePackage.id, reservedHours: 1, reservedMinutes: 60 },
    })
    const futureResult = await syncMeetClassAutomation(futureClass.id)
    const futureClassAfter = await prisma.classEvent.findUniqueOrThrow({ where: { id: futureClass.id } })
    const futurePackageAfter = await prisma.hourPackage.findUniqueOrThrow({ where: { id: futurePackage.id } })
    assert(futureResult.status === 'pending', 'Una conferencia anterior no debe contar para una clase futura')
    assert(futureClassAfter.status === 'RESERVED', 'Una clase futura fue cerrada con evidencia anterior')
    assert(futurePackageAfter.usedMinutes === 0 && futurePackageAfter.reservedMinutes === 60, 'Una clase futura consumió saldo por error')
    console.log('OK Meet REST cierra y consume sin depender de transcripción')
    console.log('OK Meet REST ignora conferencias fuera de la ventana de la clase')
  } finally {
    globalThis.fetch = originalFetch
  }
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
