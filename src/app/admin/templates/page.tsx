export const dynamic = 'force-dynamic'

import { MessageTemplateChannel } from '@prisma/client'
import { redirect } from 'next/navigation'
import { saveMessageTemplateAction } from '@/lib/actions'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DirtySubmitButton } from '@/components/dirty-submit-button'

const channelLabels: Record<MessageTemplateChannel, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Correo electrónico',
  IN_APP: 'In-app',
}

function getMessage(code: string) {
  const messages: Record<string, string> = {
    MISSING_TEMPLATE_FIELDS: 'Faltan llave, nombre o cuerpo de la plantilla.',
  }
  return messages[code] || 'No se pudo guardar la plantilla.'
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN' && session.role !== 'STAFF') redirect('/')

  const result = typeof searchParams?.template === 'string' ? searchParams.template : ''
  const code = typeof searchParams?.code === 'string' ? searchParams.code : ''

  const templates = await prisma.messageTemplate.findMany({
    include: { updatedBy: true },
    orderBy: [{ channel: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Plantillas</p>
        <h1 className="page-title">Mensajes reutilizables</h1>
        <p className="page-lead">
          Estandariza confirmaciones, cancelaciones y seguimientos. Mañana estas plantillas alimentan WhatsApp/email.
        </p>
      </section>

      {result === 'saved' ? <p className="status-success">Plantilla guardada.</p> : null}
      {result === 'error' ? <p className="status-warning">{getMessage(code)}</p> : null}

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Nueva plantilla</p>
          <h2>Crear mensaje base</h2>
        </div>
        <form action={saveMessageTemplateAction} className="ops-form">
          <input type="hidden" name="redirectPath" value="/admin/templates" />
          <div className="stack-xs">
            <label htmlFor="key">Llave</label>
            <input id="key" name="key" className="input" placeholder="booking_confirmation" required />
          </div>
          <div className="stack-xs">
            <label htmlFor="name">Nombre</label>
            <input id="name" name="name" className="input" placeholder="Confirmación de clase" required />
          </div>
          <div className="stack-xs">
            <label htmlFor="channel">Canal</label>
            <select id="channel" name="channel" className="select" defaultValue="WHATSAPP">
              {Object.values(MessageTemplateChannel).map((channel) => (
                <option key={channel} value={channel}>{channelLabels[channel]}</option>
              ))}
            </select>
          </div>
          <div className="stack-xs">
            <label htmlFor="language">Idioma</label>
            <input id="language" name="language" className="input" defaultValue="es" />
          </div>
          <div className="stack-xs ops-span-2">
            <label htmlFor="subject">Asunto opcional</label>
            <input id="subject" name="subject" className="input" placeholder="Solo para email" />
          </div>
          <div className="stack-xs ops-span-2">
            <label htmlFor="body">Cuerpo</label>
            <textarea
              id="body"
              name="body"
              className="textarea"
              rows={5}
              placeholder="Hola {{student_name}}, tu clase con {{teacher_name}} quedó agendada para {{class_time}}."
              required
            />
          </div>
          <label className="check-row ops-span-2">
            <input type="checkbox" name="isActive" defaultChecked /> Activa
          </label>
          <DirtySubmitButton className="ops-span-2">Guardar plantilla</DirtySubmitButton>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Biblioteca</p>
          <h2>Plantillas actuales</h2>
        </div>
        <table>
          <thead>
            <tr><th>Plantilla</th><th>Canal</th><th>Idioma</th><th>Estado</th><th>Editar rápido</th></tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td>
                  <strong>{template.name}</strong>
                  <small className="block-muted">{template.key}</small>
                  <small className="block-muted clamp">{template.body}</small>
                </td>
                <td>{channelLabels[template.channel]}</td>
                <td>{template.language}</td>
                <td>{template.isActive ? 'Activa' : 'Inactiva'}</td>
                <td>
                  <form action={saveMessageTemplateAction} className="stack-xs">
                    <input type="hidden" name="redirectPath" value="/admin/templates" />
                    <input type="hidden" name="templateId" value={template.id} />
                    <input type="hidden" name="key" value={template.key} />
                    <input type="hidden" name="name" value={template.name} />
                    <input type="hidden" name="channel" value={template.channel} />
                    <input type="hidden" name="language" value={template.language} />
                    <input type="hidden" name="subject" value={template.subject || ''} />
                    <textarea name="body" className="textarea compact-textarea" defaultValue={template.body} />
                    <label className="check-row"><input type="checkbox" name="isActive" defaultChecked={template.isActive} /> Activa</label>
                    <DirtySubmitButton className="compact-button">Guardar</DirtySubmitButton>
                  </form>
                </td>
              </tr>
            ))}
            {!templates.length ? <tr><td colSpan={5}>Todavía no hay plantillas.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  )
}
