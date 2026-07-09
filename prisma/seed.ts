import {
  ContactSource,
  ContactStatus,
  CrmActivityStatus,
  CrmActivityType,
  IncidentSeverity,
  IncidentType,
  MessageTemplateChannel,
  NotificationStatus,
  PrismaClient,
  UserRole,
} from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

async function main() {
  const adminPassword = await hashPassword('admin123')
  const staffPassword = await hashPassword('staff123')
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

  const staffUser = await prisma.user.upsert({
    where: { email: 'staff@academy.test' },
    update: { password: staffPassword },
    create: {
      email: 'staff@academy.test',
      password: staffPassword,
      name: 'David Operaciones',
      role: UserRole.STAFF,
      phoneE164: '+573001234570'
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

  await prisma.staffPermission.upsert({
    where: { userId: staffUser.id },
    update: { canCloseWeeks: true, canResolveIncidents: true },
    create: { userId: staffUser.id, canCloseWeeks: true, canResolveIncidents: true },
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

  const packageId = (await prisma.hourPackage.findFirst({ where: { studentId: student.id, status: 'ACTIVE' } }))?.id

  const pack = packageId
    ? await prisma.hourPackage.update({
        where: { id: packageId },
        data: {
          totalHours: 20,
          usedHours: 0,
          reservedHours: 0,
          totalMinutes: 20 * 60,
          usedMinutes: 0,
          reservedMinutes: 0,
          validFrom: new Date('2026-01-01'),
          validTo: new Date('2026-12-31'),
          allowedClassTypes: 'ONE_ON_ONE,GROUP',
          allowedDurations: '50,60,90',
        },
      })
    : await prisma.hourPackage.create({
        data: {
          studentId: student.id,
          totalHours: 20,
          usedHours: 0,
          reservedHours: 0,
          totalMinutes: 20 * 60,
          usedMinutes: 0,
          reservedMinutes: 0,
          validFrom: new Date('2026-01-01'),
          validTo: new Date('2026-12-31'),
          status: 'ACTIVE',
          allowedClassTypes: 'ONE_ON_ONE,GROUP',
          allowedDurations: '50,60,90',
        },
      })

  const existingAssignment = await prisma.studentTeacherAssignment.findFirst({
    where: { studentId: student.id, teacherId: teacher.id, isPrimary: true },
  })

  if (!existingAssignment) {
    await prisma.studentTeacherAssignment.create({
      data: {
        studentId: student.id,
        teacherId: teacher.id,
        assignedByUserId: staffUser.id,
        isPrimary: true,
        notes: 'Asignación inicial demo',
      },
    })
  }

  const defaultBlocks = [
    { weekday: 1, startLocalTime: '08:00', endLocalTime: '11:00', durationMinutes: 60, classType: 'ONE_ON_ONE', capacity: 1 },
    { weekday: 3, startLocalTime: '08:00', endLocalTime: '11:00', durationMinutes: 60, classType: 'ONE_ON_ONE', capacity: 1 },
    { weekday: 5, startLocalTime: '17:00', endLocalTime: '19:00', durationMinutes: 60, classType: 'GROUP', capacity: 4 },
  ] as const

  for (const block of defaultBlocks) {
    const exists = await prisma.teacherAvailabilityBlock.findFirst({
      where: {
        teacherId: teacher.id,
        weekday: block.weekday,
        startLocalTime: block.startLocalTime,
        endLocalTime: block.endLocalTime,
        classType: block.classType,
      },
    })

    if (!exists) {
      await prisma.teacherAvailabilityBlock.create({
        data: {
          teacherId: teacher.id,
          weekday: block.weekday,
          startLocalTime: block.startLocalTime,
          endLocalTime: block.endLocalTime,
          timezone: 'America/Bogota',
          durationMinutes: block.durationMinutes,
          classType: block.classType,
          capacity: block.capacity,
        },
      })
    }
  }

  const bookingRule = await prisma.bookingRule.findFirst()
  if (!bookingRule) {
    await prisma.bookingRule.create({
      data: {
        minimumNoticeHours: 6,
        maximumNoticeDays: 30,
        defaultDurationMinutes: 60,
        bufferMinutes: 15,
        allowStudentReschedule: true,
        allowTeacherReschedule: true,
        allowStaffOverride: true,
        firstBookingStaffAssisted: true,
      },
    })
  }

  const startAt = new Date()
  startAt.setHours(startAt.getHours() + 1)
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000)

  const classEvent = await prisma.classEvent.upsert({
    where: { googleEventId: 'evt_demo_1' },
    update: {
      title: 'Clase de Inglés - Demo',
      startAt,
      endAt,
      meetUrl: 'https://meet.google.com/demo-clase',
      teacherId: teacher.id,
    },
    create: {
      googleEventId: 'evt_demo_1',
      title: 'Clase de Inglés - Demo',
      startAt,
      endAt,
      meetUrl: 'https://meet.google.com/demo-clase',
      teacherId: teacher.id,
      classType: 'ONE_ON_ONE',
      durationMinutes: 60,
      capacity: 1,
      bookedById: staffUser.id,
      bookingSource: 'STAFF',
    },
  })

  await prisma.classEnrollment.upsert({
    where: {
      classEventId_studentId: {
        classEventId: classEvent.id,
        studentId: student.id,
      },
    },
    update: { packageId: pack.id },
    create: {
      classEventId: classEvent.id,
      studentId: student.id,
      packageId: pack.id,
      status: 'CONFIRMED',
      reservedHours: 1,
      reservedMinutes: 60,
    },
  })

  const existingIncident = await prisma.incident.findFirst({ where: { title: 'Demo: confirmar cierre de clase' } })
  if (!existingIncident) {
    await prisma.incident.create({
      data: {
        title: 'Demo: confirmar cierre de clase',
        description: 'Incidencia de ejemplo para probar el flujo de cierre semanal.',
        type: IncidentType.MISSING_ATTENDANCE,
        severity: IncidentSeverity.MEDIUM,
        classEventId: classEvent.id,
        reportedById: staffUser.id,
        assignedToId: staffUser.id,
      },
    })
  }

  await prisma.setting.upsert({
    where: { key: 'CANCEL_GRACE_HOURS' },
    update: { value: '6' },
    create: { key: 'CANCEL_GRACE_HOURS', value: '6' },
  })

  const defaultTemplates = [
    {
      key: 'booking_confirmation',
      name: 'Confirmación de clase',
      channel: MessageTemplateChannel.WHATSAPP,
      body: 'Hola {{student_name}}, tu clase con {{teacher_name}} quedó agendada para {{class_time}}. Enlace: {{meet_url}}',
    },
    {
      key: 'late_cancellation',
      name: 'Cancelación tardía',
      channel: MessageTemplateChannel.WHATSAPP,
      body: 'Hola {{student_name}}, recibimos tu cancelación fuera de la ventana permitida. La clase puede descontarse según política TEATIME.',
    },
    {
      key: 'crm_follow_up',
      name: 'Seguimiento comercial',
      channel: MessageTemplateChannel.WHATSAPP,
      body: 'Hola {{contact_name}}, soy de TEATIME Academy. ¿Quieres que coordinemos tu clase demo o resolvemos alguna duda?',
    },
    {
      key: 'post_trial',
      name: 'Post demo',
      channel: MessageTemplateChannel.WHATSAPP,
      body: 'Hola {{contact_name}}, gracias por tu clase demo. Podemos ayudarte a escoger paquete y horario para empezar.',
    },
  ]

  for (const template of defaultTemplates) {
    await prisma.messageTemplate.upsert({
      where: { key: template.key },
      update: { name: template.name, channel: template.channel, body: template.body, updatedByUserId: adminUser.id },
      create: { ...template, language: 'es', updatedByUserId: adminUser.id },
    })
  }

  const existingCrmContacts = await prisma.crmContact.count()
  if (!existingCrmContacts) {
    const contact = await prisma.crmContact.create({
      data: {
        fullName: 'Laura Gómez',
        email: 'laura.demo@example.com',
        phoneE164: '+573001112233',
        preferredLanguage: 'es',
        source: ContactSource.WHATSAPP,
        status: ContactStatus.CONTACTED,
        interestProgram: 'Inglés conversacional 1:1',
        level: 'B1 estimado',
        nextFollowUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        notes: 'Quiere clases de conversación. Disponible martes y jueves después de las 6pm.',
        ownerId: staffUser.id,
      },
    })

    await prisma.crmActivity.create({
      data: {
        contactId: contact.id,
        actorId: staffUser.id,
        type: CrmActivityType.FOLLOW_UP,
        status: CrmActivityStatus.OPEN,
        title: 'Confirmar disponibilidad para clase demo',
        body: 'Preguntar si prefiere martes o jueves después de las 6pm.',
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    await prisma.notificationAttempt.create({
      data: {
        targetType: 'CRM_CONTACT',
        targetId: contact.id,
        channel: 'WHATSAPP',
        status: NotificationStatus.PENDING,
        payload: JSON.stringify({
          message: 'Hola Laura, te escribimos de TEATIME Academy para coordinar tu clase demo.',
          createdBy: staffUser.id,
        }),
      },
    })
  }

  console.log('Seed complete', {
    admin: adminUser.email,
    staff: staffUser.email,
    teacher: teacherUser.email,
    student: studentUser.email,
    class: classEvent.id,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
