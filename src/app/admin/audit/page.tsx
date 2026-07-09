export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function safeJson(value: string | null) {
  if (!value) return ''
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function entityHref(entityType: string, entityId: string) {
  if (entityType === 'CLASS_EVENT') return `/admin/classes/${entityId}`
  if (entityType === 'STUDENT') return '/admin/students'
  if (entityType === 'PACKAGE_LEDGER') return '/admin/packages'
  if (entityType === 'CRM_CONTACT') return `/admin/crm/${entityId}`
  if (entityType === 'INCIDENT') return '/admin/incidents'
  if (entityType === 'MESSAGE_TEMPLATE') return '/admin/templates'
  if (entityType === 'USER') return '/admin/users'
  if (entityType === 'NOTIFICATION_ATTEMPT') return '/admin/notifications'
  return ''
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN' && session.role !== 'STAFF') redirect('/')

  const actorId = typeof searchParams?.actorId === 'string' ? searchParams.actorId : ''
  const entityType = typeof searchParams?.entityType === 'string' ? searchParams.entityType : ''
  const action = typeof searchParams?.action === 'string' ? searchParams.action : ''

  const users = await prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } })
  const entityTypes = await prisma.auditLog.groupBy({ by: ['entityType'], orderBy: { entityType: 'asc' } })
  const actions = await prisma.auditLog.groupBy({ by: ['action'], orderBy: { action: 'asc' } })
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(actorId ? { actorId } : {}),
      ...(entityType ? { entityType } : {}),
      ...(action ? { action } : {}),
    },
    include: { actor: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 120,
  })

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Auditoría</p>
        <h1 className="page-title">Quién cambió qué y cuándo</h1>
        <p className="page-lead">
          Esta pantalla es la defensa contra memoria humana: cambios de saldo, usuarios, clases, CRM, incidencias y plantillas.
        </p>
      </section>

      <section className="panel">
        <form className="calendar-filters" action="/admin/audit">
          <div className="stack-xs">
            <label htmlFor="actorId">Actor</label>
            <select id="actorId" name="actorId" className="select" defaultValue={actorId}>
              <option value="">Todos</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
              ))}
            </select>
          </div>
          <div className="stack-xs">
            <label htmlFor="entityType">Entidad</label>
            <select id="entityType" name="entityType" className="select" defaultValue={entityType}>
              <option value="">Todas</option>
              {entityTypes.map((item) => <option key={item.entityType} value={item.entityType}>{item.entityType}</option>)}
            </select>
          </div>
          <div className="stack-xs">
            <label htmlFor="action">Acción</label>
            <select id="action" name="action" className="select" defaultValue={action}>
              <option value="">Todas</option>
              {actions.map((item) => <option key={item.action} value={item.action}>{item.action}</option>)}
            </select>
          </div>
          <button className="button-primary" type="submit">Filtrar</button>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Últimos eventos</p>
          <h2>{logs.length} registros</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actor</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Antes</th>
                <th>Después</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const href = entityHref(log.entityType, log.entityId)
                return (
                  <tr key={log.id}>
                    <td>{log.createdAt.toLocaleString('es-CO')}</td>
                    <td>
                      <strong>{log.actor.name}</strong>
                      <small className="block-muted">{log.actor.email} · {log.actor.role}</small>
                    </td>
                    <td>{log.action}</td>
                    <td>
                      <strong>{log.entityType}</strong>
                      <small className="block-muted">{log.entityId}</small>
                      {href ? <Link className="text-link" href={href}>Abrir</Link> : null}
                    </td>
                    <td><pre className="json-preview">{safeJson(log.before)}</pre></td>
                    <td><pre className="json-preview">{safeJson(log.after)}</pre></td>
                  </tr>
                )
              })}
              {!logs.length ? <tr><td colSpan={6}>No hay registros con estos filtros.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
