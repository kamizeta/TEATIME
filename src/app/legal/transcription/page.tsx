import Link from 'next/link'
import { legalDocumentMeta, legalDraftWarning } from '@/lib/legal-documents'

export default function TranscriptionPolicyPage() {
  return (
    <main className="legal-page">
      <Link href="/login" className="text-link">Volver al acceso</Link>
      <p className="eyebrow">Consentimiento específico</p>
      <h1>Autorización para transcripción de clases virtuales</h1>
      <p className="status-warning">{legalDraftWarning}</p>
      <p>Versión {legalDocumentMeta.version} · Vigencia: {legalDocumentMeta.effectiveDate}</p>

      <h2>Qué se trata</h2>
      <p>La herramienta puede obtener texto transcrito de las intervenciones en Google Meet, metadatos de participación y un informe pedagógico derivado de la conversación.</p>

      <h2>Para qué se usa</h2>
      <p>Para que alumno, profesor y administración puedan revisar el historial de clase, temas tratados, vocabulario, tareas y plan de continuación. El informe generado por IA es apoyo pedagógico y debe ser revisado por el profesor cuando corresponda.</p>

      <h2>Quién puede acceder</h2>
      <p>El alumno participante, su profesor y personal autorizado de TEATIME según su rol operativo. El acceso queda limitado a la clase correspondiente.</p>

      <h2>Decisión y retiro</h2>
      <p>La autorización es opcional y puede retirarse para clases futuras mediante administración. Si un participante no autoriza, la clase puede continuar sin transcripción; TEATIME no debe activar la transcripción automática de esa clase.</p>

      <h2>Contacto</h2>
      <p>Para solicitudes relacionadas con este consentimiento: {legalDocumentMeta.contact}.</p>
    </main>
  )
}
