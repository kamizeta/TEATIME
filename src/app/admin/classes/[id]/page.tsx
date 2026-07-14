export const dynamic = "force-dynamic"

import { getSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatMinutesLabel } from '@/lib/booking'
import { closeClassAction } from '@/lib/actions/booking'
import { addStudentToClassAction, rescheduleClassAction, submitCancellationAction, syncClassWithGoogleAction } from '@/lib/actions'
import { DirtySubmitButton } from '@/components/dirty-submit-button'
import { attendanceStatusLabels, classStatusLabels, enrollmentStatusLabels } from '@/lib/display-labels'
import { ClassMeetSyncButton } from '@/components/class-meet-sync-button'

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function getOpsErrorMessage(code?: string) {
  if (code === 'TEACHER_TIME_CONFLICT') return 'El profesor ya tiene una clase en ese horario.'
  if (code === 'INSUFFICIENT_PACKAGE_BALANCE') return 'El paquete no tiene saldo suficiente para esa operación.'
  if (code === 'INVALID_START_AT') return 'La fecha y hora de inicio no es válida.'
  if (code === 'CLASS_NOT_EDITABLE') return 'La clase ya está cerrada o cancelada.'
  if (code === 'CLASS_CANCELED') return 'Una clase cancelada no se puede cerrar ni consumir.'
  if (code === 'CLASS_NOT_FINISHED') return 'La clase solo se puede cerrar después de su hora de finalización.'
  if (code === 'MISSING_ATTENDANCE') return 'Registra la asistencia de todos los alumnos antes de cerrar la clase.'
  if (code === 'CLASS_NOT_GROUP') return 'Solo puedes agregar alumnos manualmente a clases grupales.'
  if (code === 'GROUP_CLASS_FULL') return 'La clase grupal ya está llena.'
  if (code === 'STUDENT_ALREADY_BOOKED') return 'Ese alumno ya está inscrito en esta clase.'
  return 'No se pudo completar la operación.'
}

export default async function ClassDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const query = await searchParams
  const session = await getSession()
  const ev = await prisma.classEvent.findUnique({
    where: { id },
    include: {
      enrollments: {
        include: {
          student: { include: { user: true } },
          package: true,
          attendance: true,
        },
      },
      teacher: { include: { user: true } },
      instructorAttendance: true,
      cancellations: {
        include: {
          requester: true,
        },
        orderBy: { requestTime: 'desc' },
      },
    },
  })

  if (!ev) return notFound()

  const teachers = await prisma.teacher.findMany({
    include: { user: true },
    orderBy: { user: { name: 'asc' } },
  })
  const activePackages = await prisma.hourPackage.findMany({
    where: {
      status: 'ACTIVE',
      studentId: { notIn: ev.enrollments.map((enrollment) => enrollment.studentId) },
    },
    include: { student: { include: { user: true } } },
    orderBy: { validTo: 'asc' },
  })
  const opsCode = typeof query?.code === 'string' ? query.code : ''
  const isCanceled = ev.status === 'CANCELED'
  const isCompleted = ev.status === 'COMPLETED'

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Detalle de clase</p>
        <h1 className="page-title">{ev.title}</h1>
        <p className="page-lead">
          {new Date(ev.startAt).toLocaleString('es-CO')} - {new Date(ev.endAt).toLocaleString('es-CO')}
        </p>
        <div className="metric-row">
          <span className="status-pill">Estado: {classStatusLabels[ev.status] || ev.status}</span>
          <span className="status-pill">Duración: {formatMinutesLabel(ev.durationMinutes ?? 60)}</span>
          <span className="status-pill">Tipo: {ev.classType === 'GROUP' ? 'Grupal' : '1:1'}</span>
        </div>
        {!isCanceled ? (
        <div className="toolbar">
          <Link href={`/admin/classes/${ev.id}/attendance`} className="button-primary">
            {isCompleted ? 'Ver asistencia' : 'Registrar asistencia'}
          </Link>
          <Link href={`/classes/${ev.id}/history`} className="button-ghost">Historial, transcripción e informe</Link>
          </div>
        ) : null}
      </section>

      {query?.cancel === 'ok' ? (
        <p className="status-success">
          Cancelación procesada. {query?.override === '1' ? 'Se aplicó override operativo.' : 'Saldo liberado según regla.'}
        </p>
      ) : null}
      {query?.cancel === 'denied' ? (
        <p className="status-warning">
          Cancelación rechazada. La ventana mínima es de {query?.hours || '6'} horas para alumno o profesor.
        </p>
      ) : null}
      {query?.cancel === 'already' ? (
        <p className="status-success">La clase ya estaba cancelada. No se aplicaron cambios adicionales.</p>
      ) : null}
      {query?.ops === 'rescheduled' ? <p className="status-success">Clase reagendada y reservas ajustadas.</p> : null}
      {query?.ops === 'student_added' ? <p className="status-success">Alumno agregado a la clase grupal y saldo reservado.</p> : null}
      {query?.ops === 'google_synced' ? <p className="status-success">Clase sincronizada con Google Calendar/Meet.</p> : null}
      {query?.ops === 'google_failed' ? <p className="status-warning">No se pudo sincronizar con Google Calendar. Revisa ajustes o eventos de sync.</p> : null}
      {query?.ops === 'error' ? <p className="status-warning">{getOpsErrorMessage(opsCode)}</p> : null}

      <div className="class-detail-workspace">
        <div className="class-detail-primary">
          {!isCanceled && !isCompleted ? (
            <section className="panel class-detail-panel">
              <div className="card-header">
                <p className="eyebrow">Agenda</p>
                <h2>Reagendar clase</h2>
              </div>
              <form action={rescheduleClassAction} className="ops-form">
                <input type="hidden" name="classId" value={ev.id} />
                <input type="hidden" name="redirectPath" value={`/admin/classes/${ev.id}`} />
                <div className="stack-xs">
                  <label htmlFor="teacherId">Profesor</label>
                  <select id="teacherId" name="teacherId" className="select" defaultValue={ev.teacherId}>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>{teacher.user.name}</option>
                    ))}
                  </select>
                </div>
                <div className="stack-xs">
                  <label htmlFor="startAt">Inicio</label>
                  <input id="startAt" name="startAt" type="datetime-local" className="input" defaultValue={toDateTimeLocalValue(new Date(ev.startAt))} />
                </div>
                <div className="stack-xs">
                  <label htmlFor="durationMinutes">Duración</label>
                  <select id="durationMinutes" name="durationMinutes" className="select" defaultValue={String(ev.durationMinutes || 60)}>
                    <option value="50">50 min</option><option value="60">60 min</option><option value="90">90 min</option>
                  </select>
                </div>
                <div className="stack-xs">
                  <label htmlFor="meetUrl">Enlace de Meet</label>
                  <input id="meetUrl" name="meetUrl" className="input" defaultValue={ev.meetUrl || ''} />
                </div>
                <DirtySubmitButton className="ops-span-2">Guardar reprogramación</DirtySubmitButton>
              </form>
            </section>
          ) : null}

          {ev.classType === 'GROUP' && !isCanceled && !isCompleted ? (
            <section className="panel class-detail-panel">
              <div className="card-header"><p className="eyebrow">Grupo</p><h2>Agregar alumno</h2></div>
              <form action={addStudentToClassAction} className="ops-form">
                <input type="hidden" name="classId" value={ev.id} />
                <input type="hidden" name="redirectPath" value={`/admin/classes/${ev.id}`} />
                <div className="stack-xs ops-span-2">
                  <label htmlFor="packageId">Alumno / paquete</label>
                  <select id="packageId" name="packageId" className="select">
                    {activePackages.map((pack) => (
                      <option key={pack.id} value={pack.id}>{pack.student.user.name} · {formatMinutesLabel(pack.totalMinutes - pack.usedMinutes - pack.reservedMinutes)} libres</option>
                    ))}
                  </select>
                </div>
                <DirtySubmitButton className="ops-span-2">Agregar y reservar saldo</DirtySubmitButton>
              </form>
            </section>
          ) : null}

          <section className="panel table-panel class-detail-panel">
            <div className="card-header"><p className="eyebrow">Asistencia</p><h2>Asistencia y reserva</h2></div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Alumno</th><th>Paquete</th><th>Estado</th><th>Reservado</th><th>Consumido</th><th>Clase</th></tr></thead>
                <tbody>
                  {ev.enrollments.map((en) => (
                    <tr key={en.id}>
                      <td>{en.student.user.name}</td><td>{en.package.id.slice(0, 8)}</td><td>{attendanceStatusLabels[en.attendance?.status || 'pending'] || 'Pendiente'}</td>
                      <td>{formatMinutesLabel(en.reservedMinutes || ev.durationMinutes || 60)}</td><td>{formatMinutesLabel(en.consumedMinutes || 0)}</td><td>{enrollmentStatusLabels[en.status] || en.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="class-detail-aside">
          <section className="panel class-detail-panel">
            <div className="card-header"><p className="eyebrow">Operación</p><h2>Acciones de clase</h2></div>
            <div className="class-operational-data">
              <div><span>Google Calendar</span><strong>{ev.googleEventId ? 'Evento vinculado' : 'Pendiente de sincronizar'}</strong></div>
              <div><span>Enlace de Meet</span>{ev.meetUrl ? <a className="text-link" href={ev.meetUrl} target="_blank" rel="noreferrer">Abrir Meet</a> : <strong>Sin enlace</strong>}</div>
            </div>
            <div className="class-action-stack">
              {!isCanceled ? (
                <form action={syncClassWithGoogleAction}>
                  <input type="hidden" name="classId" value={ev.id} /><input type="hidden" name="redirectPath" value={`/admin/classes/${ev.id}`} />
                  <button type="submit" className="button-link">Sincronizar Google / Meet</button>
                </form>
              ) : null}
              {!isCanceled ? <ClassMeetSyncButton classId={ev.id} /> : null}
              <form action={closeClassAction}>
                <input type="hidden" name="classId" value={ev.id} />
                <button type="submit" className="button-ghost" disabled={isCompleted || isCanceled || ev.endAt.getTime() > Date.now()}>Cerrar clase y procesar saldo</button>
              </form>
            </div>
          </section>

          <section className="panel class-detail-panel">
            <div className="card-header"><p className="eyebrow">Cancelación</p><h2>Regla y override</h2></div>
            {isCanceled ? (
              <div className="terminal-class-note">
                <strong>Esta clase ya fue cancelada.</strong>
                <p>El saldo reservado fue liberado y no hay ninguna acción adicional por guardar.</p>
              </div>
            ) : isCompleted ? (
              <div className="terminal-class-note"><strong>La clase ya fue cerrada.</strong><p>Una clase completada no se puede cancelar.</p></div>
            ) : (
              <form action={submitCancellationAction} className="stack-md">
                <input type="hidden" name="classId" value={ev.id} /><input type="hidden" name="scope" value="CLASS" />
                <input type="hidden" name="redirectPath" value={`/admin/classes/${ev.id}`} />
                <div className="stack-xs">
                  <label htmlFor="reason">Motivo operativo</label>
                  <textarea id="reason" name="reason" className="textarea" defaultValue={session?.role === 'STAFF' ? 'Clase cancelada por el equipo operativo.' : 'Clase cancelada desde administración.'} />
                </div>
                <p className="hint">Alumno y profesor respetan la ventana mínima. El equipo operativo y el administrador pueden aplicar una excepción cuando la operación lo exige.</p>
                <button type="submit" className="button-ghost">Cancelar clase completa</button>
              </form>
            )}
          </section>
        </aside>
      </div>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Trazabilidad</p>
          <h2>Historial de cancelaciones</h2>
        </div>
        {ev.cancellations.length ? (
          <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Actor</th><th>Resultado</th><th>Motivo</th></tr></thead><tbody>{ev.cancellations.map((item) => (
            <tr key={item.id}><td>{new Date(item.requestTime).toLocaleString('es-CO')}</td><td>{item.requester.name}</td><td>{item.wasAllowed ? 'aprobada' : 'rechazada'}</td><td>{item.reason}</td></tr>
          ))}</tbody></table></div>
        ) : (
          <div className="empty-state">Todavía no hay cancelaciones registradas para esta clase.</div>
        )}
      </section>
    </div>
  )
}
