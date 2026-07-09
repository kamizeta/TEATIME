export const dynamic = "force-dynamic"

import { getSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatMinutesLabel } from '@/lib/booking'
import { closeClassAction } from '@/lib/actions/booking'
import { submitCancellationAction } from '@/lib/actions'

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

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Información</p>
          <h2>Datos operativos</h2>
        </div>
        <div className="stack-md">
          <p>Meet: {ev.meetUrl || 'sin link'}</p>
          <form action={closeClassAction}>
            <input type="hidden" name="classId" value={ev.id} />
            <button type="submit" className="button-ghost">Cerrar clase y consumir saldo</button>
          </form>
        </div>
      </section>

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
