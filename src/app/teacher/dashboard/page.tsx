export const dynamic = "force-dynamic"

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export default async function TeacherDashboard() {
  const session = await getSession()
  if (!session || session.role !== 'TEACHER') return <p>Sin sesión docente</p>

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
  if (!teacher) return <p>Docente no registrado</p>

  const rows = await prisma.classEvent.findMany({
    where: { teacherId: teacher.id },
    include: {
      enrollments: { include: { student: { include: { user: true } } }, },
    },
    orderBy: { startAt: 'asc' },
  })

  return (
    <div>
      <h1>Panel profesor</h1>
      <ul>
        {rows.map((c) => (
          <li key={c.id}>
            {new Date(c.startAt).toLocaleString()} - {c.title} - alumnos {c.enrollments.length}
          </li>
        ))}
      </ul>
    </div>
  )
}
