export const dynamic = 'force-dynamic'

import { ContactSource, ContactStatus } from '@prisma/client'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createCrmContactAction, createNotificationDraftAction, updateCrmContactStatusAction } from '@/lib/actions'

const statusLabels: Record<ContactStatus, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  TRIAL_SCHEDULED: 'Clase demo agendada',
  ACTIVE_STUDENT: 'Alumno activo',
  LOST: 'Perdido',
}

const sourceLabels: Record<ContactSource, string> = {
  WHATSAPP: 'WhatsApp',
  WEBSITE: 'Sitio web',
  REFERRAL: 'Referido',
  MANUAL: 'Manual',
  OTHER: 'Otro',
}

function getCrmMessage(code: string) {
  const messages: Record<string, string> = {
    MISSING_CONTACT_FIELDS: 'Falta nombre y al menos un email o teléfono.',
    MISSING_CONTACT_ID: 'Falta el contacto.',
    CONTACT_NOT_FOUND: 'El contacto no existe.',
  }
  return messages[code] || 'No se pudo completar la acción.'
}

export default async function AdminCrmPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN' && session.role !== 'STAFF') redirect('/')

  const selectedStatus = typeof searchParams?.status === 'string' ? searchParams.status : ''
  const crmStatus = typeof searchParams?.crm === 'string' ? searchParams.crm : ''
  const crmCode = typeof searchParams?.code === 'string' ? searchParams.code : ''

  const contacts = await prisma.crmContact.findMany({
    where: selectedStatus && selectedStatus in ContactStatus ? { status: selectedStatus as ContactStatus } : undefined,
    include: { owner: { select: { name: true, email: true } } },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: 80,
  })

  const counts = await prisma.crmContact.groupBy({
    by: ['status'],
    _count: { _all: true },
  })
  const countByStatus = new Map(counts.map((item) => [item.status, item._count._all]))

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">CRM operativo</p>
        <h1 className="page-title">Prospectos y seguimiento comercial</h1>
        <p className="page-lead">
          Este es el puente entre WhatsApp, Excel y alumnos reales. Por ahora registra contactos manualmente; luego se
          conecta a WhatsApp Business API.
        </p>
      </section>

      {crmStatus === 'created' ? <p className="status-success">Contacto creado.</p> : null}
      {crmStatus === 'updated' ? <p className="status-success">Contacto actualizado.</p> : null}
      {searchParams?.notification === 'created' ? (
        <p className="status-success">Mensaje agregado a la cola de notificaciones.</p>
      ) : null}
      {crmStatus === 'error' ? <p className="status-warning">{getCrmMessage(crmCode)}</p> : null}

      <section className="kpi-grid">
        {Object.values(ContactStatus).map((status) => (
          <a key={status} href={`/admin/crm?status=${status}`} className="kpi-card">
            <span>{statusLabels[status]}</span>
            <strong>{countByStatus.get(status) || 0}</strong>
          </a>
        ))}
      </section>

      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Nuevo contacto</p>
            <h2>Registrar prospecto</h2>
          </div>
          <form action={createCrmContactAction} className="stack-md">
            <input type="hidden" name="redirectPath" value="/admin/crm" />
            <div className="stack-xs">
              <label htmlFor="fullName">Nombre</label>
              <input id="fullName" name="fullName" className="input" placeholder="Nombre completo" required />
            </div>
            <div className="form-grid two">
              <div className="stack-xs">
                <label htmlFor="phoneE164">WhatsApp / teléfono</label>
                <input id="phoneE164" name="phoneE164" className="input" placeholder="+57..." />
              </div>
              <div className="stack-xs">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" className="input" placeholder="correo@dominio.com" />
              </div>
            </div>
            <div className="form-grid three">
              <div className="stack-xs">
                <label htmlFor="source">Origen</label>
                <select id="source" name="source" className="select" defaultValue="WHATSAPP">
                  {Object.values(ContactSource).map((source) => (
                    <option key={source} value={source}>
                      {sourceLabels[source]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="stack-xs">
                <label htmlFor="status">Estado</label>
                <select id="status" name="status" className="select" defaultValue="NEW">
                  {Object.values(ContactStatus).map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="stack-xs">
                <label htmlFor="preferredLanguage">Idioma</label>
                <input id="preferredLanguage" name="preferredLanguage" className="input" defaultValue="es" />
              </div>
            </div>
            <div className="stack-xs">
              <label htmlFor="notes">Notas</label>
              <textarea id="notes" name="notes" className="textarea" rows={4} placeholder="Necesidad, nivel, horario, objeciones..." />
            </div>
            <button className="button-primary" type="submit">
              Crear contacto
            </button>
          </form>
        </section>

        <section className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Filtro activo</p>
            <h2>{selectedStatus ? statusLabels[selectedStatus as ContactStatus] : 'Todos los contactos'}</h2>
          </div>
          <div className="inline-actions">
            <a href="/admin/crm" className="button-ghost">
              Ver todos
            </a>
            <a href="/admin/notifications" className="button-link">
              Cola de notificaciones
            </a>
          </div>
          <p className="hint">
            La regla operativa es simple: si no está aquí, no existe. WhatsApp sin CRM vuelve a crear el mismo problema.
          </p>
        </section>
      </div>

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Pipeline</p>
          <h2>Últimos contactos</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Origen</th>
                <th>Responsable</th>
                <th>Seguimiento</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <strong>{contact.fullName}</strong>
                    <small className="block-muted">
                      {contact.phoneE164 || 'Sin teléfono'} · {contact.email || 'Sin email'}
                    </small>
                    {contact.notes ? <small className="block-muted clamp">{contact.notes}</small> : null}
                  </td>
                  <td>{statusLabels[contact.status]}</td>
                  <td>{sourceLabels[contact.source]}</td>
                  <td>{contact.owner?.name || 'Sin responsable'}</td>
                  <td>
                    <div className="row-actions">
                      <form action={updateCrmContactStatusAction} className="inline-form">
                        <input type="hidden" name="redirectPath" value="/admin/crm" />
                        <input type="hidden" name="contactId" value={contact.id} />
                        <select name="status" className="select compact-select" defaultValue={contact.status}>
                          {Object.values(ContactStatus).map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                        <input name="notes" className="input compact-input" placeholder="Nota rápida" />
                        <button className="button-ghost compact-button" type="submit">
                          Actualizar
                        </button>
                      </form>
                      <form action={createNotificationDraftAction} className="inline-form">
                        <input type="hidden" name="redirectPath" value="/admin/crm" />
                        <input type="hidden" name="targetType" value="CRM_CONTACT" />
                        <input type="hidden" name="targetId" value={contact.id} />
                        <input type="hidden" name="channel" value="WHATSAPP" />
                        <input
                          type="hidden"
                          name="message"
                          value={`Hola ${contact.fullName}, te escribimos de TEATIME Academy para avanzar con tu proceso.`}
                        />
                        <button className="button-ghost compact-button" type="submit">
                          Pendiente WhatsApp
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {!contacts.length ? (
                <tr>
                  <td colSpan={5}>No hay contactos en este filtro.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
