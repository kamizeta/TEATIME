export const dynamic = 'force-dynamic'

import { ContactSource, ContactStatus } from '@prisma/client'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createCrmContactAction, createNotificationDraftAction, updateCrmContactStatusAction } from '@/lib/actions'
import { DirtySubmitButton } from '@/components/dirty-submit-button'

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
    MISSING_ACTIVITY_FIELDS: 'Falta título de la actividad.',
    MISSING_CONVERSION_FIELDS: 'Faltan datos para convertir a alumno.',
    CONTACT_EMAIL_REQUIRED: 'Para convertir a alumno se necesita email.',
    EMAIL_ALREADY_EXISTS: 'Ya existe un usuario con ese email.',
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
    include: { owner: { select: { name: true, email: true } }, _count: { select: { activities: true } } },
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
                <select id="preferredLanguage" name="preferredLanguage" className="select" defaultValue="es">
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                </select>
              </div>
            </div>
            <div className="form-grid three">
              <div className="stack-xs">
                <label htmlFor="interestProgram">Programa de interés</label>
                <input id="interestProgram" name="interestProgram" className="input" placeholder="Inglés 1:1, grupal, conversación..." />
              </div>
              <div className="stack-xs">
                <label htmlFor="level">Nivel estimado</label>
                <input id="level" name="level" className="input" placeholder="A1, B2, principiante..." />
              </div>
              <div className="stack-xs">
                <label htmlFor="nextFollowUpAt">Próximo seguimiento</label>
                <input id="nextFollowUpAt" name="nextFollowUpAt" type="datetime-local" className="input" />
              </div>
            </div>
            <div className="stack-xs">
              <label htmlFor="notes">Notas</label>
              <textarea id="notes" name="notes" className="textarea" rows={4} placeholder="Necesidad, nivel, horario, objeciones..." />
            </div>
            <DirtySubmitButton>
              Crear contacto
            </DirtySubmitButton>
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
                <th>Interés</th>
                <th>Responsable</th>
                <th>Seguimiento</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <Link href={`/admin/crm/${contact.id}`} className="text-link">
                      <strong>{contact.fullName}</strong>
                    </Link>
                    <small className="block-muted">
                      {contact.phoneE164 || 'Sin teléfono'} · {contact.email || 'Sin email'}
                    </small>
                    {contact.notes ? <small className="block-muted clamp">{contact.notes}</small> : null}
                  </td>
                  <td>
                    {statusLabels[contact.status]}
                    {contact.status === 'ACTIVE_STUDENT' ? (
                      <small className="block-muted">Estado comercial. Debe existir conversión para aparecer en Alumnos.</small>
                    ) : null}
                  </td>
                  <td>{sourceLabels[contact.source]}</td>
                  <td>
                    {contact.interestProgram || 'Sin programa'}
                    <small className="block-muted">
                      {contact.level || 'Nivel sin definir'} · {contact._count.activities} actividades
                    </small>
                    {contact.nextFollowUpAt ? (
                      <small className="block-muted">Próximo: {contact.nextFollowUpAt.toLocaleString('es-CO')}</small>
                    ) : null}
                  </td>
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
                        <DirtySubmitButton className="compact-button">
                          Actualizar
                        </DirtySubmitButton>
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
                      {contact.status !== 'LOST' ? (
                        <Link href={`/admin/crm/${contact.id}#conversion`} className="button-link compact-button">
                          Convertir a alumno
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!contacts.length ? (
                <tr>
                  <td colSpan={6}>No hay contactos en este filtro.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
