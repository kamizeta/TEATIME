export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth'
import { formatPackageProgress, getPackageProgress, listBookableSlotsForStudent } from '@/lib/booking'
import { StudentBookingSlots } from '@/components/student-booking-slots'

export default async function StudentBookingPage() {
  const session = await getSession()
  if (!session || session.role !== 'STUDENT') return <p>Sin sesión</p>

  const { context, slots } = await listBookableSlotsForStudent(session.userId)
  if (!context) return <p>No encontramos profesor asignado o paquete activo para esta cuenta.</p>

  const packageProgress = getPackageProgress(
    context.package.totalMinutes,
    context.package.usedMinutes,
    context.package.reservedMinutes,
  )

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Reserva</p>
        <h1 className="page-title">Reservar próxima clase</h1>
        <p className="page-lead">
          Ya estás viendo slots calculados desde la disponibilidad del profesor asignado. La reserva se valida contra
          saldo, reglas y conflictos de agenda.
        </p>
      </section>

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Contexto</p>
          <h2>Reserva guiada del alumno</h2>
        </div>
        <div className="stack-md">
          <div className="metric-row">
            <span className="status-pill">Profesor asignado: {context.teacher.userName}</span>
            <span className="status-pill">Estado actual: {formatPackageProgress(context.package.totalMinutes, context.package.usedMinutes, context.package.reservedMinutes)}</span>
          </div>
          <StudentBookingSlots slots={slots} />
        </div>
      </section>
    </div>
  )
}
