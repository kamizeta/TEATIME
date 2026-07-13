export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DirtySubmitButton } from '@/components/dirty-submit-button'

function startOfWeek(date: Date) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfWeek(start: Date) {
  const copy = new Date(start)
  copy.setDate(copy.getDate() + 6)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDayKey(date: Date) {
  return toDateInputValue(date)
}

function getWeekLabel(start: Date, end: Date) {
  return `${start.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString(
    'es-CO',
    { day: 'numeric', month: 'short', year: 'numeric' }
  )}`
}

const dayFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
})

const hourFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
})

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  await requireRole(['ADMIN', 'STAFF'])

  const requestedDate =
    typeof searchParams?.week === 'string' && searchParams.week ? new Date(`${searchParams.week}T00:00:00`) : new Date()
  const teacherFilter = typeof searchParams?.teacher === 'string' ? searchParams.teacher : ''
  const statusFilter = typeof searchParams?.status === 'string' ? searchParams.status : ''

  const weekStart = startOfWeek(isNaN(requestedDate.getTime()) ? new Date() : requestedDate)
  const weekEnd = endOfWeek(weekStart)
  const prevWeek = new Date(weekStart)
  prevWeek.setDate(prevWeek.getDate() - 7)
  const nextWeek = new Date(weekStart)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const teachers = await prisma.teacher.findMany({
    include: { user: true },
    orderBy: { user: { name: 'asc' } },
  })

  const events = await prisma.classEvent.findMany({
    where: {
      startAt: { gte: weekStart, lte: weekEnd },
      ...(teacherFilter ? { teacherId: teacherFilter } : {}),
      ...(statusFilter ? { status: statusFilter as any } : {}),
    },
    include: {
      teacher: { include: { user: true } },
      enrollments: {
        include: {
          student: { include: { user: true } },
          attendance: true,
        },
      },
      cancellations: {
        orderBy: { requestTime: 'desc' },
        take: 1,
      },
    },
    orderBy: { startAt: 'asc' },
  })

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + index)
    const key = getDayKey(date)
    return {
      key,
      date,
      label: dayFormatter.format(date),
      items: events.filter((event) => getDayKey(new Date(event.startAt)) === key),
    }
  })

  const statusSummary = {
    scheduled: events.filter((event) => event.status === 'SCHEDULED' || event.status === 'RESERVED').length,
    canceled: events.filter((event) => event.status === 'CANCELED').length,
    completed: events.filter((event) => event.status === 'COMPLETED').length,
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Calendario operativo</p>
        <h1 className="page-title">Semana de operación TEATIME</h1>
        <p className="page-lead">
          Aquí staff y admin ven la carga semanal, filtran por profesor y detectan rápido clases canceladas, reservas
          activas y huecos operativos.
        </p>
        <div className="toolbar">
          <Link href={`/admin/calendar?week=${toDateInputValue(prevWeek)}&teacher=${teacherFilter}&status=${statusFilter}`} className="button-ghost">
            Semana anterior
          </Link>
          <Link href={`/admin/calendar?week=${toDateInputValue(new Date())}`} className="button-primary">
            Ir a semana actual
          </Link>
          <Link href={`/admin/calendar?week=${toDateInputValue(nextWeek)}&teacher=${teacherFilter}&status=${statusFilter}`} className="button-ghost">
            Semana siguiente
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Filtros</p>
          <h2>{getWeekLabel(weekStart, weekEnd)}</h2>
        </div>
        <form className="calendar-filters">
          <div className="stack-xs">
            <label htmlFor="week">Semana</label>
            <input id="week" name="week" type="date" className="input" defaultValue={toDateInputValue(weekStart)} />
          </div>
          <div className="stack-xs">
            <label htmlFor="teacher">Profesor</label>
            <select id="teacher" name="teacher" className="select" defaultValue={teacherFilter}>
              <option value="">Todos</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="stack-xs">
            <label htmlFor="status">Estado</label>
            <select id="status" name="status" className="select" defaultValue={statusFilter}>
              <option value="">Todos</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="RESERVED">Reserved</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>
          <div className="stack-xs">
            <label>&nbsp;</label>
            <DirtySubmitButton>Aplicar filtros</DirtySubmitButton>
          </div>
        </form>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <span className="muted">Activas esta semana</span>
          <strong>{statusSummary.scheduled}</strong>
        </article>
        <article className="kpi-card">
          <span className="muted">Canceladas</span>
          <strong>{statusSummary.canceled}</strong>
        </article>
        <article className="kpi-card">
          <span className="muted">Cerradas</span>
          <strong>{statusSummary.completed}</strong>
        </article>
      </section>

      <section className="calendar-board" aria-label="Calendario semanal">
        {days.map((day) => (
          <article key={day.key} className="calendar-column">
            <header className="calendar-day-header">
              <div>
                <p className="calendar-weekday">{day.date.toLocaleDateString('es-CO', { weekday: 'short' })}</p>
                <h2>{day.date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</h2>
              </div>
              <span className="status-pill">{day.items.length} clases</span>
            </header>

            {day.items.length ? (
              <div className="calendar-events">
                {day.items.map((event) => {
                  const studentNames = event.enrollments
                    .filter((enrollment) => enrollment.status === 'CONFIRMED')
                    .map((enrollment) => enrollment.student.user.name)
                  const lastCancellation = event.cancellations[0]

                  return (
                    <Link
                      key={event.id}
                      href={`/admin/classes/${event.id}`}
                      className={`calendar-event-card calendar-event-${event.status.toLowerCase()}`}
                    >
                      <div className="calendar-event-top">
                        <strong>{hourFormatter.format(new Date(event.startAt))}</strong>
                        <span className="status-pill">{event.status}</span>
                      </div>
                      <h3>{event.title}</h3>
                      <p className="muted">Prof. {event.teacher.user.name}</p>
                      <p className="muted">{studentNames.length ? studentNames.join(', ') : 'Sin alumnos confirmados'}</p>
                      <p className={event.meetUrl ? 'calendar-meet-ok' : 'calendar-meet-missing'}>
                        {event.meetUrl ? 'Meet listo' : 'Sin Meet'}
                      </p>
                      {lastCancellation ? (
                        <p className="calendar-flag">
                          Última cancelación: {lastCancellation.wasAllowed ? 'aprobada' : 'rechazada'}
                        </p>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="calendar-empty">Sin clases</div>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}
