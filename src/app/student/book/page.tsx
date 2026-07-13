export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth'
import { bookSlotAction } from '@/lib/actions/booking'
import { formatPackageProgress, getPackageProgress, listBookableSlotsForStudent } from '@/lib/booking'

export default async function StudentBookingPage() {
  const session = await getSession()
  if (!session || session.role !== 'STUDENT') return <p>Sin sesión</p>

  const { context, slots } = await listBookableSlotsForStudent(session.userId)
  if (!context) return <p>No encontramos profesor asignado o paquete activo para esta cuenta.</p>

  const groupedSlots = slots.reduce<Record<string, typeof slots>>((acc, slot) => {
    const dateKey = new Date(slot.startsAtIso).toLocaleDateString('es-CO', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    acc[dateKey] ||= []
    acc[dateKey].push(slot)
    return acc
  }, {})

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
          {slots.length ? (
            Object.entries(groupedSlots).map(([day, daySlots]) => (
              <div key={day} className="panel">
                <div className="card-header">
                  <p className="eyebrow">Disponibilidad</p>
                  <h3>{day}</h3>
                </div>
                <div className="toolbar">
                  {daySlots.map((slot) => (
                    <form key={slot.token} action={bookSlotAction}>
                      <input type="hidden" name="slotToken" value={slot.token} />
                      <button type="submit" className="button-ghost">
                        {new Date(slot.startsAtIso).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' · '}
                        {slot.classType === 'ONE_ON_ONE' ? '1:1' : `Grupal (${slot.availableSeats})`}
                        {' · '}
                        {slot.durationMinutes} min
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              No hay slots reservables con la configuración actual. Revisa saldo, aviso mínimo o bloques de disponibilidad.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
