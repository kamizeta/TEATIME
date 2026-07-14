'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export function LegalConsentForm({ transcriptionAccepted }: { transcriptionAccepted: boolean }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/legal/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcriptionAccepted: form.get('transcriptionAccepted') === 'on' }),
    })
    const result = await response.json().catch(() => ({}))
    setLoading(false)
    setMessage(result.message || result.error || 'No se pudo actualizar el consentimiento.')
    if (response.ok) router.refresh()
  }

  return (
    <form className="stack-md" onSubmit={submit}>
      <label className="consent-option">
        <input name="transcriptionAccepted" type="checkbox" defaultChecked={transcriptionAccepted} />
        <span>Autorizo la transcripción automática de mis futuras clases virtuales y la generación de un informe pedagógico.</span>
      </label>
      <p className="hint">El retiro de esta autorización no borra por sí solo los registros que ya debían conservarse por una obligación contractual o legal. Para solicitudes de supresión, usa el canal de privacidad de TEATIME.</p>
      <button className="button-primary" disabled={loading} type="submit">{loading ? 'Guardando...' : 'Guardar consentimiento'}</button>
      {message ? <p className="status-success">{message}</p> : null}
    </form>
  )
}
