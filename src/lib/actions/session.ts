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

async function recordLoginAttempt(email: string, success: boolean, reason?: string, ipHash?: string, userAgent?: string) {
  await prisma.loginAttempt.create({
    data: {
      email,
      ipHash: ipHash || null,
      userAgent: userAgent ? userAgent.slice(0, 240) : null,
      success,
      reason: reason || null,
    },
  })
}

async function isLoginRateLimited(email: string, ipHash?: string) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000)
  const emailFailures = await prisma.loginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: { gte: since },
    },
  })
  if (emailFailures >= LOGIN_MAX_FAILURES) return true

  if (!ipHash) return false
  const ipFailures = await prisma.loginAttempt.count({
    where: {
      ipHash,
      success: false,
      createdAt: { gte: since },
    },
  })
  return ipFailures >= LOGIN_MAX_FAILURES * 2
}

export async function loginAction(formData: FormData) {
  const parsed = LoginSchema.parse({
    email: String(formData.get('email') || ''),
    password: String(formData.get('password') || ''),
  })
  const email = parsed.email.toLowerCase()
  const ipHash = String(formData.get('__ipHash') || '')
  const userAgent = String(formData.get('__userAgent') || '')

  if (!process.env.DATABASE_URL) {
    return { ok: false, error: 'No hay DATABASE_URL configurado. Revisa el .env' }
  }

  if (await isLoginRateLimited(email, ipHash)) {
    await recordLoginAttempt(email, false, 'RATE_LIMITED', ipHash, userAgent)
    return { ok: false, error: 'Demasiados intentos fallidos. Espera 15 minutos o contacta al administrador.' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    await recordLoginAttempt(email, false, 'USER_NOT_FOUND', ipHash, userAgent)
    return { ok: false, error: 'Credenciales inválidas' }
  }
  if (!user.isActive) {
    await recordLoginAttempt(email, false, 'USER_INACTIVE', ipHash, userAgent)
    return { ok: false, error: 'Usuario inactivo. Contacta al administrador.' }
  }

  const isMatch = await verifyPassword(parsed.password, user.password)
  if (!isMatch) {
    await recordLoginAttempt(email, false, 'BAD_PASSWORD', ipHash, userAgent)
    return { ok: false, error: 'Credenciales inválidas' }
  }

  await recordLoginAttempt(email, true, 'OK', ipHash, userAgent)
  await createSession(user.id, user.role)
  return { ok: true, role: user.role }
}

export async function logoutAction() {
  const { clearSession } = await import('@/lib/auth')
  await clearSession()
  return { ok: true }
}
