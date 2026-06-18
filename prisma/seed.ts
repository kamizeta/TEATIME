import { PrismaClient, UserRole } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await hashPassword('admin123')
  const teacherPassword = await hashPassword('prof123')
  const studentPassword = await hashPassword('alumno123')

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@academy.test' },
    update: { password: adminPassword },
    create: {
      email: 'admin@academy.test',
      password: adminPassword,
      name: 'Admin Academia',
      role: UserRole.ADMIN,
      phoneE164: '+573001234567'
    }
  })

  const teacherUser = await prisma.user.upsert({
    where: { email: 'profesor@academy.test' },
    update: { password: teacherPassword },
    create: {
      email: 'profesor@academy.test',
      password: teacherPassword,
      name: 'María López',
      role: UserRole.TEACHER,
      phoneE164: '+573001234568'
    }
  })

  const studentUser = await prisma.user.upsert({
    where: { email: 'alumno@academy.test' },
    update: { password: studentPassword },
    create: {
      email: 'alumno@academy.test',
      password: studentPassword,
      name: 'Juan Pérez',
      role: UserRole.STUDENT,
      phoneE164: '+573001234569'
    }
  })

  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: { userId: teacherUser.id, timezone: 'America/Bogota' }
  })

  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: { userId: studentUser.id, studentCode: 'STU-001', notes: 'Demo' }
  })

  const packageId = await prisma.hourPackage.upsert({
    where: { id: 'pkg-demo-1' },
    update: { totalHours: 20, usedHours: 0 },
    create: {
      id: 'pkg-demo-1',
      studentId: student.id,
      totalHours: 20,
      usedHours: 0,
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2026-12-31'),
      status: 'ACTIVE',
    }
  })

  const startAt = new Date()
  startAt.setHours(startAt.getHours() + 1)
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000)

  const existing = await prisma.classEvent.findFirst({ where: { googleEventId: 'evt_demo_1' } })
  const classEvent = existing
    ? existing
    : await prisma.classEvent.create({
        data: {
          googleEventId: 'evt_demo_1',
          title: 'Clase de Inglés - Demo',
          startAt,
          endAt,
          meetUrl: 'https://meet.google.com/demo-clase',
          teacherId: teacher.id,
        },
      })

  await prisma.classEnrollment.upsert({
    where: {
      classEventId_studentId: {
        classEventId: classEvent.id,
        studentId: student.id,
      },
    },
    update: { packageId: packageId.id },
    create: {
      classEventId: classEvent.id,
      studentId: student.id,
      packageId: packageId.id,
      status: 'CONFIRMED',
    },
  })

  await prisma.setting.upsert({
    where: { key: 'CANCEL_GRACE_HOURS' },
    update: { value: '6' },
    create: { key: 'CANCEL_GRACE_HOURS', value: '6' },
  })

  console.log('Seed complete')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
