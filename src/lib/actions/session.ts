'use server'

import { z } from 'zod'
import { createSession, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const LOGIN_WINDOW_MINUTES = 15
const LOGIN_MAX_FAILURES = 5

async function recordLoginAttempt(email: string, success: boolean, reason?: string) {
  await prisma.loginAttempt.create({
    data: {
      email,
      success,
      reason: reason || null,
    },
  })
}

async function isLoginRateLimited(email: string) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000)
  const failures = await prisma.loginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: { gte: since },
    },
  })
  return failures >= LOGIN_MAX_FAILURES
}

export async function loginAction(formData: FormData) {
  const parsed = LoginSchema.parse({
    email: String(formData.get('email') || ''),
    password: String(formData.get('password') || ''),
  })
  const email = parsed.email.toLowerCase()

  if (!process.env.DATABASE_URL) {
    return { ok: false, error: 'No hay DATABASE_URL configurado. Revisa el .env' }
  }

  if (await isLoginRateLimited(email)) {
    await recordLoginAttempt(email, false, 'RATE_LIMITED')
    return { ok: false, error: 'Demasiados intentos fallidos. Espera 15 minutos o contacta al administrador.' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    await recordLoginAttempt(email, false, 'USER_NOT_FOUND')
    return { ok: false, error: 'Credenciales inválidas' }
  }
  if (!user.isActive) {
    await recordLoginAttempt(email, false, 'USER_INACTIVE')
    return { ok: false, error: 'Usuario inactivo. Contacta al administrador.' }
  }

  const isMatch = await verifyPassword(parsed.password, user.password)
  if (!isMatch) {
    await recordLoginAttempt(email, false, 'BAD_PASSWORD')
    return { ok: false, error: 'Credenciales inválidas' }
  }

  await recordLoginAttempt(email, true, 'OK')
  await createSession(user.id, user.role)
  return { ok: true, role: user.role }
}

export async function logoutAction() {
  const { clearSession } = await import('@/lib/auth')
  await clearSession()
  return { ok: true }
}
