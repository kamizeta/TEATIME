export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { markWeeklyClosingReviewedAction } from '@/lib/actions'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getWeekBounds(raw?: string) {
  const base = raw ? new Date(`${raw}T00:00:00`) : new Date()
  const day = base.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const weekStart = new Date(base)
  weekStart.setDate(base.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return { weekStart, weekEnd }
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default async function WeeklyClosingPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN' && session.role !== 'STAFF') redirect('/')

  const selectedWeek = typeof searchParams?.week === 'string' ? searchParams.week : undefined
  const { weekStart, weekEnd } = getWeekBounds(selectedWeek)
  const closing = await prisma.weeklyClosing.findUnique({
    where: { weekStart },
    include: { reviewedBy: true },
  })

  const classes = await prisma.classEvent.findMany({
    where: { startAt: { gte: weekStart, lte: weekEnd } },
    include: {
      teacher: { include: { user: true } },
      instructorAttendance: true,
      attendanceRecords: true,
      enrollments: { include: { student: { include: { user: true } }, attendance: true } },
      cancellations: true,
    },
    orderBy: { startAt: 'asc' },
  })

  const now = new Date()
  const pastClasses = classes.filter((item) => item.endAt < now && item.status !== 'CANCELED')
  const missingTeacherAttendance = pastClasses.filter((item) => !item.instructorAttendance)
  const missingStudentAttendance = pastClasses.filter((item) =>
    item.enrollments.some((enrollment) => enrollment.status === 'CONFIRMED' && !enrollment.attendance)
  )
  const lateCancellations = classes.flatMap((item) =>
    item.cancellations.filter((cancellation) => !cancellation.wasAllowed).map((cancellation) => ({ classEvent: item, cancellation }))
  )
  const packagesWithMismatch = await prisma.hourPackage.findMany({
    where: {
      OR: [
        { usedMinutes: { lt: 0 } },
        { reservedMinutes: { lt: 0 } },
        { totalMinutes: { lt: 0 } },
      ],
    },
    include: { student: { include: { user: true } } },
  })

  const openIncidents = await prisma.incident.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } })
  const operationalScore =
    missingTeacherAttendance.length + missingStudentAttendance.length + lateCancellations.length + packagesWithMismatch.length + openIncidents

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Cierre semanal</p>
        <h1 className="page-title">Semana {ymd(weekStart)} a {ymd(weekEnd)}</h1>
        <p className="page-lead">
          Esta pantalla reemplaza el Excel del lunes: muestra lo que falta cerrar antes de confiar en saldos y asistencia.
        </p>
        <form className="toolbar" action="/admin/weekly-closing">
          <input name="week" type="date" className="input" defaultValue={ymd(weekStart)} />
          <button className="button-primary" type="submit">Cambiar semana</button>
          <Link className="button-ghost" href={`/api/reports/weekly-closing/export?week=${ymd(weekStart)}`}>Export CSV</Link>
        </form>
      </section>

      {searchParams?.closing === 'reviewed' ? <p className="status-success">Semana marcada como revisada.</p> : null}
      {closing?.status === 'REVIEWED' ? (
        <p className="status-success">
          Semana revisada por {closing.reviewedBy?.name || 'staff'} el {closing.reviewedAt?.toLocaleString('es-CO')}.
        </p>
      ) : null}

      <section className="kpi-grid">
        <article className="kpi-card"><span>Clases semana</span><strong>{classes.length}</strong></article>
        <article className="kpi-card"><span>Faltan cierre profesor</span><strong>{missingTeacherAttendance.length}</strong></article>
        <article className="kpi-card"><span>Faltan asistencia alumno</span><strong>{missingStudentAttendance.length}</strong></article>
      </section>
      <section className="kpi-grid">
        <article className="kpi-card"><span>Cancelaciones tardías</span><strong>{lateCancellations.length}</strong></article>
        <article className="kpi-card"><span>Incidencias abiertas</span><strong>{openIncidents}</strong></article>
        <article className="kpi-card"><span>Riesgo operativo</span><strong>{operationalScore}</strong></article>
      </section>

      <div className="settings-grid">
        <section className="panel">
          <div className="card-header">
            <p className="eyebrow">Checklist</p>
            <h2>Marcar semana revisada</h2>
          </div>
          <form action={markWeeklyClosingReviewedAction} className="stack-md">
            <input type="hidden" name="redirectPath" value="/admin/weekly-closing" />
            <input type="hidden" name="week" value={ymd(weekStart)} />
            <textarea
              name="summary"
              className="textarea"
              rows={4}
              defaultValue={closing?.summary || ''}
              placeholder="Notas del cierre: reclamos, ajustes, decisiones..."
            />
            <button type="submit" className="button-primary">Marcar revisada</button>
          </form>
        </section>
        <section className="panel">
          <div className="card-header">
            <p className="eyebrow">Decisión</p>
            <h2>{operationalScore === 0 ? 'Semana limpia' : 'Semana con pendientes'}</h2>
          </div>
          <p className="page-lead">
            Si el riesgo operativo es mayor a cero, no deberías cerrar contablemente ni actualizar saldos definitivos sin revisar.
          </p>
          <div className="inline-actions">
            <Link href="/admin/incidents" className="button-link">Resolver incidencias</Link>
            <Link href="/admin/reports" className="button-ghost">Reportes</Link>
          </div>
        </section>
      </div>

      <section className="panel table-panel">
        <div className="card-header"><p className="eyebrow">Pendientes</p><h2>Clases con problemas de cierre</h2></div>
        <table>
          <thead><tr><th>Clase</th><th>Profesor</th><th>Inicio</th><th>Problema</th><th>Acción</th></tr></thead>
          <tbody>
            {[...missingTeacherAttendance, ...missingStudentAttendance].map((classEvent) => (
              <tr key={`${classEvent.id}-${classEvent.instructorAttendance ? 'student' : 'teacher'}`}>
                <td>{classEvent.title}</td>
                <td>{classEvent.teacher.user.name}</td>
                <td>{classEvent.startAt.toLocaleString('es-CO')}</td>
                <td>{!classEvent.instructorAttendance ? 'Profesor sin cierre' : 'Alumno sin asistencia'}</td>
                <td><Link className="text-link" href={`/admin/classes/${classEvent.id}`}>Ver clase</Link></td>
              </tr>
            ))}
            {!missingTeacherAttendance.length && !missingStudentAttendance.length ? (
              <tr><td colSpan={5}>No hay clases pendientes de cierre en esta semana.</td></tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  )
}
