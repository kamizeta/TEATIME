import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import type { AppRole } from '@/lib/navigation'
import { getJwtSecret } from '@/lib/security'

type SessionPayload = {
  userId: string
  role: AppRole
}

const COOKIE_NAME = 'asistencia_session'
const SESSION_TTL_SECONDS = 60 * 60 * 12
function sessionSecret() {
  return new TextEncoder().encode(getJwtSecret())
}

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
    .sign(sessionSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, '', { path: '/', maxAge: 0, expires: new Date(0) })
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, sessionSecret())
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
