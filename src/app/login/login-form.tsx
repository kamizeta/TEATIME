'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

const demoUsers = [
  { role: 'Administrador', email: 'admin@academy.test', password: 'admin123' },
  { role: 'Equipo operativo', email: 'staff@academy.test', password: 'staff123' },
  { role: 'Profesor', email: 'profesor@academy.test', password: 'prof123' },
  { role: 'Alumno', email: 'alumno@academy.test', password: 'alumno123' },
] as const

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const response = await fetch('/api/login', {
      method: 'POST',
      body: fd,
    })
    const result = await response.json().catch(() => ({ ok: false, error: 'No se pudo iniciar sesión' }))
    if (!result.ok) {
      setIsLoading(false)
      return setError(result.error || 'No se pudo iniciar sesión')
    }
    router.push('/')
    router.refresh()
  }

  return (
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
  )
}
