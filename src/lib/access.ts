import { createHash, randomBytes } from 'crypto'

import { AccessTokenPurpose, UserRole } from '@prisma/client'

import { hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTransactionalEmail } from '@/lib/notifications/dispatcher'

export type PortalAccessMode = 'TEST_GLOBAL' | 'INVITATION' | 'NO_PORTAL'

const INVITATION_HOURS = 72
const TEMPORARY_PASSWORD_HOURS = 24

export function normalizePortalAccessMode(value: string | null | undefined): PortalAccessMode {
  if (value === 'INVITATION' || value === 'NO_PORTAL') return value
  return 'TEST_GLOBAL'
}

export function isPortalRole(role: UserRole) {
  return role === UserRole.STUDENT || role === UserRole.TEACHER
}

export function isAccessTestMode() {
  return process.env.ACCESS_TEST_MODE !== 'false'
}

export function getTestGlobalPortalPassword() {
  return process.env.TEST_GLOBAL_PORTAL_PASSWORD || 'teatime123'
}

export function canUseTestGlobalPortalPassword(role: UserRole, password: string) {
  return isAccessTestMode() && isPortalRole(role) && password === getTestGlobalPortalPassword()
}

function randomSecret() {
  return randomBytes(32).toString('base64url')
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function getAppBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.SMOKE_BASE_URL || 'http://localhost:3002').replace(/\/$/, '')
}

export async function buildNewUserAccess(role: UserRole, requestedMode: PortalAccessMode) {
  const mode = isPortalRole(role) ? requestedMode : 'INVITATION'
  const usesGlobalPassword = mode === 'TEST_GLOBAL' && isAccessTestMode()
  return {
    mode,
    password: await hashPassword(usesGlobalPassword ? getTestGlobalPortalPassword() : randomSecret()),
    isActive: usesGlobalPassword,
    forcePasswordChange: false,
    passwordExpiresAt: null as Date | null,
  }
}

export async function issueUserAccessLink({
  userId,
  createdById,
  purpose = AccessTokenPurpose.INVITATION,
  sendEmail = true,
}: {
  userId: string
  createdById: string
  purpose?: AccessTokenPurpose
  sendEmail?: boolean
}) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('USER_NOT_FOUND')
  if (!user.email) throw new Error('USER_EMAIL_REQUIRED')

  const token = randomSecret()
  const expiresAt = new Date(Date.now() + INVITATION_HOURS * 60 * 60 * 1000)
  await prisma.$transaction(async (tx) => {
    await tx.accessToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    })
    await tx.accessToken.create({
      data: { userId, tokenHash: tokenHash(token), purpose, expiresAt, createdById },
    })
    await tx.auditLog.create({
      data: {
        actorId: createdById,
        action: purpose === AccessTokenPurpose.RESET ? 'ACCESS_RESET_ISSUED' : 'ACCESS_INVITATION_ISSUED',
        entityType: 'USER',
        entityId: userId,
        after: JSON.stringify({ purpose, expiresAt: expiresAt.toISOString() }),
      },
    })
  })

  const url = `${getAppBaseUrl()}/access/${token}`
  const actionLabel = purpose === AccessTokenPurpose.RESET ? 'restablecer tu acceso' : 'activar tu acceso'
  const delivery = sendEmail
    ? await sendTransactionalEmail({
        targetId: user.id,
        to: user.email,
        subject: purpose === AccessTokenPurpose.RESET ? 'Restablece tu acceso a TEATIME Ops' : 'Activa tu acceso a TEATIME Ops',
        message: `Hola ${user.name},\n\nUsa este enlace para ${actionLabel} y crear tu contraseña: ${url}\n\nEl enlace vence en 72 horas.`,
        createdBy: createdById,
      })
    : null

  return { url, expiresAt, delivery }
}

export async function getValidAccessToken(token: string) {
  const accessToken = await prisma.accessToken.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  })
  if (!accessToken || accessToken.usedAt || accessToken.expiresAt <= new Date()) return null
  return accessToken
}

export async function activateAccessToken(input: { token: string; email: string; password: string }) {
  const accessToken = await getValidAccessToken(input.token)
  if (!accessToken) throw new Error('ACCESS_LINK_INVALID')
  if (accessToken.user.email.toLowerCase() !== input.email.trim().toLowerCase()) throw new Error('ACCESS_EMAIL_MISMATCH')
  if (input.password.length < 8) throw new Error('PASSWORD_TOO_SHORT')

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: accessToken.userId },
      data: {
        password: await hashPassword(input.password),
        isActive: true,
        emailVerifiedAt: new Date(),
        forcePasswordChange: false,
        passwordExpiresAt: null,
      },
    })
    await tx.accessToken.update({ where: { id: accessToken.id }, data: { usedAt: new Date() } })
  })
}

export async function generateTemporaryPassword(userId: string, createdById: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('USER_NOT_FOUND')

  const password = randomBytes(9).toString('base64url')
  const expiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_HOURS * 60 * 60 * 1000)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        password: await hashPassword(password),
        isActive: true,
        forcePasswordChange: true,
        passwordExpiresAt: expiresAt,
      },
    })
    await tx.auditLog.create({
      data: {
        actorId: createdById,
        action: 'TEMPORARY_PASSWORD_GENERATED',
        entityType: 'USER',
        entityId: userId,
        after: JSON.stringify({ expiresAt: expiresAt.toISOString() }),
      },
    })
  })

  return { password, expiresAt }
}
