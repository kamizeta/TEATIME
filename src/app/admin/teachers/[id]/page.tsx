export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getWeekdayLabel } from '@/lib/booking'
import { prisma } from '@/lib/prisma'

const statusLabels: Record<string, string> = {
  SCHEDULED: 'Programada',
  RESERVED: 'Reservada',
  COMPLETED: 'Completada',
  CANCELED: 'Cancelada',
}

export default async function AdminTeacherDetailPage({ params }: { params: { id: string } }) {
  await requireRole(['ADMIN', 'STAFF'])
  const now = new Date()
  const teacher = await prisma.teacher.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      studentAssignments: {
        where: { isPrimary: true, OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        include: { student: { include: { user: true } } },
        orderBy: { startsAt: 'desc' },
      },
      availabilityBlocks: {
        where: { isActive: true },
        orderBy: [{ weekday: 'asc' }, { startLocalTime: 'asc' }],
      },
      availabilityExceptions: {
        where: { endsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        take: 20,
      },
      classEvents: {
        where: {
          startAt: { gte: now },
          status: { in: ['SCHEDULED', 'RESERVED'] },
        },
        include: {
          enrollments: {
            where: { status: 'CONFIRMED' },
            include: { student: { include: { user: true } } },
          },
        },
        orderBy: { startAt: 'asc' },
      },
    },
  })

  if (!teacher) return notFound()

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Ficha del profesor</p>
        <h1 className="page-title">{teacher.user.name}</h1>
        <p className="page-lead">
          {teacher.user.email} · {teacher.user.phoneE164 || 'Sin WhatsApp'} · {teacher.timezone}
        </p>
        <div className="metric-row">
          <span className="status-pill">{teacher.user.isActive ? 'Profesor activo' : 'Profesor inactivo'}</span>
          <span className="status-pill">{teacher.studentAssignments.length} alumnos</span>
          <span className="status-pill">{teacher.availabilityBlocks.length} bloques disponibles</span>
          <span className="status-pill">{teacher.classEvents.length} clases próximas</span>
        </div>
        <div className="inline-actions">
          <Link href="/admin/teachers" className="button-ghost">Volver a profesores</Link>
          <Link href="/admin/students" className="button-link">Asignar alumnos</Link>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Agenda</p>
          <h2>Próximas clases</h2>
          <p className="hint">Cada clase muestra sus alumnos confirmados y accesos operativos.</p>
        </div>
        <div className="table-scroll">
          <table className="teacher-detail-table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Clase</th>
                <th>Alumnos</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {teacher.classEvents.map((classEvent) => (
                <tr key={classEvent.id}>
                  <td>
                    <strong>{classEvent.startAt.toLocaleString('es-CO')}</strong>
                    <small className="block-muted">hasta {classEvent.endAt.toLocaleTimeString('es-CO')}</small>
                  </td>
                  <td><strong>{classEvent.title}</strong></td>
                  <td>
                    {classEvent.enrollments.map((enrollment) => enrollment.student.user.name).join(', ') || 'Sin alumnos confirmados'}
                  </td>
                  <td>{classEvent.classType === 'GROUP' ? 'Grupal' : '1:1'}</td>
                  <td>{statusLabels[classEvent.status] || classEvent.status}</td>
                  <td>
                    <div className="row-actions">
                      {classEvent.meetUrl ? (
                        <a href={classEvent.meetUrl} target="_blank" rel="noreferrer" className="button-ghost compact-button">
                          Abrir Meet
                        </a>
                      ) : null}
                      <Link href={`/admin/classes/${classEvent.id}`} className="button-link compact-button">
                        Ver clase
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!teacher.classEvents.length ? (
                <tr><td colSpan={6}>Este profesor no tiene clases próximas.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="teacher-detail-grid">
        <section className="panel">
          <div className="card-header">
            <p className="eyebrow">Disponibilidad semanal</p>
            <h2>Bloques publicados</h2>
          </div>
          <div className="teacher-availability-list">
            {teacher.availabilityBlocks.map((block) => (
              <article className="teacher-availability-item" key={block.id}>
                <div>
                  <strong>{getWeekdayLabel(block.weekday)}</strong>
                  <small className="block-muted">{block.startLocalTime} a {block.endLocalTime}</small>
                </div>
                <div>
                  <span>{block.classType === 'GROUP' ? 'Grupal' : '1:1'}</span>
                  <small className="block-muted">{block.durationMinutes} min · cupo {block.capacity}</small>
                </div>
              </article>
            ))}
            {!teacher.availabilityBlocks.length ? <p className="block-muted">No ha publicado disponibilidad.</p> : null}
          </div>

          <div className="card-header teacher-exceptions-heading">
            <p className="eyebrow">Excepciones próximas</p>
            <h3>Bloqueos y aperturas especiales</h3>
          </div>
          <div className="teacher-availability-list">
            {teacher.availabilityExceptions.map((exception) => (
              <article className="teacher-availability-item" key={exception.id}>
                <div>
                  <strong>{exception.type === 'UNAVAILABLE' ? 'No disponible' : 'Disponible'}</strong>
                  <small className="block-muted">{exception.reason || 'Sin nota'}</small>
                </div>
                <small>{exception.startsAt.toLocaleString('es-CO')} a {exception.endsAt.toLocaleString('es-CO')}</small>
              </article>
            ))}
            {!teacher.availabilityExceptions.length ? <p className="block-muted">No hay excepciones próximas.</p> : null}
          </div>
        </section>

        <section className="panel table-panel">
          <div className="card-header">
            <p className="eyebrow">Alumnos</p>
            <h2>Asignaciones activas</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Código</th>
                <th>Desde</th>
              </tr>
            </thead>
            <tbody>
              {teacher.studentAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>
                    <strong>{assignment.student.user.name}</strong>
                    <small className="block-muted">{assignment.student.user.email}</small>
                  </td>
                  <td>{assignment.student.studentCode}</td>
                  <td>{assignment.startsAt.toLocaleDateString('es-CO')}</td>
                </tr>
              ))}
              {!teacher.studentAssignments.length ? (
                <tr><td colSpan={3}>No tiene alumnos asignados.</td></tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
