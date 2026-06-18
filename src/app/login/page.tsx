'use client'

export const dynamic = 'force-dynamic'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginAction } from '@/lib/actions/session'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const result = await loginAction(fd)
    if (!result.ok) return setError(result.error || 'No se pudo iniciar sesión')
    router.push('/')
  }

  return (
    <div style={{ width: 400, margin: '40px auto', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <h1>Entrar</h1>
      <form onSubmit={onSubmit}>
        <label>Email</label>
        <input type="email" name="email" defaultValue="admin@academy.test" style={{ width: '100%', padding: 8 }} />
        <label style={{ display: 'block', marginTop: 12 }}>Contraseña</label>
        <input type="password" name="password" defaultValue="admin123" style={{ width: '100%', padding: 8 }} />
        {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
        <button type="submit" style={{ marginTop: 12 }}>Ingresar</button>
      </form>
    </div>
  )
}
