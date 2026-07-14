export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DirtySubmitButton } from '@/components/dirty-submit-button'
import { AdminSchedule } from '@/components/admin-schedule'

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

function shiftWeek(date: Date, amount: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + amount * 7)
  return copy
}

function calendarHref(week: string, view: string, teacher: string, status: string) {
  const params = new URLSearchParams({ week, view })
  if (teacher) params.set('teacher', teacher)
  if (status) params.set('status', status)
  return `/admin/calendar?${params.toString()}`
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole(['ADMIN', 'STAFF'])
  const params = searchParams ? await searchParams : {}

  const requestedDate = typeof params.week === 'string' && params.week ? new Date(`${params.week}T00:00:00`) : new Date()
  const teacherFilter = typeof params.teacher === 'string' ? params.teacher : ''
  const statusFilter = typeof params.status === 'string' ? params.status : ''
  const view = params.view === 'list' ? 'list' : 'calendar'
  const weekStart = startOfWeek(isNaN(requestedDate.getTime()) ? new Date() : requestedDate)
  const weekEnd = endOfWeek(weekStart)

  const teachers = await prisma.teacher.findMany({
    include: { user: true },
    orderBy: { user: { name: 'asc' } },
  })
  const events = await prisma.classEvent.findMany({
    where: {
      startAt: { gte: weekStart, lte: weekEnd },
      ...(teacherFilter ? { teacherId: teacherFilter } : {}),
      ...(statusFilter ? { status: statusFilter as never } : {}),
    },
    include: {
      teacher: { include: { user: true } },
      enrollments: { include: { student: { include: { user: true } } } },
      cancellations: { orderBy: { requestTime: 'desc' }, take: 1 },
    },
    orderBy: { startAt: 'asc' },
  })

  const statusSummary = {
    scheduled: events.filter((event) => event.status === 'SCHEDULED' || event.status === 'RESERVED').length,
    canceled: events.filter((event) => event.status === 'CANCELED').length,
    completed: events.filter((event) => event.status === 'COMPLETED').length,
  }
  const weekValue = toDateInputValue(weekStart)
  const previousHref = calendarHref(toDateInputValue(shiftWeek(weekStart, -1)), view, teacherFilter, statusFilter)
  const nextHref = calendarHref(toDateInputValue(shiftWeek(weekStart, 1)), view, teacherFilter, statusFilter)
  const todayHref = calendarHref(toDateInputValue(new Date()), view, teacherFilter, statusFilter)

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Calendario operativo</p>
        <h1 className="page-title">Agenda TEATIME</h1>
        <p className="page-lead">La misma agenda semanal para toda la operación: navega por semanas, filtra carga y abre el detalle de cada clase.</p>
      </section>

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Filtros</p>
          <h2>Refina la agenda</h2>
        </div>
        <form className="calendar-filters">
          <input type="hidden" name="week" value={weekValue} />
          <input type="hidden" name="view" value={view} />
          <div className="stack-xs">
            <label htmlFor="teacher">Profesor</label>
            <select id="teacher" name="teacher" className="select" defaultValue={teacherFilter}>
              <option value="">Todos</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.user.name}</option>)}
            </select>
          </div>
          <div className="stack-xs">
            <label htmlFor="status">Estado</label>
            <select id="status" name="status" className="select" defaultValue={statusFilter}>
              <option value="">Todos</option>
              <option value="SCHEDULED">Programada</option>
              <option value="RESERVED">Reservada</option>
              <option value="COMPLETED">Finalizada</option>
              <option value="CANCELED">Cancelada</option>
            </select>
          </div>
          <div className="stack-xs">
            <label>&nbsp;</label>
            <DirtySubmitButton>Aplicar filtros</DirtySubmitButton>
          </div>
        </form>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card"><span className="muted">Activas esta semana</span><strong>{statusSummary.scheduled}</strong></article>
        <article className="kpi-card"><span className="muted">Canceladas</span><strong>{statusSummary.canceled}</strong></article>
        <article className="kpi-card"><span className="muted">Cerradas</span><strong>{statusSummary.completed}</strong></article>
      </section>

      <AdminSchedule
        weekStart={weekValue}
        initialView={view}
        previousHref={previousHref}
        nextHref={nextHref}
        todayHref={todayHref}
        classes={events.map((event) => ({
          id: event.id,
          title: event.title,
          startAt: event.startAt.toISOString(),
          endAt: event.endAt.toISOString(),
          teacherName: event.teacher.user.name,
          students: event.enrollments.filter((item) => item.status === 'CONFIRMED').map((item) => item.student.user.name),
          status: event.status,
          meetReady: Boolean(event.meetUrl),
          hasCancellation: event.cancellations.length > 0,
        }))}
      />
    </div>
  )
}
