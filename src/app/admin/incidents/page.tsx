export const dynamic = 'force-dynamic'

import { IncidentSeverity, IncidentStatus, IncidentType } from '@prisma/client'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createIncidentAction, updateIncidentAction } from '@/lib/actions'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const typeLabels: Record<IncidentType, string> = {
  MISSING_ATTENDANCE: 'Asistencia faltante',
  LATE_CANCELLATION: 'Cancelación tardía',
  PACKAGE_MISMATCH: 'Saldo inconsistente',
  CALENDAR_CONFLICT: 'Conflicto calendario',
  TEACHER_ABSENT: 'Profesor ausente',
  STUDENT_CLAIM: 'Reclamo alumno',
  OTHER: 'Otro',
}

const severityLabels: Record<IncidentSeverity, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const statusLabels: Record<IncidentStatus, string> = {
  OPEN: 'Abierta',
  IN_REVIEW: 'En revisión',
  RESOLVED: 'Resuelta',
  DISMISSED: 'Descartada',
}

function getMessage(code: string) {
  const messages: Record<string, string> = {
    MISSING_INCIDENT_TITLE: 'Falta el título de la incidencia.',
    MISSING_INCIDENT_ID: 'Falta la incidencia.',
    INCIDENT_NOT_FOUND: 'La incidencia no existe.',
  }
  return messages[code] || 'No se pudo completar la acción.'
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN' && session.role !== 'STAFF') redirect('/')

  const selectedStatus = typeof searchParams?.status === 'string' ? searchParams.status : ''
  const incidentResult = typeof searchParams?.incident === 'string' ? searchParams.incident : ''
  const code = typeof searchParams?.code === 'string' ? searchParams.code : ''

  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'STAFF'] }, isActive: true },
    orderBy: { name: 'asc' },
  })
  const classes = await prisma.classEvent.findMany({
    orderBy: { startAt: 'desc' },
    take: 30,
    include: { teacher: { include: { user: true } }, enrollments: { include: { student: { include: { user: true } } } } },
  })
  const incidents = await prisma.incident.findMany({
    where: selectedStatus && selectedStatus in IncidentStatus ? { status: selectedStatus as IncidentStatus } : undefined,
    include: {
      classEvent: true,
      reportedBy: true,
      assignedTo: true,
    },
    orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  })
  const counts = await prisma.incident.groupBy({ by: ['status'], _count: { _all: true } })
  const countByStatus = new Map(counts.map((item) => [item.status, item._count._all]))

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Centro de incidencias</p>
        <h1 className="page-title">Lo que no puede perderse en WhatsApp</h1>
        <p className="page-lead">
          Registra problemas de asistencia, cancelaciones, saldos y reclamos. Si no queda aquí, no existe para cierre.
        </p>
      </section>

      {incidentResult === 'created' ? <p className="status-success">Incidencia creada.</p> : null}
      {incidentResult === 'updated' ? <p className="status-success">Incidencia actualizada.</p> : null}
      {incidentResult === 'error' ? <p className="status-warning">{getMessage(code)}</p> : null}

      <section className="kpi-grid">
        {Object.values(IncidentStatus).map((status) => (
          <Link key={status} href={`/admin/incidents?status=${status}`} className="kpi-card">
            <span>{statusLabels[status]}</span>
            <strong>{countByStatus.get(status) || 0}</strong>
          </Link>
        ))}
      </section>

      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Nueva</p>
            <h2>Registrar incidencia</h2>
          </div>
          <form action={createIncidentAction} className="stack-md">
            <input type="hidden" name="redirectPath" value="/admin/incidents" />
            <div className="stack-xs">
              <label htmlFor="title">Título</label>
              <input id="title" name="title" className="input" placeholder="Ej. Profesor no marcó asistencia" required />
            </div>
            <div className="form-grid two">
              <div className="stack-xs">
                <label htmlFor="type">Tipo</label>
                <select id="type" name="type" className="select" defaultValue="MISSING_ATTENDANCE">
                  {Object.values(IncidentType).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
                </select>
              </div>
              <div className="stack-xs">
                <label htmlFor="severity">Severidad</label>
                <select id="severity" name="severity" className="select" defaultValue="MEDIUM">
                  {Object.values(IncidentSeverity).map((severity) => <option key={severity} value={severity}>{severityLabels[severity]}</option>)}
                </select>
              </div>
            </div>
            <div className="stack-xs">
              <label htmlFor="classEventId">Clase relacionada</label>
              <select id="classEventId" name="classEventId" className="select" defaultValue="">
                <option value="">Sin clase relacionada</option>
                {classes.map((classEvent) => (
                  <option key={classEvent.id} value={classEvent.id}>
                    {classEvent.title} · {classEvent.startAt.toLocaleString('es-CO')} · {classEvent.teacher.user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="stack-xs">
              <label htmlFor="assignedToId">Responsable</label>
              <select id="assignedToId" name="assignedToId" className="select" defaultValue="">
                <option value="">Sin responsable</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </div>
            <div className="stack-xs">
              <label htmlFor="description">Descripción</label>
              <textarea id="description" name="description" className="textarea" rows={4} />
            </div>
            <button type="submit" className="button-primary">Crear incidencia</button>
          </form>
        </section>

        <section className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Regla brutal</p>
            <h2>Sin incidencia no hay aprendizaje</h2>
          </div>
          <p className="page-lead">
            Cada reclamo, asistencia faltante o saldo raro debe convertirse en una incidencia. Esta pantalla es la
            memoria operativa que reemplaza mensajes sueltos.
          </p>
          <div className="inline-actions">
            <Link href="/admin/weekly-closing" className="button-link">Ir al cierre semanal</Link>
            <Link href="/admin/dashboard" className="button-ghost">Dashboard</Link>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Listado</p>
          <h2>{selectedStatus ? statusLabels[selectedStatus as IncidentStatus] : 'Incidencias recientes'}</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Incidencia</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Clase</th>
                <th>Actualizar</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td>
                    <strong>{incident.title}</strong>
                    <small className="block-muted">{typeLabels[incident.type]} · {severityLabels[incident.severity]}</small>
                    {incident.description ? <small className="block-muted clamp">{incident.description}</small> : null}
                  </td>
                  <td>{statusLabels[incident.status]}</td>
                  <td>{incident.assignedTo?.name || 'Sin responsable'}</td>
                  <td>{incident.classEvent ? <Link className="text-link" href={`/admin/classes/${incident.classEvent.id}`}>{incident.classEvent.title}</Link> : 'No aplica'}</td>
                  <td>
                    <form action={updateIncidentAction} className="inline-form">
                      <input type="hidden" name="redirectPath" value="/admin/incidents" />
                      <input type="hidden" name="incidentId" value={incident.id} />
                      <select name="status" className="select compact-select" defaultValue={incident.status}>
                        {Object.values(IncidentStatus).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                      </select>
                      <select name="severity" className="select compact-select" defaultValue={incident.severity}>
                        {Object.values(IncidentSeverity).map((severity) => <option key={severity} value={severity}>{severityLabels[severity]}</option>)}
                      </select>
                      <select name="assignedToId" className="select compact-select" defaultValue={incident.assignedToId || ''}>
                        <option value="">Sin responsable</option>
                        {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                      </select>
                      <input name="resolutionNote" className="input compact-input" placeholder="Nota resolución" />
                      <button type="submit" className="button-ghost compact-button">Guardar</button>
                    </form>
                  </td>
                </tr>
              ))}
              {!incidents.length ? <tr><td colSpan={5}>No hay incidencias en este filtro.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
