'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ContactSource, ContactStatus, NotificationStatus } from '@prisma/client'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

export async function createCrmContactAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/crm')

  const fullName = String(formData.get('fullName') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const phoneE164 = String(formData.get('phoneE164') || '').trim()
  const preferredLanguage = String(formData.get('preferredLanguage') || 'es').trim() || 'es'
  const source = getEnumValue(ContactSource, formData.get('source'), ContactSource.WHATSAPP)
  const status = getEnumValue(ContactStatus, formData.get('status'), ContactStatus.NEW)
  const notes = String(formData.get('notes') || '').trim()

  if (!fullName || (!email && !phoneE164)) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'MISSING_CONTACT_FIELDS' }))
  }

  const contact = await prisma.crmContact.create({
    data: {
      fullName,
      email: email || null,
      phoneE164: phoneE164 || null,
      preferredLanguage,
      source,
      status,
      notes: notes || null,
      ownerId: session.userId,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: 'CRM_CONTACT_CREATED',
      entityType: 'CRM_CONTACT',
      entityId: contact.id,
      after: JSON.stringify({ fullName, email, phoneE164, source, status }),
    },
  })

  revalidatePath('/admin/crm')
  redirect(withQuery(redirectPath, { crm: 'created' }))
}

export async function updateCrmContactStatusAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/crm')
  const contactId = String(formData.get('contactId') || '')
  const status = getEnumValue(ContactStatus, formData.get('status'), ContactStatus.CONTACTED)
  const notes = String(formData.get('notes') || '').trim()

  if (!contactId) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'MISSING_CONTACT_ID' }))
  }

  const contact = await prisma.crmContact.findUnique({ where: { id: contactId } })
  if (!contact) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'CONTACT_NOT_FOUND' }))
  }

  const updatedNotes = notes ? [contact.notes, notes].filter(Boolean).join('\n') : contact.notes

  await prisma.$transaction(async (tx) => {
    await tx.crmContact.update({
      where: { id: contactId },
      data: { status, notes: updatedNotes },
    })
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'CRM_CONTACT_STATUS_UPDATED',
        entityType: 'CRM_CONTACT',
        entityId: contactId,
        before: JSON.stringify({ status: contact.status }),
        after: JSON.stringify({ status, noteAdded: Boolean(notes) }),
      },
    })
  })

  revalidatePath('/admin/crm')
  redirect(withQuery(redirectPath, { crm: 'updated' }))
}

export async function createNotificationDraftAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/notifications')

  const targetType = String(formData.get('targetType') || '').trim()
  const targetId = String(formData.get('targetId') || '').trim()
  const channel = String(formData.get('channel') || 'WHATSAPP').trim().toUpperCase()
  const message = String(formData.get('message') || '').trim()

  if (!targetType || !targetId || !message) {
    redirect(withQuery(redirectPath, { notification: 'error', code: 'MISSING_NOTIFICATION_FIELDS' }))
  }

  const notification = await prisma.notificationAttempt.create({
    data: {
      targetType,
      targetId,
      channel,
      status: NotificationStatus.PENDING,
      payload: JSON.stringify({ message, createdBy: session.userId }),
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: 'NOTIFICATION_DRAFT_CREATED',
      entityType: 'NOTIFICATION_ATTEMPT',
      entityId: notification.id,
      after: JSON.stringify({ targetType, targetId, channel }),
    },
  })

  revalidatePath('/admin/notifications')
  redirect(withQuery(redirectPath, { notification: 'created' }))
}

export async function markNotificationStatusAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const redirectPath = String(formData.get('redirectPath') || '/admin/notifications')
  const notificationId = String(formData.get('notificationId') || '')
  const status = getEnumValue(NotificationStatus, formData.get('status'), NotificationStatus.SENT)
  const providerId = String(formData.get('providerId') || '').trim()

  if (!notificationId) {
    redirect(withQuery(redirectPath, { notification: 'error', code: 'MISSING_NOTIFICATION_ID' }))
  }

  const notification = await prisma.notificationAttempt.findUnique({ where: { id: notificationId } })
  if (!notification) {
    redirect(withQuery(redirectPath, { notification: 'error', code: 'NOTIFICATION_NOT_FOUND' }))
  }

  await prisma.$transaction(async (tx) => {
    await tx.notificationAttempt.update({
      where: { id: notificationId },
      data: { status, providerId: providerId || notification.providerId },
    })
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'NOTIFICATION_STATUS_UPDATED',
        entityType: 'NOTIFICATION_ATTEMPT',
        entityId: notificationId,
        before: JSON.stringify({ status: notification.status }),
        after: JSON.stringify({ status, providerId }),
      },
    })
  })

  revalidatePath('/admin/notifications')
  redirect(withQuery(redirectPath, { notification: 'updated' }))
}
