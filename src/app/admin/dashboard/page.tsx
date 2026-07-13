export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createManualClassAction } from '@/lib/actions'
import { formatMinutesLabel } from '@/lib/booking'
import { DirtySubmitButton } from '@/components/dirty-submit-button'
import { classStatusLabels } from '@/lib/display-labels'

function getOpsErrorMessage(code?: string) {
  if (code === 'TEACHER_TIME_CONFLICT') return 'El profesor ya tiene una clase en ese horario.'
  if (code === 'INSUFFICIENT_PACKAGE_BALANCE') return 'El paquete no tiene saldo suficiente para esa clase.'
  if (code === 'INVALID_START_AT') return 'La fecha y hora de inicio no es válida.'
  if (code === 'RELATED_ENTITY_NOT_FOUND') return 'Profesor, alumno o paquete no existen.'
  if (code === 'MISSING_MANUAL_CLASS_FIELDS') return 'Faltan datos obligatorios para crear la clase.'
  if (code === 'ONE_ON_ONE_REQUIRES_ONE_STUDENT') return 'Una clase 1:1 solo puede tener un alumno.'
  return 'No se pudo crear la clase manual.'
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const total = await prisma.classEvent.count()
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

  const todayCount = await prisma.classEvent.count({
    where: { startAt: { gte: start, lte: end } },
  })

  const pending = await prisma.attendanceRecord.count({ where: { status: 'no_show' } })
  const openIncidents = await prisma.incident.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } })
  const pendingNotifications = await prisma.notificationAttempt.count({ where: { status: { in: ['PENDING', 'RETRY'] } } })
  const overdueCrm = await prisma.crmActivity.count({
    where: {
      status: 'OPEN',
      dueAt: { lte: new Date() },
    },
  })
  const pastClassesWithoutTeacherClose = await prisma.classEvent.count({
    where: {
      endAt: { lt: new Date() },
      status: { not: 'CANCELED' },
      instructorAttendance: null,
    },
  })
  const upcomingClassesWithoutMeet = await prisma.classEvent.count({
    where: {
      startAt: { gte: new Date(), lte: new Date(Date.now() + 48 * 60 * 60 * 1000) },
      status: { in: ['SCHEDULED', 'RESERVED'] },
      OR: [{ meetUrl: null }, { meetUrl: '' }],
    },
  })
  const studentsWithoutTeacher = await prisma.student.count({
    where: {
      teacherAssignments: {
        none: {
          isPrimary: true,
          OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
        },
      },
    },
  })
  const packagesExpiringSoon = await prisma.hourPackage.count({
    where: {
      validTo: {
        gte: new Date(),
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      status: 'ACTIVE',
    },
  })
  const recentDeniedCancellations = await prisma.cancellation.findMany({
    where: { wasAllowed: false },
    include: {
      classEvent: true,
      requester: true,
    },
    orderBy: { requestTime: 'desc' },
    take: 6,
  })
  const teachers = await prisma.teacher.findMany({
    include: { user: true },
    orderBy: { user: { name: 'asc' } },
  })
  const activePackages = await prisma.hourPackage.findMany({
    where: { status: 'ACTIVE' },
    include: {
      student: {
        include: {
          user: true,
        },
      },
    },
    orderBy: { validTo: 'asc' },
  })
  const events = await prisma.classEvent.findMany({
    orderBy: { startAt: 'asc' },
    take: 30,
    include: {
      teacher: { include: { user: true } },
      enrollments: { include: { student: { include: { user: true } } } },
    },
  })

  const opsCode = typeof searchParams?.code === 'string' ? searchParams.code : ''

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Operación</p>
        <h1 className="page-title">Tablero operativo</h1>
        <p className="page-lead">
          {session.role === 'ADMIN'
            ? 'Vista global para dirección y operación académica.'
            : 'Vista del equipo operativo para primeras reservas, incidencias y seguimiento diario.'}
        </p>
        <div className="toolbar">
          <Link href="/admin/calendar" className="button-primary">Ver calendario</Link>
          <Link href="/admin/weekly-closing" className="button-ghost">Cierre semanal</Link>
          <Link href="/admin/incidents" className="button-ghost">Incidencias</Link>
          <Link href="/admin/reports" className="button-ghost">Abrir reportes</Link>
          <Link href="/admin/packages" className="button-ghost">Abrir libro de saldos</Link>
        </div>
      </section>

      {searchParams?.ops === 'created' ? <p className="status-success">Clase manual creada y saldo reservado correctamente.</p> : null}
      {searchParams?.ops === 'error' ? <p className="status-warning">{getOpsErrorMessage(opsCode)}</p> : null}

      <section className="kpi-grid">
        <article className="kpi-card">
          <span className="muted">Clases registradas</span>
          <strong>{total}</strong>
        </article>
        <article className="kpi-card">
          <span className="muted">Clases hoy</span>
          <strong>{todayCount}</strong>
        </article>
        <article className="kpi-card">
          <span className="muted">Casos pendientes</span>
          <strong>{pending + openIncidents + pendingNotifications + overdueCrm + pastClassesWithoutTeacherClose}</strong>
        </article>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <span className="muted">Alumnos sin profesor</span>
          <strong>{studentsWithoutTeacher}</strong>
        </article>
        <article className="kpi-card">
          <span className="muted">Paquetes por vencer 7d</span>
          <strong>{packagesExpiringSoon}</strong>
        </article>
        <article className="kpi-card">
          <span className="muted">Cancelaciones rechazadas</span>
          <strong>{recentDeniedCancellations.length}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Alertas operativas</p>
          <h2>Lo que hay que atacar primero</h2>
        </div>
        <div className="alert-grid">
          <Link href="/admin/incidents" className="alert-card">
            <strong>{openIncidents}</strong>
            <span>Incidencias abiertas/en revisión</span>
          </Link>
          <Link href="/admin/weekly-closing" className="alert-card">
            <strong>{pastClassesWithoutTeacherClose}</strong>
            <span>Clases pasadas sin cierre profesor</span>
          </Link>
          <Link href="/admin/crm" className="alert-card">
            <strong>{overdueCrm}</strong>
            <span>Seguimientos CRM vencidos</span>
          </Link>
          <Link href="/admin/notifications" className="alert-card">
            <strong>{pendingNotifications}</strong>
            <span>Notificaciones pendientes/reintento</span>
          </Link>
          <Link href="/admin/calendar" className="alert-card">
            <strong>{upcomingClassesWithoutMeet}</strong>
            <span>Clases próximas sin Meet</span>
          </Link>
        </div>
      </section>

      <section className="ops-grid">
        <section className="panel">
          <div className="card-header">
            <p className="eyebrow">Acción rápida</p>
            <h2>Crear clase manual</h2>
          </div>
          <form action={createManualClassAction} className="ops-form">
            <input type="hidden" name="redirectPath" value="/admin/dashboard" />
            <div className="stack-xs">
              <label htmlFor="title">Título</label>
              <input id="title" name="title" className="input" defaultValue="Clase TEATIME" />
            </div>
            <div className="stack-xs">
              <label htmlFor="teacherId">Profesor</label>
              <select id="teacherId" name="teacherId" className="select">
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="stack-xs">
              <label htmlFor="packageIds">Alumnos / paquetes</label>
              <select id="packageIds" name="packageIds" className="select multi-select" multiple>
                {activePackages.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.student.user.name} · {formatMinutesLabel(pack.totalMinutes - pack.usedMinutes - pack.reservedMinutes)} libres
                  </option>
                ))}
              </select>
              <p className="hint">Selecciona uno para 1:1 o varios para grupal.</p>
            </div>
            <div className="stack-xs">
              <label htmlFor="startAt">Inicio</label>
              <input id="startAt" name="startAt" type="datetime-local" className="input" />
            </div>
            <div className="stack-xs">
              <label htmlFor="durationMinutes">Duración</label>
              <select id="durationMinutes" name="durationMinutes" className="select" defaultValue="60">
                <option value="50">50 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
            <div className="stack-xs">
              <label htmlFor="classType">Tipo</label>
              <select id="classType" name="classType" className="select" defaultValue="ONE_ON_ONE">
                <option value="ONE_ON_ONE">1:1</option>
                <option value="GROUP">Grupal</option>
              </select>
            </div>
            <div className="stack-xs ops-span-2">
              <label htmlFor="meetUrl">Meet URL</label>
              <input id="meetUrl" name="meetUrl" className="input" placeholder="https://meet.google.com/..." />
            </div>
            <DirtySubmitButton className="ops-span-2">Crear clase y reservar saldo</DirtySubmitButton>
          </form>
        </section>

        <section className="panel table-panel">
          <div className="card-header">
            <p className="eyebrow">Incidencias</p>
            <h2>Lo que staff debe resolver</h2>
          </div>
          {recentDeniedCancellations.length ? (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Clase</th>
                  <th>Actor</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {recentDeniedCancellations.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.requestTime).toLocaleString('es-CO')}</td>
                    <td>{item.classEvent.title}</td>
                    <td>{item.requester.name}</td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">No hay cancelaciones rechazadas recientes.</div>
          )}
        </section>
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Hoy</p>
          <h2>Próximas clases y seguimiento</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Clase</th>
              <th>Profesor</th>
              <th>Alumno</th>
              <th>Inicio</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.title}</td>
                <td>{event.teacher.user.name}</td>
                <td>{event.enrollments.map((item) => item.student.user.name).join(', ') || 'Sin alumno'}</td>
                <td>{new Date(event.startAt).toLocaleString('es-CO')}</td>
                <td><span className="status-pill">{classStatusLabels[event.status] || event.status}</span></td>
                <td><Link href={`/admin/classes/${event.id}`}>Ver detalle</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
