'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export function ChangePasswordForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    const confirmation = String(form.get('confirmation') || '')
    if (password !== confirmation) return setError('Las contraseñas no coinciden.')
    setIsLoading(true)
    setError('')
    const response = await fetch('/api/access/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const result = await response.json().catch(() => ({ error: 'No se pudo actualizar la contraseña.' }))
    if (!response.ok) {
      setIsLoading(false)
      return setError(result.error || 'No se pudo actualizar la contraseña.')
    }
    router.push('/')
    router.refresh()
  }

  return (
    <form className="stack-md" onSubmit={submit}>
      <div className="stack-xs"><label htmlFor="password">Nueva contraseña</label><input id="password" name="password" type="password" minLength={8} className="input" required autoComplete="new-password" /></div>
      <div className="stack-xs"><label htmlFor="confirmation">Confirma la contraseña</label><input id="confirmation" name="confirmation" type="password" minLength={8} className="input" required autoComplete="new-password" /></div>
      {error ? <p className="alert-error">{error}</p> : null}
      <button type="submit" className="button-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : 'Guardar contraseña'}</button>
    </form>
  )
}
