import Link from 'next/link'
import { legalDocumentMeta, legalDraftWarning } from '@/lib/legal-documents'

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link href="/login" className="text-link">Volver al acceso</Link>
      <p className="eyebrow">Documento legal</p>
      <h1>Términos y condiciones de uso</h1>
      <p className="status-warning">{legalDraftWarning}</p>
      <p>Versión {legalDocumentMeta.version} · Vigencia: {legalDocumentMeta.effectiveDate}</p>

      <h2>1. Objeto de la plataforma</h2>
      <p>TEATIME Ops permite gestionar perfiles académicos, disponibilidad, reservas, clases, asistencia, paquetes de horas, comunicaciones y materiales asociados a la formación de idiomas.</p>

      <h2>2. Cuenta y acceso</h2>
      <p>Cada persona debe utilizar información veraz, proteger su contraseña y comunicar de inmediato cualquier acceso no autorizado. La Academia puede suspender cuentas por incumplimiento, fraude, uso indebido o razones de seguridad.</p>

      <h2>3. Reservas, cancelaciones y paquetes</h2>
      <p>Las reservas se sujetan a la disponibilidad del profesor asignado, el paquete contratado y la política vigente de cancelación. Cuando la clase se realiza, las horas se consumen conforme al paquete. La inasistencia del alumno a una clase que sí fue impartida se registra como “No asistió” y consume la hora reservada, salvo ajuste documentado por administración.</p>

      <h2>4. Evidencia de clases virtuales</h2>
      <p>La Academia puede usar datos operativos de Google Calendar y Google Meet para verificar la celebración de una clase, resolver incidencias y actualizar el historial académico. Los datos automáticos se someten a controles de excepción; no reemplazan los derechos de reclamación del alumno o profesor.</p>

      <h2>5. Uso aceptable</h2>
      <p>Está prohibido compartir enlaces de clase con terceros no autorizados, interferir con la plataforma, vulnerar la privacidad de participantes o utilizar las clases para fines distintos a la formación acordada.</p>

      <h2>6. Cambios y contacto</h2>
      <p>La Academia informará cambios materiales mediante el portal o correo electrónico. Responsable: {legalDocumentMeta.responsible}; NIT: {legalDocumentMeta.nit}; contacto: {legalDocumentMeta.contact}; dirección: {legalDocumentMeta.address}.</p>
    </main>
  )
}
