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
      body: JSON.stringify({
        token,
        email: form.get('email'),
        password: form.get('password'),
        termsAccepted: form.get('termsAccepted') === 'on',
        privacyAccepted: form.get('privacyAccepted') === 'on',
        transcriptionAccepted: form.get('transcriptionAccepted') === 'on',
      }),
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
      <label className="consent-option">
        <input name="termsAccepted" type="checkbox" required />
        <span>He leído y acepto los <a href="/legal/terms" target="_blank" rel="noreferrer">Términos y condiciones</a>.</span>
      </label>
      <label className="consent-option">
        <input name="privacyAccepted" type="checkbox" required />
        <span>Autorizo el tratamiento de mis datos conforme a la <a href="/legal/privacy" target="_blank" rel="noreferrer">Política de privacidad</a>.</span>
      </label>
      <label className="consent-option">
        <input name="transcriptionAccepted" type="checkbox" />
        <span>Autorizo de forma opcional la transcripción de mis clases virtuales para generar historial e informe pedagógico. Puedo retirar esta autorización antes de futuras clases.</span>
      </label>
      {error ? <p className="alert-error">{error}</p> : null}
      <button type="submit" className="button-primary" disabled={isLoading}>{isLoading ? 'Activando...' : 'Activar mi acceso'}</button>
    </form>
  )
}
