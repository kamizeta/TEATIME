import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { ChangePasswordForm } from './change-password-form'

export default async function ChangePasswordPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <section className="auth-card">
      <div className="card-header">
        <p className="eyebrow">Seguridad</p>
        <h1>Cambia tu contraseña</h1>
        <p className="muted">Tu contraseña temporal venció después de 24 horas o debe reemplazarse en este primer ingreso.</p>
      </div>
      <ChangePasswordForm />
    </section>
  )
}
