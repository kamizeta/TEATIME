'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  MessageTemplateChannel,
  UserRole,
  WeeklyClosingStatus,
} from '@prisma/client'
import { hashPassword, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { processNotificationQueue } from '@/lib/notifications/dispatcher'

function withQuery(path: string, entries: Record<string, string>) {
  const [pathname, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  for (const [key, value] of Object.entries(entries)) params.set(key, value)
  return `${pathname}?${params.toString()}`
}

function getEnumValue<T extends Record<string, string>>(values: T, raw: FormDataEntryValue | null, fallback: T[keyof T]) {
  const value = String(raw || '')
  return Object.values(values).includes(value) ? (value as T[keyof T]) : fallback
}

function toWeekBounds(raw: string) {
  const base = raw ? new Date(`${raw}T00:00:00`) : new Date()
  if (isNaN(base.getTime())) return null
  const day = base.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const weekStart = new Date(base)
  weekStart.setDate(base.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return { weekStart, weekEnd }
}

export async function createIncidentAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/incidents')
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const classEventId = String(formData.get('classEventId') || '').trim()
  const assignedToId = String(formData.get('assignedToId') || '').trim()
  const type = getEnumValue(IncidentType, formData.get('type'), IncidentType.OTHER)
  const severity = getEnumValue(IncidentSeverity, formData.get('severity'), IncidentSeverity.MEDIUM)

  if (!title) redirect(withQuery(redirectPath, { incident: 'error', code: 'MISSING_INCIDENT_TITLE' }))

  const incident = await prisma.incident.create({
    data: {
      title,
      description: description || null,
      classEventId: classEventId || null,
      assignedToId: assignedToId || null,
      type,
      severity,
      reportedById: session.userId,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: 'INCIDENT_CREATED',
      entityType: 'INCIDENT',
      entityId: incident.id,
      after: JSON.stringify({ title, type, severity, classEventId, assignedToId }),
    },
  })

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/incidents')
  redirect(withQuery(redirectPath, { incident: 'created' }))
}

export async function updateIncidentAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/incidents')
  const incidentId = String(formData.get('incidentId') || '')
  const status = getEnumValue(IncidentStatus, formData.get('status'), IncidentStatus.IN_REVIEW)
  const severity = getEnumValue(IncidentSeverity, formData.get('severity'), IncidentSeverity.MEDIUM)
  const assignedToId = String(formData.get('assignedToId') || '').trim()
  const resolutionNote = String(formData.get('resolutionNote') || '').trim()

  if (!incidentId) redirect(withQuery(redirectPath, { incident: 'error', code: 'MISSING_INCIDENT_ID' }))

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } })
  if (!incident) redirect(withQuery(redirectPath, { incident: 'error', code: 'INCIDENT_NOT_FOUND' }))

  await prisma.$transaction(async (tx) => {
    await tx.incident.update({
      where: { id: incidentId },
      data: {
        status,
        severity,
        assignedToId: assignedToId || null,
        resolutionNote: resolutionNote || incident.resolutionNote,
        resolvedById: status === IncidentStatus.RESOLVED || status === IncidentStatus.DISMISSED ? session.userId : null,
        resolvedAt: status === IncidentStatus.RESOLVED || status === IncidentStatus.DISMISSED ? new Date() : null,
      },
    })
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'INCIDENT_UPDATED',
        entityType: 'INCIDENT',
        entityId: incidentId,
        before: JSON.stringify({ status: incident.status, severity: incident.severity }),
        after: JSON.stringify({ status, severity, assignedToId, resolutionNote }),
      },
    })
  })

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/incidents')
  redirect(withQuery(redirectPath, { incident: 'updated' }))
}

export async function markWeeklyClosingReviewedAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/weekly-closing')
  const week = String(formData.get('week') || '')
  const summary = String(formData.get('summary') || '').trim()
  const bounds = toWeekBounds(week)

  if (!bounds) redirect(withQuery(redirectPath, { closing: 'error', code: 'INVALID_WEEK' }))

  await prisma.weeklyClosing.upsert({
    where: { weekStart: bounds.weekStart },
    update: {
      weekEnd: bounds.weekEnd,
      status: WeeklyClosingStatus.REVIEWED,
      summary: summary || null,
      reviewedById: session.userId,
      reviewedAt: new Date(),
    },
    create: {
      weekStart: bounds.weekStart,
      weekEnd: bounds.weekEnd,
      status: WeeklyClosingStatus.REVIEWED,
      summary: summary || null,
      reviewedById: session.userId,
      reviewedAt: new Date(),
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: 'WEEKLY_CLOSING_REVIEWED',
      entityType: 'WEEKLY_CLOSING',
      entityId: bounds.weekStart.toISOString(),
      after: JSON.stringify({ weekStart: bounds.weekStart.toISOString(), weekEnd: bounds.weekEnd.toISOString(), summary }),
    },
  })

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/weekly-closing')
  redirect(withQuery(`/admin/weekly-closing?week=${bounds.weekStart.toISOString().slice(0, 10)}`, { closing: 'reviewed' }))
}

export async function saveMessageTemplateAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/templates')
  const templateId = String(formData.get('templateId') || '')
  const key = String(formData.get('key') || '').trim().toLowerCase().replace(/\s+/g, '_')
  const name = String(formData.get('name') || '').trim()
  const language = String(formData.get('language') || 'es').trim()
  const subject = String(formData.get('subject') || '').trim()
  const body = String(formData.get('body') || '').trim()
  const channel = getEnumValue(MessageTemplateChannel, formData.get('channel'), MessageTemplateChannel.WHATSAPP)
  const isActive = formData.get('isActive') === 'on'

  if (!key || !name || !body) redirect(withQuery(redirectPath, { template: 'error', code: 'MISSING_TEMPLATE_FIELDS' }))

  const template = templateId
    ? await prisma.messageTemplate.update({
        where: { id: templateId },
        data: { key, name, language, subject: subject || null, body, channel, isActive, updatedByUserId: session.userId },
      })
    : await prisma.messageTemplate.create({
        data: { key, name, language, subject: subject || null, body, channel, isActive, updatedByUserId: session.userId },
      })

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: templateId ? 'MESSAGE_TEMPLATE_UPDATED' : 'MESSAGE_TEMPLATE_CREATED',
      entityType: 'MESSAGE_TEMPLATE',
      entityId: template.id,
      after: JSON.stringify({ key, name, language, channel, isActive }),
    },
  })

  revalidatePath('/admin/templates')
  redirect(withQuery(redirectPath, { template: 'saved' }))
}

export async function createUserAction(formData: FormData) {
  const session = await requireRole(['ADMIN'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/users')
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const name = String(formData.get('name') || '').trim()
  const phoneE164 = String(formData.get('phoneE164') || '').trim()
  const role = getEnumValue(UserRole, formData.get('role'), UserRole.STUDENT)
  const temporaryPassword = String(formData.get('temporaryPassword') || 'teatime123').trim()

  if (!email || !name || temporaryPassword.length < 6) {
    redirect(withQuery(redirectPath, { user: 'error', code: 'MISSING_USER_FIELDS' }))
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) redirect(withQuery(redirectPath, { user: 'error', code: 'EMAIL_ALREADY_EXISTS' }))

  const password = await hashPassword(temporaryPassword)
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, name, phoneE164: phoneE164 || null, role, password, isActive: true },
    })
    if (role === UserRole.TEACHER) await tx.teacher.create({ data: { userId: created.id, timezone: 'America/Bogota' } })
    if (role === UserRole.STUDENT) {
      const studentCode = `STU-${String((await tx.student.count()) + 1).padStart(3, '0')}`
      await tx.student.create({ data: { userId: created.id, studentCode, notes: 'Creado desde admin' } })
    }
    if (role === UserRole.STAFF) await tx.staffPermission.create({ data: { userId: created.id } })
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: created.id,
        after: JSON.stringify({ email, name, role }),
      },
    })
    return created
  })

  revalidatePath('/admin/users')
  revalidatePath('/admin/students')
  redirect(withQuery(`/admin/users?highlight=${user.id}`, { user: 'created' }))
}

export async function updateUserAction(formData: FormData) {
  const session = await requireRole(['ADMIN'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/users')
  const userId = String(formData.get('userId') || '')
  const name = String(formData.get('name') || '').trim()
  const phoneE164 = String(formData.get('phoneE164') || '').trim()
  const isActive = formData.get('isActive') === 'on'

  if (!userId || !name) redirect(withQuery(redirectPath, { user: 'error', code: 'MISSING_USER_FIELDS' }))

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) redirect(withQuery(redirectPath, { user: 'error', code: 'USER_NOT_FOUND' }))

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { name, phoneE164: phoneE164 || null, isActive } })
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'USER_UPDATED',
        entityType: 'USER',
        entityId: userId,
        before: JSON.stringify({ name: user.name, phoneE164: user.phoneE164, isActive: user.isActive }),
        after: JSON.stringify({ name, phoneE164, isActive }),
      },
    })
  })

  revalidatePath('/admin/users')
  redirect(withQuery(redirectPath, { user: 'updated' }))
}

export async function updateStaffPermissionAction(formData: FormData) {
  const session = await requireRole(['ADMIN'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/users')
  const userId = String(formData.get('userId') || '')

  if (!userId) redirect(withQuery(redirectPath, { user: 'error', code: 'MISSING_USER_ID' }))

  await prisma.staffPermission.upsert({
    where: { userId },
    update: {
      canManageUsers: formData.get('canManageUsers') === 'on',
      canManageRules: formData.get('canManageRules') === 'on',
      canCloseWeeks: formData.get('canCloseWeeks') === 'on',
      canResolveIncidents: formData.get('canResolveIncidents') === 'on',
    },
    create: {
      userId,
      canManageUsers: formData.get('canManageUsers') === 'on',
      canManageRules: formData.get('canManageRules') === 'on',
      canCloseWeeks: formData.get('canCloseWeeks') === 'on',
      canResolveIncidents: formData.get('canResolveIncidents') === 'on',
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: 'STAFF_PERMISSIONS_UPDATED',
      entityType: 'USER',
      entityId: userId,
      after: JSON.stringify({
        canManageUsers: formData.get('canManageUsers') === 'on',
        canManageRules: formData.get('canManageRules') === 'on',
        canCloseWeeks: formData.get('canCloseWeeks') === 'on',
        canResolveIncidents: formData.get('canResolveIncidents') === 'on',
      }),
    },
  })

  revalidatePath('/admin/users')
  redirect(withQuery(redirectPath, { user: 'permissions' }))
}

export async function processNotificationQueueAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/notifications')
  const limit = Number(formData.get('limit') || 20)
  const result = await processNotificationQueue(Number.isFinite(limit) ? limit : 20)

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: 'NOTIFICATION_QUEUE_PROCESSED',
      entityType: 'NOTIFICATION_ATTEMPT',
      entityId: 'QUEUE',
      after: JSON.stringify(result),
    },
  })

  revalidatePath('/admin/notifications')
  revalidatePath('/admin/dashboard')
  redirect(withQuery(redirectPath, {
    notification: 'processed',
    processed: String(result.processed),
    sent: String(result.sent),
    failed: String(result.failed),
  }))
}
