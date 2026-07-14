import Link from 'next/link'
import { legalDocumentMeta, legalDraftWarning } from '@/lib/legal-documents'

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link href="/login" className="text-link">Volver al acceso</Link>
      <p className="eyebrow">Documento legal</p>
      <h1>Política de tratamiento de datos personales</h1>
      <p className="status-warning">{legalDraftWarning}</p>
      <p>Versión {legalDocumentMeta.version} · Vigencia: {legalDocumentMeta.effectiveDate}</p>

      <h2>1. Responsable y canales</h2>
      <p>Responsable: {legalDocumentMeta.responsible}; NIT: {legalDocumentMeta.nit}; correo para consultas, actualización, rectificación o supresión: {legalDocumentMeta.contact}; dirección: {legalDocumentMeta.address}.</p>

      <h2>2. Datos tratados y finalidades</h2>
      <p>La plataforma trata datos de identificación y contacto, idioma, nivel, profesor asignado, reservas, asistencia, paquetes de horas, comunicaciones y datos técnicos de seguridad. Las finalidades son prestar el servicio académico, gestionar agenda y pagos, enviar comunicaciones transaccionales, resolver incidencias, proteger la cuenta, cumplir obligaciones legales y mejorar la operación.</p>

      <h2>3. Datos de reuniones virtuales</h2>
      <p>Cuando exista autorización específica, TEATIME puede tratar metadatos de Google Meet, transcripciones e informes pedagógicos para documentar la clase, elaborar seguimiento académico y entregar material de repaso. La transcripción no se usará para calificar automáticamente a una persona, imponer sanciones ni decidir cobros sin regla operativa y revisión humana.</p>

      <h2>4. Encargados y transferencias</h2>
      <p>TEATIME puede utilizar proveedores tecnológicos como Google Workspace, Resend y proveedores de inteligencia artificial para las finalidades descritas. El titular será informado de que dichos servicios pueden involucrar tratamiento o almacenamiento fuera de Colombia, bajo las salvaguardas aplicables.</p>

      <h2>5. Derechos del titular</h2>
      <p>El titular puede conocer, actualizar, rectificar y solicitar prueba de su autorización; ser informado sobre el uso de sus datos; presentar quejas ante la SIC; revocar autorización o solicitar supresión cuando proceda. Las solicitudes se reciben en {legalDocumentMeta.contact}.</p>

      <h2>6. Retención y seguridad</h2>
      <p>Los datos se conservan solo durante el tiempo necesario para las finalidades informadas, obligaciones contractuales y legales. Los accesos se restringen por rol y se registran acciones operativas. La política de retención específica de transcripciones debe configurarse antes de producción.</p>

      <h2>7. Menores de edad</h2>
      <p>Cuando el alumno sea menor de edad, la Academia debe obtener autorización verificable de su padre, madre o representante legal antes de habilitar portal, transcripción o tratamiento no estrictamente necesario para el servicio.</p>
    </main>
  )
}
