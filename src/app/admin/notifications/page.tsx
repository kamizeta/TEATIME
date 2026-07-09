export const dynamic = 'force-dynamic'

import { NotificationStatus } from '@prisma/client'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotificationDraftAction, markNotificationStatusAction } from '@/lib/actions'

const statusLabels: Record<NotificationStatus, string> = {
  PENDING: 'Pendiente',
  SENT: 'Enviado',
  RETRY: 'Reintentar',
  FAILED: 'Fallido',
}

function parsePayload(payload: string | null) {
  if (!payload) return ''
  try {
    const parsed = JSON.parse(payload) as { message?: string }
    return parsed.message || payload
  } catch {
    return payload
  }
}

function getNotificationMessage(code: string) {
  const messages: Record<string, string> = {
    MISSING_NOTIFICATION_FIELDS: 'Falta destino, canal o mensaje.',
    MISSING_NOTIFICATION_ID: 'Falta la notificación.',
    NOTIFICATION_NOT_FOUND: 'La notificación no existe.',
  }
  return messages[code] || 'No se pudo completar la acción.'
}

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN' && session.role !== 'STAFF') redirect('/')

  const selectedStatus = typeof searchParams?.status === 'string' ? searchParams.status : ''
  const notificationStatus = typeof searchParams?.notification === 'string' ? searchParams.notification : ''
  const notificationCode = typeof searchParams?.code === 'string' ? searchParams.code : ''

  const notifications = await prisma.notificationAttempt.findMany({
    where:
      selectedStatus && selectedStatus in NotificationStatus ? { status: selectedStatus as NotificationStatus } : undefined,
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  })

  const counts = await prisma.notificationAttempt.groupBy({
    by: ['status'],
    _count: { _all: true },
  })
  const countByStatus = new Map(counts.map((item) => [item.status, item._count._all]))

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Mensajería operativa</p>
        <h1 className="page-title">Cola de notificaciones</h1>
        <p className="page-lead">
          Aquí se ve lo que la app debe comunicar. Hoy puede usarse como checklist manual; mañana se conecta a
          WhatsApp Business API, email o Google Calendar.
        </p>
      </section>

      {notificationStatus === 'created' ? <p className="status-success">Notificación creada.</p> : null}
      {notificationStatus === 'updated' ? <p className="status-success">Estado actualizado.</p> : null}
      {notificationStatus === 'error' ? <p className="status-warning">{getNotificationMessage(notificationCode)}</p> : null}

      <section className="kpi-grid">
        {Object.values(NotificationStatus).map((status) => (
          <a key={status} href={`/admin/notifications?status=${status}`} className="kpi-card">
            <span>{statusLabels[status]}</span>
            <strong>{countByStatus.get(status) || 0}</strong>
          </a>
        ))}
      </section>

      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Borrador manual</p>
            <h2>Crear mensaje pendiente</h2>
          </div>
          <form action={createNotificationDraftAction} className="stack-md">
            <input type="hidden" name="redirectPath" value="/admin/notifications" />
            <div className="form-grid two">
              <div className="stack-xs">
                <label htmlFor="targetType">Tipo destino</label>
                <select id="targetType" name="targetType" className="select" defaultValue="MANUAL">
                  <option value="CRM_CONTACT">Contacto CRM</option>
                  <option value="CLASS_EVENT">Clase</option>
                  <option value="USER">Usuario</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </div>
              <div className="stack-xs">
                <label htmlFor="targetId">ID destino</label>
                <input id="targetId" name="targetId" className="input" placeholder="ID o referencia" required />
              </div>
            </div>
            <div className="stack-xs">
              <label htmlFor="channel">Canal</label>
              <select id="channel" name="channel" className="select" defaultValue="WHATSAPP">
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="CALENDAR">Google Calendar</option>
                <option value="IN_APP">In-app</option>
              </select>
            </div>
            <div className="stack-xs">
              <label htmlFor="message">Mensaje</label>
              <textarea
                id="message"
                name="message"
                className="textarea"
                rows={5}
                placeholder="Mensaje que debe enviarse o copiarse manualmente"
                required
              />
            </div>
            <button type="submit" className="button-primary">
              Agregar a cola
            </button>
          </form>
        </section>

        <section className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Criterio operativo</p>
            <h2>No automatizar basura</h2>
          </div>
          <p className="page-lead">
            Primero hacemos visible cada mensaje crítico. Después conectamos proveedores. Si automatizamos sin cola ni
            estado, solo cambiamos Excel por una caja negra.
          </p>
          <div className="inline-actions">
            <a href="/admin/notifications" className="button-ghost">
              Ver todos
            </a>
            <a href="/admin/crm" className="button-link">
              Ir al CRM
            </a>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Cola</p>
          <h2>{selectedStatus ? statusLabels[selectedStatus as NotificationStatus] : 'Últimas notificaciones'}</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Destino</th>
                <th>Canal</th>
                <th>Estado</th>
                <th>Mensaje</th>
                <th>Actualizar</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification) => (
                <tr key={notification.id}>
                  <td>
                    <strong>{notification.targetType}</strong>
                    <small className="block-muted">{notification.targetId}</small>
                  </td>
                  <td>{notification.channel}</td>
                  <td>{statusLabels[notification.status]}</td>
                  <td>
                    <span className="clamp">{parsePayload(notification.payload)}</span>
                    {notification.providerId ? <small className="block-muted">Proveedor: {notification.providerId}</small> : null}
                  </td>
                  <td>
                    <form action={markNotificationStatusAction} className="inline-form">
                      <input type="hidden" name="redirectPath" value="/admin/notifications" />
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <select name="status" className="select compact-select" defaultValue={notification.status}>
                        {Object.values(NotificationStatus).map((status) => (
                          <option key={status} value={status}>
                            {statusLabels[status]}
                          </option>
                        ))}
                      </select>
                      <input name="providerId" className="input compact-input" placeholder="ID proveedor" />
                      <button className="button-ghost compact-button" type="submit">
                        Guardar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {!notifications.length ? (
                <tr>
                  <td colSpan={5}>No hay notificaciones en este filtro.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
