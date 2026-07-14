import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { legalVersions } from '@/lib/legal-consent'
import { prisma } from '@/lib/prisma'
import { LegalConsentForm } from '@/components/legal-consent-form'

export default async function ConsentPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const consent = await prisma.legalConsent.findUnique({
    where: {
      userId_document_version: {
        userId: session.userId,
        document: 'TRANSCRIPTION_CONSENT',
        version: legalVersions.transcription,
      },
    },
  })

  return (
    <main className="legal-page">
      <Link href="/" className="text-link">Volver a la plataforma</Link>
      <p className="eyebrow">Privacidad y consentimiento</p>
      <h1>Transcripción de clases</h1>
      <p>TEATIME solicita tu autorización para transcribir automáticamente las clases virtuales y generar un informe pedagógico. Esta decisión aplica a clases futuras y puede modificarse aquí.</p>
      <p>Lee la <Link href="/legal/transcription" className="text-link">autorización de transcripción</Link>, los <Link href="/legal/terms" className="text-link">términos</Link> y la <Link href="/legal/privacy" className="text-link">política de privacidad</Link> antes de decidir.</p>
      <LegalConsentForm transcriptionAccepted={Boolean(consent?.granted)} />
    </main>
  )
}
