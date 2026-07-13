import { notFound } from 'next/navigation'

import { getValidAccessToken } from '@/lib/access'
import { ActivateAccessForm } from './activate-access-form'

export const dynamic = 'force-dynamic'

export default async function AccessActivationPage({ params }: { params: { token: string } }) {
  const accessToken = await getValidAccessToken(params.token)
  if (!accessToken) notFound()

  return (
    <section className="auth-card">
      <div className="card-header">
        <p className="eyebrow">TEATIME Ops</p>
        <h1>Activa tu acceso</h1>
        <p className="muted">Hola {accessToken.user.name}. Confirma tu correo y crea una contraseña personal.</p>
      </div>
      <ActivateAccessForm token={params.token} />
    </section>
  )
}
