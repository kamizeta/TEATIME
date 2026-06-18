'use server'

import { z } from 'zod'
import { createSession, clearSession, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export async function loginAction(formData: FormData) {
  const parsed = LoginSchema.parse({
    email: String(formData.get('email') || ''),
    password: String(formData.get('password') || ''),
  })

  const user = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase() } })
  if (!user) return { ok: false, error: 'Credenciales inválidas' }

  const isMatch = await verifyPassword(parsed.password, user.password)
  if (!isMatch) return { ok: false, error: 'Credenciales inválidas' }

  await createSession(user.id, user.role)
  return { ok: true, role: user.role }
}

export async function logoutAction() {
  await clearSession()
  return { ok: true }
}
