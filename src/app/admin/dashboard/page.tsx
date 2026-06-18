export const dynamic = "force-dynamic"

import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function AdminDashboard() {
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
    <div>
      <h1>Dashboard Admin</h1>
      <p>Total clases: {total} | Hoy: {todayCount} | Pendientes: {pending}</p>
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link href="/admin/calendar">Calendario</Link>
        <Link href="/admin/packages">Paquetes</Link>
        <Link href="/admin/reports">Reportes</Link>
        <Link href="/admin/settings">Ajustes</Link>
      </nav>
      <h2>Clases</h2>
      <table>
        <thead>
          <tr><th>Clase</th><th>Inicio</th><th>Estado</th><th>Acción</th></tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.title}</td>
              <td>{new Date(e.startAt).toLocaleString()}</td>
              <td>{e.status}</td>
              <td><Link href={`/admin/classes/${e.id}`}>Ver</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
