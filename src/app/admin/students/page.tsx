export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assignTeacherToStudentAction } from '@/lib/actions'
import { formatMinutesLabel } from '@/lib/booking'

function getAssignmentErrorMessage(code?: string) {
  if (code === 'RELATED_ENTITY_NOT_FOUND') return 'Alumno o profesor no existen.'
  if (code === 'MISSING_ASSIGNMENT_FIELDS') return 'Faltan datos para asignar profesor.'
  return 'No se pudo asignar el profesor.'
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  await requireRole(['ADMIN', 'STAFF'])

  const students = await prisma.student.findMany({
    include: {
      user: true,
      packages: { orderBy: { validTo: 'desc' } },
      teacherAssignments: {
        where: { isPrimary: true, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
        include: { teacher: { include: { user: true } } },
        take: 1,
      },
    },
    orderBy: { user: { name: 'asc' } },
  })
  const teachers = await prisma.teacher.findMany({
    include: { user: true },
    orderBy: { user: { name: 'asc' } },
  })
  const assignCode = typeof searchParams?.code === 'string' ? searchParams.code : ''

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Alumnos</p>
        <h1 className="page-title">Asignación de profesor</h1>
        <p className="page-lead">
          Staff puede dejar la relación alumno-profesor lista para reservas, primeras clases asistidas y seguimiento de paquetes.
        </p>
      </section>

      {searchParams?.assign === 'ok' ? <p className="status-success">Profesor asignado al alumno.</p> : null}
      {searchParams?.assign === 'error' ? <p className="status-warning">{getAssignmentErrorMessage(assignCode)}</p> : null}

      <section className="panel table-panel">
        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Código</th>
              <th>Profesor actual</th>
              <th>Saldo disponible</th>
              <th>Nueva asignación</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const activePackage = student.packages.find((pack) => pack.status === 'ACTIVE')
              const assignedTeacher = student.teacherAssignments[0]?.teacher
              const availableMinutes = activePackage
                ? activePackage.totalMinutes - activePackage.usedMinutes - activePackage.reservedMinutes
                : 0

              return (
                <tr key={student.id}>
                  <td>{student.user.name}</td>
                  <td>{student.studentCode}</td>
                  <td>{assignedTeacher?.user.name || 'Sin profesor'}</td>
                  <td>{activePackage ? formatMinutesLabel(availableMinutes) : 'Sin paquete activo'}</td>
                  <td>
                    <form action={assignTeacherToStudentAction} className="inline-form">
                      <input type="hidden" name="studentId" value={student.id} />
                      <input type="hidden" name="redirectPath" value="/admin/students" />
                      <select name="teacherId" className="select" defaultValue={assignedTeacher?.id || ''}>
                        <option value="">Seleccionar</option>
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.user.name}
                          </option>
                        ))}
                      </select>
                      <input name="notes" className="input" placeholder="Nota" />
                      <button type="submit" className="button-ghost">Asignar</button>
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
