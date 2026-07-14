'use client'

import { useState } from 'react'
import { ActionIconButton } from '@/components/action-icon-button'

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
    <div className="access-actions" aria-label="Acciones de acceso">
      <ActionIconButton type="button" icon="invite" label={loading === 'invite' ? 'Enviando invitación...' : 'Enviar invitación por correo'} disabled={loading !== null} onClick={() => run('invite')} />
      <ActionIconButton type="button" icon="copy" label={loading === 'copy' ? 'Copiando enlace...' : 'Copiar enlace para WhatsApp'} disabled={loading !== null} onClick={() => run('copy')} />
      <ActionIconButton type="button" icon="reset" label={loading === 'reset' ? 'Generando restablecimiento...' : 'Restablecer acceso'} disabled={loading !== null} onClick={() => run('reset')} />
      <ActionIconButton type="button" icon="key" label={loading === 'temporary' ? 'Generando clave...' : 'Generar contraseña temporal'} tone="danger" disabled={loading !== null} onClick={() => run('temporary')} />
      {notice ? <small className="access-action-notice" aria-live="polite">{notice}</small> : null}
    </div>
  )
}
