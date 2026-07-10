export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { UserRole } from '@prisma/client'
import { createUserAction, updateUserAction } from '@/lib/actions'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getMessage(code: string) {
  const messages: Record<string, string> = {
    MISSING_USER_FIELDS: 'Faltan nombre, email o contraseña válida.',
    EMAIL_ALREADY_EXISTS: 'Ya existe un usuario con ese email.',
    USER_NOT_FOUND: 'El profesor no existe.',
  }
  return messages[code] || 'No se pudo completar la acción.'
}

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const canEdit = session.role === 'ADMIN'
  const result = typeof searchParams?.user === 'string' ? searchParams.user : ''
  const code = typeof searchParams?.code === 'string' ? searchParams.code : ''
  const now = new Date()

  const teachers = await prisma.teacher.findMany({
    include: {
      user: true,
      studentAssignments: {
        where: { isPrimary: true, OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        include: { student: { include: { user: true } } },
      },
      availabilityBlocks: {
        where: { isActive: true },
        orderBy: [{ weekday: 'asc' }, { startLocalTime: 'asc' }],
      },
      classEvents: {
        where: {
          startAt: { gte: now },
          status: { in: ['SCHEDULED', 'RESERVED'] },
        },
        orderBy: { startAt: 'asc' },
        take: 3,
      },
    },
    orderBy: { user: { name: 'asc' } },
  })

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Profesores</p>
        <h1 className="page-title">Directorio académico</h1>
        <p className="page-lead">
          Aquí se crean profesores y se revisa si tienen alumnos asignados, disponibilidad y próximas clases.
        </p>
        <div className="inline-actions">
          <Link href="/teacher/availability" className="button-ghost">
            Ver disponibilidad como profesor
          </Link>
          <Link href="/admin/students" className="button-link">
            Asignar alumnos
          </Link>
        </div>
      </section>

      {result === 'created' ? <p className="status-success">Profesor creado.</p> : null}
      {result === 'updated' ? <p className="status-success">Profesor actualizado.</p> : null}
      {result === 'error' ? <p className="status-warning">{getMessage(code)}</p> : null}
      {!canEdit ? <p className="status-warning">Staff puede revisar profesores, pero solo admin puede crear o editar.</p> : null}

      {canEdit ? (
        <section className="panel">
          <div className="card-header">
            <p className="eyebrow">Nuevo profesor</p>
            <h2>Crear acceso docente</h2>
            <p className="hint">
              Esto crea usuario con rol profesor y perfil académico para que aparezca en asignación, calendario y reservas.
            </p>
          </div>
          <form action={createUserAction} className="ops-form">
            <input type="hidden" name="redirectPath" value="/admin/teachers" />
            <input type="hidden" name="role" value={UserRole.TEACHER} />
            <div className="stack-xs">
              <label htmlFor="teacherName">Nombre</label>
              <input id="teacherName" name="name" className="input" required />
            </div>
            <div className="stack-xs">
              <label htmlFor="teacherEmail">Email</label>
              <input id="teacherEmail" name="email" type="email" className="input" required />
            </div>
            <div className="stack-xs">
              <label htmlFor="teacherPhone">WhatsApp / teléfono</label>
              <input id="teacherPhone" name="phoneE164" className="input" placeholder="+57..." />
            </div>
            <div className="stack-xs">
              <label htmlFor="temporaryPassword">Contraseña temporal</label>
              <input id="temporaryPassword" name="temporaryPassword" className="input" defaultValue="teatime123" />
            </div>
            <button type="submit" className="button-primary ops-span-2">
              Crear profesor
            </button>
          </form>
        </section>
      ) : null}

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Profesores actuales</p>
          <h2>{teachers.length} docentes</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Profesor</th>
              <th>Alumnos asignados</th>
              <th>Disponibilidad</th>
              <th>Próximas clases</th>
              <th>Estado</th>
              <th>Editar</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.id}>
                <td>
                  <strong>{teacher.user.name}</strong>
                  <small className="block-muted">{teacher.user.email} · {teacher.user.phoneE164 || 'sin teléfono'}</small>
                  <small className="block-muted">{teacher.timezone}</small>
                </td>
                <td>
                  <strong>{teacher.studentAssignments.length}</strong>
                  <small className="block-muted">
                    {teacher.studentAssignments.slice(0, 3).map((assignment) => assignment.student.user.name).join(', ') || 'Sin alumnos'}
                  </small>
                </td>
                <td>
                  <strong>{teacher.availabilityBlocks.length}</strong>
                  <small className="block-muted">bloques activos</small>
                </td>
                <td>
                  <strong>{teacher.classEvents.length}</strong>
                  <small className="block-muted">
                    {teacher.classEvents[0] ? teacher.classEvents[0].startAt.toLocaleString('es-CO') : 'Sin próximas clases'}
                  </small>
                </td>
                <td>{teacher.user.isActive ? 'Activo' : 'Inactivo'}</td>
                <td>
                  {canEdit ? (
                    <form action={updateUserAction} className="inline-form">
                      <input type="hidden" name="redirectPath" value="/admin/teachers" />
                      <input type="hidden" name="userId" value={teacher.user.id} />
                      <input name="name" className="input compact-input" defaultValue={teacher.user.name} />
                      <input name="phoneE164" className="input compact-input" defaultValue={teacher.user.phoneE164 || ''} />
                      <label className="check-row">
                        <input type="checkbox" name="isActive" defaultChecked={teacher.user.isActive} /> Activo
                      </label>
                      <button type="submit" className="button-ghost compact-button">
                        Guardar
                      </button>
                    </form>
                  ) : (
                    'Solo lectura'
                  )}
                </td>
              </tr>
            ))}
            {!teachers.length ? (
              <tr>
                <td colSpan={6}>No hay profesores creados.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  )
}
