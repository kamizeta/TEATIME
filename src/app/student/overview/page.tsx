export const dynamic = "force-dynamic"

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import Link from 'next/link'
import { formatPackageProgress, getPackageProgress, getPrimaryBookingContextForUser } from '@/lib/booking'
import { submitCancellationAction } from '@/lib/actions'

const classStatusLabels: Record<string, string> = {
  SCHEDULED: 'Programada',
  RESERVED: 'Reservada',
  COMPLETED: 'Finalizada',
  CANCELED: 'Cancelada',
}

const attendanceLabels: Record<string, string> = {
  attended: 'Asistió',
  absent: 'Ausente',
  late: 'Llegó tarde',
  no_show: 'No se presentó',
}

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
  const packageProgress = bookingContext
    ? getPackageProgress(
        bookingContext.package.totalMinutes,
        bookingContext.package.usedMinutes,
        bookingContext.package.reservedMinutes,
      )
    : null

  return (
    <div className="page-stack">
      <section className="hero student-plan-hero">
        <div className="student-plan-copy">
          <p className="eyebrow">Alumno</p>
          <h1 className="page-title">Tu plan de clases</h1>
          <p className="page-lead">Consulta el estado actual de tus clases y tu paquete.</p>
          <div className="toolbar">
            <Link href="/student/book" className="button-primary">Reservar clase</Link>
          </div>
        </div>
        {bookingContext && packageProgress ? (
          <aside className="student-plan-summary" aria-label="Resumen del plan de clases">
            <div className="student-summary-card">
              <span>Profesor asignado</span>
              <strong>{bookingContext.teacher.userName}</strong>
            </div>
            <div className="student-summary-card student-summary-trace">
              <span>Estado actual</span>
              <strong>{formatPackageProgress(
                bookingContext.package.totalMinutes,
                bookingContext.package.usedMinutes,
                bookingContext.package.reservedMinutes,
              )}</strong>
            </div>
          </aside>
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
              <th>Estado actual</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const trace = formatPackageProgress(row.package.totalMinutes, row.package.usedMinutes, row.package.reservedMinutes)
              return (
                <tr key={row.id}>
                  <td>{row.classEvent.title}</td>
                  <td>{new Date(row.classEvent.startAt).toLocaleString('es-CO')}</td>
                  <td>{classStatusLabels[row.classEvent.status] || row.classEvent.status}</td>
                  <td>{row.attendance?.status ? attendanceLabels[row.attendance.status] || row.attendance.status : 'Pendiente'}</td>
                  <td>
                    <strong>{trace}</strong>
                  </td>
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
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
