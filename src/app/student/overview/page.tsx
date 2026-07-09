export const dynamic = "force-dynamic"

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import Link from 'next/link'
import { formatMinutesLabel, getPrimaryBookingContextForUser } from '@/lib/booking'
import { submitCancellationAction } from '@/lib/actions'

export default async function StudentOverview({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
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

      {searchParams?.cancel === 'ok' ? (
        <p className="status-success">Tu clase fue cancelada y el saldo reservado quedó liberado para volver a reservar.</p>
      ) : null}
      {searchParams?.cancel === 'denied' ? (
        <p className="status-warning">
          Ya no puedes cancelar esa clase desde tu portal. La ventana mínima es de {searchParams?.hours || '6'} horas.
        </p>
      ) : null}

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
              <th>Estado clase</th>
              <th>Asistencia</th>
              <th>Saldo</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.classEvent.title}</td>
                <td>{new Date(row.classEvent.startAt).toLocaleString('es-CO')}</td>
                <td>{row.classEvent.status}</td>
                <td>{row.attendance?.status || 'pendiente'}</td>
                <td>{formatMinutesLabel(row.package.usedMinutes)}/{formatMinutesLabel(row.package.totalMinutes)}</td>
                <td>
                  {row.status !== 'CONFIRMED' || row.classEvent.status === 'CANCELED' || row.classEvent.status === 'COMPLETED' ? (
                    <span className="muted">Sin acción</span>
                  ) : (
                    <form action={submitCancellationAction}>
                      <input type="hidden" name="classId" value={row.classEventId} />
                      <input type="hidden" name="scope" value="SELF" />
                      <input type="hidden" name="redirectPath" value="/student/home" />
                      <input
                        type="hidden"
                        name="reason"
                        value="Clase cancelada por el alumno desde su portal para reprogramación."
                      />
                      <button type="submit" className="button-ghost">Cancelar y reprogramar</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
