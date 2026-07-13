export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { convertCrmContactToStudentAction } from '@/lib/actions'
import { formatMinutesLabel } from '@/lib/booking'
import { DirtySubmitButton } from '@/components/dirty-submit-button'
import { StudentAssignmentForm } from '@/components/student-assignment-form'

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
  const teacherOptions = teachers.map((teacher) => ({ id: teacher.id, name: teacher.user.name }))
  const convertibleContacts = await prisma.crmContact.findMany({
    where: {
      convertedStudentId: null,
      email: { not: null },
      status: { in: ['CONTACTED', 'TRIAL_SCHEDULED', 'ACTIVE_STUDENT'] },
    },
    orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
    take: 12,
  })
  const nextYear = new Date()
  nextYear.setFullYear(nextYear.getFullYear() + 1)
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
      {searchParams?.crm === 'converted' ? <p className="status-success">Prospecto convertido a alumno real.</p> : null}

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Desde CRM</p>
          <h2>Prospectos listos para convertir</h2>
          <p className="hint">
            Cambiar el estado a Alumno activo no crea alumno. Para que aparezca abajo, debes convertirlo: usuario,
            paquete y profesor quedan creados en una sola acción.
          </p>
        </div>
        {convertibleContacts.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Prospecto</th>
                  <th>Estado CRM</th>
                  <th>Profesor</th>
                  <th>Paquete inicial</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {convertibleContacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <strong>{contact.fullName}</strong>
                      <small className="block-muted">{contact.email}</small>
                    </td>
                    <td>{contact.status}</td>
                    <td>
                      <form id={`convert-${contact.id}`} action={convertCrmContactToStudentAction} className="inline-form">
                        <input type="hidden" name="redirectPath" value="/admin/students" />
                        <input type="hidden" name="contactId" value={contact.id} />
                        <select name="teacherId" className="select" required>
                          <option value="">Seleccionar</option>
                          {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.user.name}
                            </option>
                          ))}
                        </select>
                      </form>
                    </td>
                    <td>
                      <div className="form-grid two">
                        <input form={`convert-${contact.id}`} name="totalHours" type="number" min="0.5" step="0.5" className="input compact-input" defaultValue={20} aria-label="Horas iniciales" />
                        <input form={`convert-${contact.id}`} name="validTo" type="date" className="input compact-input" defaultValue={nextYear.toISOString().slice(0, 10)} required aria-label="Fecha de expiración de horas" />
                      </div>
                      <small className="block-muted">Horas iniciales · Fecha de expiración de horas</small>
                    </td>
                    <td>
                      <DirtySubmitButton form={`convert-${contact.id}`} className="compact-button">
                        Convertir
                      </DirtySubmitButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No hay prospectos con email listos para convertir.</div>
        )}
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Alumnos reales</p>
          <h2>Asignación de profesor</h2>
        </div>
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
                    <StudentAssignmentForm
                      studentId={student.id}
                      currentTeacherId={assignedTeacher?.id || ''}
                      teachers={teacherOptions}
                    />
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
