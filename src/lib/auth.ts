import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import type { AppRole } from '@/lib/navigation'

type SessionPayload = {
  userId: string
  role: AppRole
}

const COOKIE_NAME = 'asistencia_session'
const SESSION_TTL_SECONDS = 60 * 60 * 12
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-insecure')

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function createSession(userId: string, role: AppRole) {
  const token = await new SignJWT({ userId, role } as SessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret)

  cookies().set(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function clearSession() {
  cookies().set(COOKIE_NAME, '', { path: '/', maxAge: 0 })
}

export async function getSession() {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as SessionPayload
  } catch {
    return null
  }
}

export async function requireRole(roles: AppRole[]) {
  const session = await getSession()
  if (!session || !roles.includes(session.role)) {
    throw new Error('UNAUTHORIZED')
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) throw new Error('UNAUTHORIZED')
  if (!user.isActive) throw new Error('UNAUTHORIZED')
  if (user.role !== session.role || !roles.includes(user.role)) throw new Error('UNAUTHORIZED')

  return { userId: session.userId, role: user.role }
}
