import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type DatabaseClient = Prisma.TransactionClient | typeof prisma

export type ClassLanguage = 'Inglés' | 'Español'

export function normalizeClassLanguage(value: string | null | undefined): ClassLanguage {
  return value === 'Español' ? 'Español' : 'Inglés'
}

export function buildClassTitle({
  classLanguage,
  studentNames,
  teacherName,
}: {
  classLanguage: string | null | undefined
  studentNames: Array<string | null | undefined>
  teacherName: string
}) {
  const students = studentNames.filter((name): name is string => Boolean(name?.trim())).join(', ') || 'Sin alumno asignado'
  return `Clase ${normalizeClassLanguage(classLanguage)} TEA TIME - ${students} - Prof. ${teacherName}`
}

/** Keeps calendar, attendance, and booking views on the same class name. */
export async function syncClassTitle(client: DatabaseClient, classId: string) {
  const classEvent = await client.classEvent.findUniqueOrThrow({
    where: { id: classId },
    include: {
      teacher: { include: { user: true } },
      enrollments: {
        include: { student: { include: { user: true } } },
        orderBy: { id: 'asc' },
      },
    },
  })

  const title = buildClassTitle({
    classLanguage: classEvent.classLanguage,
    studentNames: classEvent.enrollments.map((enrollment) => enrollment.student.user.name),
    teacherName: classEvent.teacher.user.name,
  })

  if (classEvent.title !== title) {
    await client.classEvent.update({ where: { id: classId }, data: { title } })
  }

  return title
}
