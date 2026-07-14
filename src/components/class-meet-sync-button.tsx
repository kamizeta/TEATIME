'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ClassMeetSyncButton({ classId }: { classId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function sync() {
    setLoading(true)
    setMessage('')
    const response = await fetch('/api/jobs/meet-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId }),
    })
    const result = await response.json().catch(() => ({}))
    setLoading(false)
    setMessage(result.message || result.error || 'No se pudo sincronizar Meet.')
    if (response.ok) router.refresh()
  }

  return (
    <div className="stack-xs">
      <button type="button" className="button-ghost" onClick={sync} disabled={loading}>
        {loading ? 'Consultando Meet...' : 'Actualizar evidencia, transcripción e informe'}
      </button>
      {message ? <small className="block-muted">{message}</small> : null}
    </div>
  )
}
