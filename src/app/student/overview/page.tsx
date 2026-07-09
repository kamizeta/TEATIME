export const dynamic = "force-dynamic"

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import Link from 'next/link'
import { formatMinutesLabel, getPrimaryBookingContextForUser } from '@/lib/booking'

export default async function StudentOverview() {
  const session = await getSession()
  if (!session || session.role !== 'STUDENT') return <p>Sin sesión</p>

  const student = await prisma.student.findUnique({ where: { userId: session.userId } })
  if (!student) return <p>Perfil no encontrado</p>

  const rows = await prisma.classEnrollment.findMany({
    where: { studentId: student.id },
    include: {
      classEvent: true,
      attendance: true,
      package: true,
    },
    orderBy: { classEvent: { startAt: 'asc' } }
  })
  const bookingContext = await getPrimaryBookingContextForUser(session.userId)
  const remainingMinutes = bookingContext
    ? bookingContext.package.totalMinutes - bookingContext.package.usedMinutes - bookingContext.package.reservedMinutes
    : 0

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Student</p>
        <h1 className="page-title">Tu plan de clases</h1>
        <p className="page-lead">Aquí vas a ver tu saldo, tu agenda y luego vas a reservar tus siguientes espacios.</p>
        <div className="toolbar">
          <Link href="/student/book" className="button-primary">Reservar clase</Link>
          <Link href="/student/home" className="button-ghost">Volver a inicio</Link>
        </div>
        {bookingContext ? (
          <div className="metric-row">
            <span className="status-pill">Profesor asignado: {bookingContext.teacher.userName}</span>
            <span className="status-pill">Saldo disponible: {formatMinutesLabel(remainingMinutes)}</span>
          </div>
        ) : null}
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Historial</p>
          <h2>Clases y saldo</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Clase</th>
              <th>Inicio</th>
              <th>Asistencia</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.classEvent.title}</td>
                <td>{new Date(row.classEvent.startAt).toLocaleString('es-CO')}</td>
                <td>{row.attendance?.status || 'pendiente'}</td>
                <td>{row.package.usedHours}/{row.package.totalHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
