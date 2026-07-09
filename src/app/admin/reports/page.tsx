export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatMinutesLabel } from '@/lib/booking'

export default async function AdminReports() {
  await requireRole(['ADMIN', 'STAFF'])

  const totalClasses = await prisma.classEvent.count()
  const canceledClasses = await prisma.classEvent.count({ where: { status: 'CANCELED' } })
  const deniedCancellations = await prisma.cancellation.count({ where: { wasAllowed: false } })
  const packages = await prisma.hourPackage.findMany()
  const activeTeachers = await prisma.teacher.findMany({
    include: {
      user: true,
      classEvents: true,
    },
    orderBy: { user: { name: 'asc' } },
  })

  const totalReservedMinutes = packages.reduce((sum, item) => sum + item.reservedMinutes, 0)
  const totalUsedMinutes = packages.reduce((sum, item) => sum + item.usedMinutes, 0)
  const totalAvailableMinutes = packages.reduce(
    (sum, item) => sum + (item.totalMinutes - item.usedMinutes - item.reservedMinutes),
    0
  )

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Reportes</p>
        <h1 className="page-title">Control de asistencia, cancelaciones y saldo</h1>
        <p className="page-lead">
          Esta vista ya sirve para bajar cierres operativos y revisar si la operación está consumiendo saldo, liberándolo
          o acumulando cancelaciones rechazadas.
        </p>
        <div className="toolbar">
          <a href="/api/reports/attendance/export" className="button-primary">Descargar asistencia CSV</a>
          <a href="/api/reports/packages/export" className="button-ghost">Descargar ledger CSV</a>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <span className="muted">Clases totales</span>
          <strong>{totalClasses}</strong>
        </article>
        <article className="kpi-card">
          <span className="muted">Clases canceladas</span>
          <strong>{canceledClasses}</strong>
        </article>
        <article className="kpi-card">
          <span className="muted">Cancelaciones rechazadas</span>
          <strong>{deniedCancellations}</strong>
        </article>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <span className="muted">Minutos reservados</span>
          <strong>{formatMinutesLabel(totalReservedMinutes)}</strong>
        </article>
        <article className="kpi-card">
          <span className="muted">Minutos consumidos</span>
          <strong>{formatMinutesLabel(totalUsedMinutes)}</strong>
        </article>
        <article className="kpi-card">
          <span className="muted">Minutos disponibles</span>
          <strong>{formatMinutesLabel(totalAvailableMinutes)}</strong>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Profesores</p>
          <h2>Carga actual por profesor</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Profesor</th>
              <th>Clases registradas</th>
              <th>Completadas</th>
              <th>Canceladas</th>
            </tr>
          </thead>
          <tbody>
            {activeTeachers.map((teacher) => (
              <tr key={teacher.id}>
                <td>{teacher.user.name}</td>
                <td>{teacher.classEvents.length}</td>
                <td>{teacher.classEvents.filter((event) => event.status === 'COMPLETED').length}</td>
                <td>{teacher.classEvents.filter((event) => event.status === 'CANCELED').length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Lectura rápida</p>
          <h2>Qué mirar esta semana</h2>
        </div>
        <div className="stack-md">
          <p className="hint">Si suben las cancelaciones rechazadas, staff está apagando incendios fuera de política.</p>
          <p className="hint">Si reservados crece y consumidos no, hay clases apartadas que no se están cerrando.</p>
          <p className="hint">Si disponibles cae demasiado sin compras nuevas, revisa ajustes manuales y cancelaciones.</p>
          <p className="hint">Si un profesor concentra todas las canceladas, ahí hay un problema de agenda o cumplimiento.</p>
        </div>
      </section>
    </div>
  )
}
