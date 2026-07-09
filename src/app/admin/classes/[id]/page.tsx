export const dynamic = "force-dynamic"

import { getSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatMinutesLabel } from '@/lib/booking'
import { closeClassAction } from '@/lib/actions/booking'
import { addStudentToClassAction, rescheduleClassAction, submitCancellationAction, syncClassWithGoogleAction } from '@/lib/actions'

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
  if (code === 'CLASS_NOT_GROUP') return 'Solo puedes agregar alumnos manualmente a clases grupales.'
  if (code === 'GROUP_CLASS_FULL') return 'La clase grupal ya está llena.'
  if (code === 'STUDENT_ALREADY_BOOKED') return 'Ese alumno ya está inscrito en esta clase.'
  return 'No se pudo completar la operación.'
}

export default async function ClassDetail({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getSession()
  const ev = await prisma.classEvent.findUnique({
    where: { id: params.id },
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
  const opsCode = typeof searchParams?.code === 'string' ? searchParams.code : ''

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Class detail</p>
        <h1 className="page-title">{ev.title}</h1>
        <p className="page-lead">
          {new Date(ev.startAt).toLocaleString('es-CO')} - {new Date(ev.endAt).toLocaleString('es-CO')}
        </p>
        <div className="metric-row">
          <span className="status-pill">Estado: {ev.status}</span>
          <span className="status-pill">Duración: {formatMinutesLabel(ev.durationMinutes ?? 60)}</span>
          <span className="status-pill">Tipo: {ev.classType === 'GROUP' ? 'Grupal' : '1:1'}</span>
        </div>
        <div className="toolbar">
          <Link href={`/admin/classes/${ev.id}/attendance`} className="button-primary">Registrar asistencia</Link>
        </div>
      </section>

      {searchParams?.cancel === 'ok' ? (
        <p className="status-success">
          Cancelación procesada. {searchParams?.override === '1' ? 'Se aplicó override operativo.' : 'Saldo liberado según regla.'}
        </p>
      ) : null}
      {searchParams?.cancel === 'denied' ? (
        <p className="status-warning">
          Cancelación rechazada. La ventana mínima es de {searchParams?.hours || '6'} horas para alumno o profesor.
        </p>
      ) : null}
      {searchParams?.ops === 'rescheduled' ? <p className="status-success">Clase reagendada y reservas ajustadas.</p> : null}
      {searchParams?.ops === 'student_added' ? <p className="status-success">Alumno agregado a la clase grupal y saldo reservado.</p> : null}
      {searchParams?.ops === 'google_synced' ? <p className="status-success">Clase sincronizada con Google Calendar/Meet.</p> : null}
      {searchParams?.ops === 'google_failed' ? <p className="status-warning">No se pudo sincronizar con Google Calendar. Revisa ajustes o eventos de sync.</p> : null}
      {searchParams?.ops === 'error' ? <p className="status-warning">{getOpsErrorMessage(opsCode)}</p> : null}

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Información</p>
          <h2>Datos operativos</h2>
        </div>
        <div className="stack-md">
          <p>Google Event ID: {ev.googleEventId || 'sin sincronizar'}</p>
          <p>
            Meet:{' '}
            {ev.meetUrl ? (
              <a className="text-link" href={ev.meetUrl} target="_blank" rel="noreferrer">
                {ev.meetUrl}
              </a>
            ) : (
              'sin link'
            )}
          </p>
          <form action={syncClassWithGoogleAction}>
            <input type="hidden" name="classId" value={ev.id} />
            <input type="hidden" name="redirectPath" value={`/admin/classes/${ev.id}`} />
            <button type="submit" className="button-link">Sincronizar Google/Meet</button>
          </form>
          <form action={closeClassAction}>
            <input type="hidden" name="classId" value={ev.id} />
            <button type="submit" className="button-ghost">Cerrar clase y consumir saldo</button>
          </form>
        </div>
      </section>

      <section className="panel">
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
                <option key={teacher.id} value={teacher.id}>
                  {teacher.user.name}
                </option>
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
              <option value="50">50 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
            </select>
          </div>
          <div className="stack-xs">
            <label htmlFor="meetUrl">Meet URL</label>
            <input id="meetUrl" name="meetUrl" className="input" defaultValue={ev.meetUrl || ''} />
          </div>
          <button type="submit" className="button-primary ops-span-2">Guardar reprogramación</button>
        </form>
      </section>

      {ev.classType === 'GROUP' ? (
        <section className="panel">
          <div className="card-header">
            <p className="eyebrow">Grupo</p>
            <h2>Agregar alumno</h2>
          </div>
          <form action={addStudentToClassAction} className="ops-form">
            <input type="hidden" name="classId" value={ev.id} />
            <input type="hidden" name="redirectPath" value={`/admin/classes/${ev.id}`} />
            <div className="stack-xs ops-span-2">
              <label htmlFor="packageId">Alumno / paquete</label>
              <select id="packageId" name="packageId" className="select">
                {activePackages.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.student.user.name} · {formatMinutesLabel(pack.totalMinutes - pack.usedMinutes - pack.reservedMinutes)} libres
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="button-ghost ops-span-2">Agregar y reservar saldo</button>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Cancelación</p>
          <h2>Regla y override</h2>
        </div>
        <form action={submitCancellationAction} className="stack-md">
          <input type="hidden" name="classId" value={ev.id} />
          <input type="hidden" name="scope" value="CLASS" />
          <input type="hidden" name="redirectPath" value={`/admin/classes/${ev.id}`} />
          <div className="stack-xs">
            <label htmlFor="reason">Motivo operativo</label>
            <textarea
              id="reason"
              name="reason"
              className="textarea"
              defaultValue={
                session?.role === 'STAFF'
                  ? 'Clase cancelada por staff desde operación.'
                  : 'Clase cancelada desde administración.'
              }
            />
          </div>
          <p className="hint">
            Alumno y profesor respetan la ventana mínima. Staff y admin pueden overridear cuando la operación lo exige.
          </p>
          <button type="submit" className="button-ghost">Cancelar clase completa</button>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Attendance</p>
          <h2>Asistencia y reserva</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Paquete</th>
              <th>Estado</th>
              <th>Reservado</th>
              <th>Consumido</th>
              <th>Clase</th>
            </tr>
          </thead>
          <tbody>
            {ev.enrollments.map((en) => (
              <tr key={en.id}>
                <td>{en.student.user.name}</td>
                <td>{en.package.id.slice(0, 8)}</td>
                <td>{en.attendance?.status || 'pendiente'}</td>
                <td>{formatMinutesLabel(en.reservedMinutes || ev.durationMinutes || 60)}</td>
                <td>{formatMinutesLabel(en.consumedMinutes || 0)}</td>
                <td>{en.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Trazabilidad</p>
          <h2>Historial de cancelaciones</h2>
        </div>
        {ev.cancellations.length ? (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actor</th>
                <th>Resultado</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {ev.cancellations.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.requestTime).toLocaleString('es-CO')}</td>
                  <td>{item.requester.name}</td>
                  <td>{item.wasAllowed ? 'aprobada' : 'rechazada'}</td>
                  <td>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">Todavía no hay cancelaciones registradas para esta clase.</div>
        )}
      </section>
    </div>
  )
}
