export const dynamic = 'force-dynamic'

import { ContactStatus, CrmActivityStatus, CrmActivityType } from '@prisma/client'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  completeCrmActivityAction,
  convertCrmContactToStudentAction,
  createCrmActivityAction,
  createNotificationDraftAction,
  updateCrmContactStatusAction,
} from '@/lib/actions'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DirtySubmitButton } from '@/components/dirty-submit-button'

const contactStatusLabels: Record<ContactStatus, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  TRIAL_SCHEDULED: 'Clase demo agendada',
  ACTIVE_STUDENT: 'Alumno activo',
  LOST: 'Perdido',
}

const activityTypeLabels: Record<CrmActivityType, string> = {
  NOTE: 'Nota',
  WHATSAPP: 'WhatsApp',
  CALL: 'Llamada',
  EMAIL: 'Email',
  FOLLOW_UP: 'Seguimiento',
  TRIAL_CLASS: 'Clase demo',
}

const activityStatusLabels: Record<CrmActivityStatus, string> = {
  OPEN: 'Abierta',
  DONE: 'Completada',
  CANCELED: 'Cancelada',
}

function toDateTimeLocalValue(date?: Date | null) {
  if (!date) return ''
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

function toDateValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getCrmMessage(code: string) {
  const messages: Record<string, string> = {
    MISSING_ACTIVITY_FIELDS: 'Falta título para la actividad.',
    MISSING_ACTIVITY_ID: 'Falta la actividad.',
    ACTIVITY_NOT_FOUND: 'La actividad no existe.',
    CONTACT_NOT_FOUND: 'El contacto no existe.',
    MISSING_CONVERSION_FIELDS: 'Faltan datos para convertir.',
    INVALID_VALID_TO: 'La fecha de vencimiento del paquete no es válida.',
    RELATED_ENTITY_NOT_FOUND: 'Falta profesor o contacto.',
    CONTACT_ALREADY_CONVERTED: 'Este contacto ya fue convertido.',
    CONTACT_EMAIL_REQUIRED: 'Para convertir necesitas email.',
    EMAIL_ALREADY_EXISTS: 'Ya existe un usuario con ese email.',
    MISSING_CONTACT_ID: 'Falta contacto.',
  }
  return messages[code] || 'No se pudo completar la acción.'
}

export default async function CrmContactDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN' && session.role !== 'STAFF') redirect('/')

  const contact = await prisma.crmContact.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { name: true, email: true } },
      convertedStudent: { include: { user: true } },
      activities: {
        include: { actor: { select: { name: true, email: true } } },
        orderBy: [{ createdAt: 'desc' }],
      },
    },
  })
  if (!contact) notFound()

  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
  })

  const nextYear = new Date()
  nextYear.setFullYear(nextYear.getFullYear() + 1)
  const crmStatus = typeof searchParams?.crm === 'string' ? searchParams.crm : ''
  const crmCode = typeof searchParams?.code === 'string' ? searchParams.code : ''

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Ficha CRM</p>
        <h1 className="page-title">{contact.fullName}</h1>
        <p className="page-lead">
          {contact.phoneE164 || 'Sin teléfono'} · {contact.email || 'Sin email'} ·{' '}
          {contactStatusLabels[contact.status]}
        </p>
        <div className="inline-actions">
          <Link href="/admin/crm" className="button-ghost">
            Volver al CRM
          </Link>
          {contact.convertedStudent ? (
            <Link href="/admin/students" className="button-link">
              Ver alumno creado
            </Link>
          ) : null}
        </div>
      </section>

      {crmStatus === 'activity_created' ? <p className="status-success">Actividad creada.</p> : null}
      {crmStatus === 'activity_completed' ? <p className="status-success">Actividad completada.</p> : null}
      {crmStatus === 'updated' ? <p className="status-success">Contacto actualizado.</p> : null}
      {searchParams?.notification === 'created' ? <p className="status-success">Mensaje agregado a la cola.</p> : null}
      {crmStatus === 'error' ? <p className="status-warning">{getCrmMessage(crmCode)}</p> : null}

      <div className="settings-grid">
        <section id="conversion" className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Resumen</p>
            <h2>Contexto comercial</h2>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <strong>Programa</strong>
              <span>{contact.interestProgram || 'Sin definir'}</span>
            </div>
            <div className="settings-row">
              <strong>Nivel</strong>
              <span>{contact.level || 'Sin definir'}</span>
            </div>
            <div className="settings-row">
              <strong>Responsable</strong>
              <span>{contact.owner?.name || 'Sin responsable'}</span>
            </div>
            <div className="settings-row">
              <strong>Próximo seguimiento</strong>
              <span>{contact.nextFollowUpAt ? contact.nextFollowUpAt.toLocaleString('es-CO') : 'Sin fecha'}</span>
            </div>
            <div className="settings-row">
              <strong>Conversión</strong>
              <span>{contact.convertedStudent ? contact.convertedStudent.user.email : 'No convertido'}</span>
            </div>
          </div>
          {contact.notes ? <p className="hint">{contact.notes}</p> : null}
        </section>

        <section className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Estado</p>
            <h2>Actualizar pipeline</h2>
          </div>
          <form action={updateCrmContactStatusAction} className="stack-md">
            <input type="hidden" name="redirectPath" value={`/admin/crm/${contact.id}`} />
            <input type="hidden" name="contactId" value={contact.id} />
            <div className="stack-xs">
              <label htmlFor="status">Estado</label>
              <select id="status" name="status" className="select" defaultValue={contact.status}>
                {Object.values(ContactStatus).map((status) => (
                  <option key={status} value={status}>
                    {contactStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="stack-xs">
              <label htmlFor="notes">Nota nueva</label>
              <textarea id="notes" name="notes" className="textarea" rows={3} placeholder="Qué pasó y qué sigue" />
            </div>
            <DirtySubmitButton>
              Actualizar contacto
            </DirtySubmitButton>
          </form>
        </section>
      </div>

      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Actividad</p>
            <h2>Crear seguimiento</h2>
          </div>
          <form action={createCrmActivityAction} className="stack-md">
            <input type="hidden" name="redirectPath" value={`/admin/crm/${contact.id}`} />
            <input type="hidden" name="contactId" value={contact.id} />
            <div className="form-grid two">
              <div className="stack-xs">
                <label htmlFor="type">Tipo</label>
                <select id="type" name="type" className="select" defaultValue="FOLLOW_UP">
                  {Object.values(CrmActivityType).map((type) => (
                    <option key={type} value={type}>
                      {activityTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="stack-xs">
                <label htmlFor="dueAt">Fecha compromiso</label>
                <input id="dueAt" name="dueAt" type="datetime-local" className="input" defaultValue={toDateTimeLocalValue(contact.nextFollowUpAt)} />
              </div>
            </div>
            <div className="stack-xs">
              <label htmlFor="title">Título</label>
              <input id="title" name="title" className="input" placeholder="Llamar, enviar propuesta, confirmar demo..." required />
            </div>
            <div className="stack-xs">
              <label htmlFor="body">Detalle</label>
              <textarea id="body" name="body" className="textarea" rows={4} placeholder="Notas internas del seguimiento" />
            </div>
            <DirtySubmitButton>
              Guardar actividad
            </DirtySubmitButton>
          </form>
        </section>

        <section className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Conversión</p>
            <h2>Crear alumno y paquete</h2>
          </div>
          {contact.convertedStudent ? (
            <p className="status-success">Este contacto ya fue convertido a alumno.</p>
          ) : (
            <form action={convertCrmContactToStudentAction} className="stack-md">
              <input type="hidden" name="redirectPath" value={`/admin/crm/${contact.id}`} />
              <input type="hidden" name="contactId" value={contact.id} />
              <div className="stack-xs">
                <label htmlFor="teacherId">Profesor asignado</label>
                <select id="teacherId" name="teacherId" className="select" required>
                  <option value="">Selecciona profesor</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.user.name} - {teacher.user.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-grid two">
                <div className="stack-xs">
                  <label htmlFor="totalHours">Horas iniciales</label>
                  <input id="totalHours" name="totalHours" type="number" min="0.5" step="0.5" className="input" defaultValue={20} />
                </div>
                <div className="stack-xs">
                  <label htmlFor="validTo">Fecha de expiración de horas</label>
                  <input id="validTo" name="validTo" type="date" className="input" defaultValue={toDateValue(nextYear)} required />
                </div>
              </div>
              <p className="hint">
                Se crea usuario alumno con contraseña temporal `alumno123`. En producción esto debe ser invitación segura.
              </p>
              <DirtySubmitButton ready={Boolean(contact.email)}>
                Convertir a alumno
              </DirtySubmitButton>
              {!contact.email ? <p className="status-warning">No se puede convertir sin email.</p> : null}
            </form>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Timeline</p>
          <h2>Historial y tareas</h2>
        </div>
        <div className="timeline-list">
          {contact.activities.map((activity) => (
            <article key={activity.id} className="timeline-item">
              <div>
                <p className="eyebrow">{activityTypeLabels[activity.type]} · {activityStatusLabels[activity.status]}</p>
                <h3>{activity.title}</h3>
                {activity.body ? <p className="page-lead">{activity.body}</p> : null}
                <small className="block-muted">
                  Creada por {activity.actor.name} · {activity.createdAt.toLocaleString('es-CO')}
                  {activity.dueAt ? ` · vence ${activity.dueAt.toLocaleString('es-CO')}` : ''}
                </small>
              </div>
              <div className="row-actions">
                {activity.status === 'OPEN' ? (
                  <form action={completeCrmActivityAction}>
                    <input type="hidden" name="redirectPath" value={`/admin/crm/${contact.id}`} />
                    <input type="hidden" name="contactId" value={contact.id} />
                    <input type="hidden" name="activityId" value={activity.id} />
                    <button className="button-ghost compact-button" type="submit">
                      Completar
                    </button>
                  </form>
                ) : null}
                <form action={createNotificationDraftAction}>
                  <input type="hidden" name="redirectPath" value={`/admin/crm/${contact.id}`} />
                  <input type="hidden" name="targetType" value="CRM_CONTACT" />
                  <input type="hidden" name="targetId" value={contact.id} />
                  <input type="hidden" name="channel" value="WHATSAPP" />
                  <input
                    type="hidden"
                    name="message"
                    value={`Hola ${contact.fullName}, te escribimos de TEATIME Academy sobre: ${activity.title}`}
                  />
                  <button className="button-ghost compact-button" type="submit">
                    Crear WhatsApp
                  </button>
                </form>
              </div>
            </article>
          ))}
          {!contact.activities.length ? <p className="page-lead">Todavía no hay actividades para este contacto.</p> : null}
        </div>
      </section>
    </div>
  )
}
