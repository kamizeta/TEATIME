import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getDefaultRouteForRole } from '@/lib/navigation'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect(getDefaultRouteForRole(session.role))

  return (
    <div className="auth-shell">
      <section className="auth-hero">
        <p className="eyebrow">Operación TEATIME</p>
        <h1>Agenda, reservas y asistencia en una sola operación.</h1>
        <p className="hero-copy">
          Este MVP ya separa roles, disponibilidad, reservas y control de saldo. La siguiente capa es la
          sincronización operativa con Google Calendar y Meet sin depender de hojas manuales.
        </p>
      </section>

      <LoginForm />
    </div>
  )
}
