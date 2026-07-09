'use client'

export const dynamic = 'force-dynamic'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginAction } from '@/lib/actions/session'

const demoUsers = [
  { role: 'Admin', email: 'admin@academy.test', password: 'admin123' },
  { role: 'Staff', email: 'staff@academy.test', password: 'staff123' },
  { role: 'Teacher', email: 'profesor@academy.test', password: 'prof123' },
  { role: 'Student', email: 'alumno@academy.test', password: 'alumno123' },
] as const

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const result = await loginAction(fd)
    if (!result.ok) {
      setIsLoading(false)
      return setError(result.error || 'No se pudo iniciar sesión')
    }
    router.push('/')
  }

  return (
    <div className="auth-shell">
      <section className="auth-hero">
        <p className="eyebrow">Operación TEATIME</p>
        <h1>Agenda, reservas y asistencia en una sola operación.</h1>
        <p className="hero-copy">
          Este MVP ya separa roles, disponibilidad, reservas y control de saldo. La siguiente capa es la
          sincronización operativa con Google Calendar y Meet sin depender de hojas manuales.
        </p>
        <div className="demo-grid">
          {demoUsers.map((user) => (
            <button
              key={user.role}
              type="button"
              className="demo-card"
              onClick={() => {
                const form = document.querySelector('form')
                if (!(form instanceof HTMLFormElement)) return
                ;(form.elements.namedItem('email') as HTMLInputElement).value = user.email
                ;(form.elements.namedItem('password') as HTMLInputElement).value = user.password
              }}
            >
              <strong>{user.role}</strong>
              <span>{user.email}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="auth-card">
        <div className="card-header">
          <p className="eyebrow">Acceso</p>
          <h2>Inicia sesión</h2>
          <p className="muted">Usa un demo rápido o entra con tu usuario real cuando conectemos la cuenta oficial.</p>
        </div>
        <form onSubmit={onSubmit} className="stack-md">
          <div className="stack-xs">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" name="email" defaultValue="admin@academy.test" className="input" />
          </div>
          <div className="stack-xs">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" name="password" defaultValue="admin123" className="input" />
          </div>
          {error ? <p className="alert-error">{error}</p> : null}
          <button type="submit" className="button-primary" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </div>
  )
}
