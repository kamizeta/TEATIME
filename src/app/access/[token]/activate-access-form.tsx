'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export function ActivateAccessForm({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/access/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email: form.get('email'), password: form.get('password') }),
    })
    const result = await response.json().catch(() => ({ error: 'No se pudo activar el acceso.' }))
    if (!response.ok) {
      setIsLoading(false)
      setError(result.error || 'No se pudo activar el acceso.')
      return
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <form className="stack-md" onSubmit={submit}>
      <div className="stack-xs">
        <label htmlFor="email">Confirma tu correo electrónico</label>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
      </div>
      <div className="stack-xs">
        <label htmlFor="password">Crea tu contraseña</label>
        <input id="password" name="password" type="password" minLength={8} className="input" required autoComplete="new-password" />
      </div>
      {error ? <p className="alert-error">{error}</p> : null}
      <button type="submit" className="button-primary" disabled={isLoading}>{isLoading ? 'Activando...' : 'Activar mi acceso'}</button>
    </form>
  )
}
