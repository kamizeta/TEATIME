export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { UserRole } from '@prisma/client'
import { createUserAction } from '@/lib/actions'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DirtySubmitButton } from '@/components/dirty-submit-button'
import { TeacherDirectoryRow } from '@/components/teacher-directory-row'

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
  const classCounts = teachers.length ? await prisma.classEvent.groupBy({
    by: ['teacherId', 'status'],
    where: {
      teacherId: { in: teachers.map((teacher) => teacher.id) },
      status: { in: ['SCHEDULED', 'RESERVED', 'COMPLETED'] },
    },
    _count: { _all: true },
  }) : []
  const classProgressByTeacher = new Map<string, { completed: number; programmed: number }>()
  for (const count of classCounts) {
    const current = classProgressByTeacher.get(count.teacherId) || { completed: 0, programmed: 0 }
    current.programmed += count._count._all
    if (count.status === 'COMPLETED') current.completed += count._count._all
    classProgressByTeacher.set(count.teacherId, current)
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Profesores</p>
        <h1 className="page-title">Directorio académico</h1>
        <p className="page-lead">
          Aquí se crean profesores y se revisa si tienen alumnos asignados, disponibilidad y próximas clases.
        </p>
        <div className="inline-actions">
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
            <DirtySubmitButton className="ops-span-2">
              Crear profesor
            </DirtySubmitButton>
          </form>
        </section>
      ) : null}

      <section className="panel table-panel teachers-table-panel">
        <div className="card-header">
          <p className="eyebrow">Profesores actuales</p>
          <h2>{teachers.length} docentes</h2>
        </div>
        <table className="teacher-directory-table">
          <thead>
            <tr>
              <th>Nombre y apellido</th>
              <th>Correo electrónico</th>
              <th>WhatsApp</th>
              <th>Estado</th>
              <th>Alumnos asignados</th>
              <th>Disponibilidad</th>
              <th>Próximas clases</th>
              <th className="teacher-directory-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => {
              const classProgress = classProgressByTeacher.get(teacher.id) || { completed: 0, programmed: 0 }
              return canEdit ? (
                <TeacherDirectoryRow
                  key={teacher.id}
                  teacher={{
                    id: teacher.id,
                    userId: teacher.user.id,
                    name: teacher.user.name,
                    email: teacher.user.email,
                    phoneE164: teacher.user.phoneE164,
                    isActive: teacher.user.isActive,
                    studentNames: teacher.studentAssignments.map((assignment) => assignment.student.user.name),
                    availabilityCount: teacher.availabilityBlocks.length,
                    completedClasses: classProgress.completed,
                    programmedClasses: classProgress.programmed,
                    nextClass: teacher.classEvents[0] ? {
                      title: teacher.classEvents[0].title,
                      startsAt: teacher.classEvents[0].startAt.toISOString(),
                    } : null,
                  }}
                />
              ) : (
                <tr key={teacher.id}>
                  <td>{teacher.user.name}</td>
                  <td>{teacher.user.email}</td>
                  <td>{teacher.user.phoneE164 || 'Sin teléfono'}</td>
                  <td>{teacher.user.isActive ? 'Activo' : 'Inactivo'}</td>
                  <td>{teacher.studentAssignments.map((assignment) => assignment.student.user.name).join(', ') || 'Sin alumnos'}</td>
                  <td>{teacher.availabilityBlocks.length} bloques</td>
                  <td>{classProgress.completed} / {classProgress.programmed} realizadas / programadas</td>
                  <td className="teacher-directory-actions">
                    <Link href={`/admin/teachers/${teacher.id}`} className="button-link compact-button">Ver detalle</Link>
                  </td>
                </tr>
              )
            })}
            {!teachers.length ? (
              <tr>
                <td colSpan={8}>No hay profesores creados.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  )
}
