export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth'
import { formatPackageProgress, getPackageProgress, listBookableSlotsForStudent } from '@/lib/booking'
import { StudentBookingSlots } from '@/components/student-booking-slots'

const bookingMessages: Record<string, string> = {
  SLOT_NO_LONGER_AVAILABLE: 'Este cupo ya no est\\u00e1 disponible. Actualizamos los espacios para que elijas otro.',
  SLOT_ALREADY_TAKEN: 'Otro usuario reserv\\u00f3 este cupo antes. Elige uno de los espacios actualizados.',
  GROUP_CLASS_FULL: 'El cupo de esta clase grupal se acaba de llenar. Elige otro horario.',
  SLOT_TOKEN_EXPIRED: 'La disponibilidad se actualiz\\u00f3. Elige nuevamente un horario disponible.',
  SLOT_OUTSIDE_BOOKING_WINDOW: 'Este horario ya no cumple la anticipaci\\u00f3n m\\u00ednima de reserva.',
  INSUFFICIENT_PACKAGE_BALANCE: 'No tienes horas suficientes disponibles para reservar esta clase.',
}

export default async function StudentBookingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session || session.role !== 'STUDENT') return <p>Sin sesión</p>

  const params = searchParams ? await searchParams : {}
  const errorCode = typeof params.code === 'string' ? params.code : ''
  const bookingError = params.booking === 'error'
    ? bookingMessages[errorCode] ?? 'No fue posible reservar este cupo. Actualizamos la disponibilidad para que intentes nuevamente.'
    : null

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
          {bookingError ? <p className="booking-error-notice" role="alert">{bookingError}</p> : null}
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
