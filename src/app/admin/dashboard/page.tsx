export const dynamic = "force-dynamic"

import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function AdminDashboard() {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const total = await prisma.classEvent.count()
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

  const todayCount = await prisma.classEvent.count({
    where: { startAt: { gte: start, lte: end } },
  })

  const pending = await prisma.attendanceRecord.count({ where: { status: 'no_show' } })
  const events = await prisma.classEvent.findMany({
    orderBy: { startAt: 'asc' },
    take: 30,
  })

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Operations</p>
        <h1 className="page-title">Tablero operativo</h1>
        <p className="page-lead">
          {session.role === 'ADMIN'
            ? 'Vista global para dirección y operación académica.'
            : 'Vista operativa de staff para primeras reservas, incidencias y seguimiento diario.'}
        </p>
        <div className="toolbar">
          <Link href="/admin/calendar" className="button-primary">Ver calendario</Link>
          <Link href="/admin/reports" className="button-ghost">Abrir reportes</Link>
        </div>
      </section>

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
          <strong>{pending}</strong>
        </article>
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
              <th>Inicio</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.title}</td>
                <td>{new Date(event.startAt).toLocaleString('es-CO')}</td>
                <td><span className="status-pill">{event.status}</span></td>
                <td><Link href={`/admin/classes/${event.id}`}>Ver detalle</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
