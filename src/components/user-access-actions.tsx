'use client'

import { useState } from 'react'

type AccessAction = 'invite' | 'copy' | 'reset' | 'temporary'

export function UserAccessActions({ userId, role }: { userId: string; role: string }) {
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState<AccessAction | null>(null)

  if (role !== 'TEACHER' && role !== 'STUDENT') return null

  const run = async (action: AccessAction) => {
    setLoading(action)
    setNotice('')
    try {
      const response = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo gestionar el acceso.')

      if (action === 'copy') {
        await navigator.clipboard.writeText(result.url)
        setNotice('Enlace copiado. Vence en 72 horas.')
      } else if (action === 'temporary') {
        setNotice(`Clave temporal, visible solo ahora: ${result.password}. Vence: ${new Date(result.expiresAt).toLocaleString('es-CO')}.`)
      } else if (action === 'invite') {
        setNotice(result.delivery?.dryRun ? 'Invitación generada. El envío está en modo prueba; usa Copiar enlace para WhatsApp.' : 'Invitación enviada por correo.')
      } else {
        setNotice(result.delivery?.dryRun ? 'Enlace de restablecimiento generado en modo prueba.' : 'Enlace de restablecimiento enviado por correo.')
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo gestionar el acceso.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="access-actions">
      <button type="button" className="button-ghost compact-button" disabled={loading !== null} onClick={() => run('invite')}>{loading === 'invite' ? 'Enviando...' : 'Enviar invitación'}</button>
      <button type="button" className="button-ghost compact-button" disabled={loading !== null} onClick={() => run('copy')}>{loading === 'copy' ? 'Copiando...' : 'Copiar enlace'}</button>
      <button type="button" className="button-ghost compact-button" disabled={loading !== null} onClick={() => run('reset')}>{loading === 'reset' ? 'Generando...' : 'Restablecer acceso'}</button>
      <button type="button" className="button-ghost compact-button" disabled={loading !== null} onClick={() => run('temporary')}>{loading === 'temporary' ? 'Generando...' : 'Clave temporal'}</button>
      {notice ? <small className="access-action-notice">{notice}</small> : null}
    </div>
  )
}
