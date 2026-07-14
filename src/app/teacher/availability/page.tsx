export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getWeekdayLabel } from '@/lib/booking'
import { saveAvailabilityBlockAction } from '@/lib/actions/booking'
import { DirtySubmitButton } from '@/components/dirty-submit-button'
import { AvailabilityDeleteButton } from '@/components/availability-delete-button'

function getAvailabilityMessage(code: string) {
  const messages: Record<string, string> = {
    AVAILABILITY_OVERLAPS_EXISTING: 'Ya tienes un bloque activo que se cruza con este horario. Elimina o modifica el bloque existente antes de crear otro.',
    INVALID_AVAILABILITY_RANGE: 'La hora de fin debe ser posterior a la hora de inicio.',
  }
  return messages[code] || 'No fue posible guardar el bloque. Revisa los datos e int\u00e9ntalo nuevamente.'
}

export default async function TeacherAvailabilityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session || session.role !== 'TEACHER') return <p>Sin sesión docente</p>

  const params = searchParams ? await searchParams : {}
  const availabilityResult = typeof params.availability === 'string' ? params.availability : ''
  const availabilityCode = typeof params.code === 'string' ? params.code : ''

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.userId },
    include: {
      availabilityBlocks: {
        where: { isActive: true },
        orderBy: [{ weekday: 'asc' }, { startLocalTime: 'asc' }],
      },
    },
  })

  if (!teacher) return <p>Docente no registrado</p>

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Disponibilidad</p>
        <h1 className="page-title">Mi disponibilidad</h1>
        <p className="page-lead">
          Publica aquí los bloques desde los que el alumno podrá reservar. Este es ya el primer editor funcional del
          sistema de self-scheduling.
        </p>
      </section>

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Nuevo bloque</p>
          <h2>Agregar disponibilidad</h2>
        </div>
        {availabilityResult === 'created' ? <p className="status-success">Bloque de disponibilidad publicado.</p> : null}
        {availabilityResult === 'error' ? <p className="status-warning">{getAvailabilityMessage(availabilityCode)}</p> : null}
        <form action={saveAvailabilityBlockAction} className="stack-md">
          <div className="kpi-grid">
            <div className="stack-xs">
              <label htmlFor="weekday">Día</label>
              <select id="weekday" name="weekday" className="input" defaultValue="1">
                <option value="1">Lunes</option>
                <option value="2">Martes</option>
                <option value="3">Miércoles</option>
                <option value="4">Jueves</option>
                <option value="5">Viernes</option>
                <option value="6">Sábado</option>
                <option value="0">Domingo</option>
              </select>
            </div>
            <div className="stack-xs">
              <label htmlFor="startLocalTime">Hora inicio</label>
              <input id="startLocalTime" name="startLocalTime" type="time" className="input" defaultValue="08:00" />
            </div>
            <div className="stack-xs">
              <label htmlFor="endLocalTime">Hora fin</label>
              <input id="endLocalTime" name="endLocalTime" type="time" className="input" defaultValue="11:00" />
            </div>
          </div>

          <div className="kpi-grid">
            <div className="stack-xs">
              <label htmlFor="durationMinutes">Duración</label>
              <select id="durationMinutes" name="durationMinutes" className="input" defaultValue="60">
                <option value="50">50 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
            <div className="stack-xs">
              <label htmlFor="classType">Tipo</label>
              <select id="classType" name="classType" className="input" defaultValue="ONE_ON_ONE">
                <option value="ONE_ON_ONE">1:1</option>
                <option value="GROUP">Grupal</option>
              </select>
            </div>
            <div className="stack-xs">
              <label htmlFor="capacity">Cupo</label>
              <input id="capacity" name="capacity" type="number" min="1" max="12" className="input" defaultValue="1" />
            </div>
          </div>

          <div className="toolbar">
            <DirtySubmitButton>Guardar bloque</DirtySubmitButton>
          </div>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Bloques activos</p>
          <h2>Disponibilidad publicada</h2>
        </div>
        {availabilityResult === 'deleted' ? (
          <p className="status-success">Bloque eliminado de las futuras reservas.</p>
        ) : null}
        {teacher.availabilityBlocks.length ? (
          <table>
            <thead>
              <tr>
                <th>Día</th>
                <th>Horario</th>
                <th>Duración</th>
                <th>Tipo</th>
                <th>Cupo</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {teacher.availabilityBlocks.map((block) => (
                <tr key={block.id}>
                  <td>{getWeekdayLabel(block.weekday)}</td>
                  <td>{block.startLocalTime} - {block.endLocalTime}</td>
                  <td>{block.durationMinutes} min</td>
                  <td>{block.classType === 'ONE_ON_ONE' ? '1:1' : 'Grupal'}</td>
                  <td>{block.capacity}</td>
                  <td>
                    <AvailabilityDeleteButton blockId={block.id} redirectPath="/teacher/availability" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">Todavía no has publicado bloques de disponibilidad.</div>
        )}
      </section>
    </div>
  )
}
