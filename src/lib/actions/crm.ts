'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ContactSource, ContactStatus, CrmActivityStatus, CrmActivityType, NotificationStatus, UserRole } from '@prisma/client'
import { hashPassword, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeClassLanguage } from '@/lib/class-title'

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
  const interestProgram = String(formData.get('interestProgram') || '').trim()
  const level = String(formData.get('level') || '').trim()
  const nextFollowUpAtRaw = String(formData.get('nextFollowUpAt') || '')
  const notes = String(formData.get('notes') || '').trim()
  const nextFollowUpAt = nextFollowUpAtRaw ? new Date(nextFollowUpAtRaw) : null

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
      interestProgram: interestProgram || null,
      level: level || null,
      nextFollowUpAt: nextFollowUpAt && !isNaN(nextFollowUpAt.getTime()) ? nextFollowUpAt : null,
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

export async function createCrmActivityAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const contactId = String(formData.get('contactId') || '')
  const redirectPath = String(formData.get('redirectPath') || `/admin/crm/${contactId}`)
  const type = getEnumValue(CrmActivityType, formData.get('type'), CrmActivityType.NOTE)
  const title = String(formData.get('title') || '').trim()
  const body = String(formData.get('body') || '').trim()
  const dueAtRaw = String(formData.get('dueAt') || '')
  const dueAt = dueAtRaw ? new Date(dueAtRaw) : null

  if (!contactId || !title) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'MISSING_ACTIVITY_FIELDS' }))
  }

  const contact = await prisma.crmContact.findUnique({ where: { id: contactId } })
  if (!contact) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'CONTACT_NOT_FOUND' }))
  }

  await prisma.$transaction(async (tx) => {
    await tx.crmActivity.create({
      data: {
        contactId,
        actorId: session.userId,
        type,
        status: type === CrmActivityType.NOTE ? CrmActivityStatus.DONE : CrmActivityStatus.OPEN,
        title,
        body: body || null,
        dueAt: dueAt && !isNaN(dueAt.getTime()) ? dueAt : null,
        completedAt: type === CrmActivityType.NOTE ? new Date() : null,
      },
    })
    await tx.crmContact.update({
      where: { id: contactId },
      data: {
        status: type === CrmActivityType.TRIAL_CLASS ? ContactStatus.TRIAL_SCHEDULED : contact.status,
        nextFollowUpAt:
          dueAt && !isNaN(dueAt.getTime()) && type !== CrmActivityType.NOTE ? dueAt : contact.nextFollowUpAt,
      },
    })
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'CRM_ACTIVITY_CREATED',
        entityType: 'CRM_CONTACT',
        entityId: contactId,
        after: JSON.stringify({ type, title, dueAt: dueAt?.toISOString() }),
      },
    })
  })

  revalidatePath('/admin/crm')
  revalidatePath(`/admin/crm/${contactId}`)
  redirect(withQuery(redirectPath, { crm: 'activity_created' }))
}

export async function completeCrmActivityAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const activityId = String(formData.get('activityId') || '')
  const contactId = String(formData.get('contactId') || '')
  const redirectPath = String(formData.get('redirectPath') || `/admin/crm/${contactId}`)

  if (!activityId || !contactId) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'MISSING_ACTIVITY_ID' }))
  }

  const activity = await prisma.crmActivity.findUnique({ where: { id: activityId } })
  if (!activity) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'ACTIVITY_NOT_FOUND' }))
  }

  await prisma.$transaction(async (tx) => {
    await tx.crmActivity.update({
      where: { id: activityId },
      data: { status: CrmActivityStatus.DONE, completedAt: new Date() },
    })
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'CRM_ACTIVITY_COMPLETED',
        entityType: 'CRM_ACTIVITY',
        entityId: activityId,
        before: JSON.stringify({ status: activity.status }),
        after: JSON.stringify({ status: CrmActivityStatus.DONE }),
      },
    })
  })

  revalidatePath('/admin/crm')
  revalidatePath(`/admin/crm/${contactId}`)
  redirect(withQuery(redirectPath, { crm: 'activity_completed' }))
}

export async function convertCrmContactToStudentAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const contactId = String(formData.get('contactId') || '')
  const redirectPath = String(formData.get('redirectPath') || `/admin/crm/${contactId}`)
  const teacherId = String(formData.get('teacherId') || '')
  const totalHoursRaw = formData.get('totalHours')
  const totalMinutesRaw = formData.get('totalMinutes')
  const totalHours = totalHoursRaw ? Number(totalHoursRaw) : Number(totalMinutesRaw || 1200) / 60
  const totalMinutes = Math.round(totalHours * 60)
  const validToRaw = String(formData.get('validTo') || '')
  const classLanguage = normalizeClassLanguage(String(formData.get('classLanguage') || 'Inglés'))

  if (!contactId || !teacherId || totalHours <= 0 || totalMinutes <= 0 || !validToRaw) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'MISSING_CONVERSION_FIELDS' }))
  }

  const validTo = new Date(validToRaw)
  if (isNaN(validTo.getTime())) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'INVALID_VALID_TO' }))
  }

  const contact = await prisma.crmContact.findUnique({ where: { id: contactId } })
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
  if (!contact || !teacher) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'RELATED_ENTITY_NOT_FOUND' }))
  }
  if (contact.convertedStudentId) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'CONTACT_ALREADY_CONVERTED' }))
  }
  if (!contact.email) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'CONTACT_EMAIL_REQUIRED' }))
  }

  const existingUser = await prisma.user.findUnique({ where: { email: contact.email } })
  if (existingUser) {
    redirect(withQuery(redirectPath, { crm: 'error', code: 'EMAIL_ALREADY_EXISTS' }))
  }

  const password = await hashPassword('alumno123')
  const studentCode = `STU-${String((await prisma.student.count()) + 1).padStart(3, '0')}`

  const student = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: contact.email!,
        password,
        name: contact.fullName,
        phoneE164: contact.phoneE164,
        role: UserRole.STUDENT,
      },
    })
    const createdStudent = await tx.student.create({
      data: {
        userId: user.id,
        studentCode,
        notes: contact.notes || `Convertido desde CRM ${contact.id}`,
      },
    })
    await tx.hourPackage.create({
      data: {
        studentId: createdStudent.id,
        totalHours: Math.ceil(totalHours),
        totalMinutes,
        validFrom: new Date(),
        validTo,
        status: 'ACTIVE',
        allowedClassTypes: 'ONE_ON_ONE,GROUP',
        allowedDurations: '50,60,90',
        classLanguage,
      },
    })
    await tx.studentTeacherAssignment.create({
      data: {
        studentId: createdStudent.id,
        teacherId,
        assignedByUserId: session.userId,
        isPrimary: true,
        notes: 'Asignado al convertir desde CRM',
      },
    })
    await tx.crmContact.update({
      where: { id: contactId },
      data: { status: ContactStatus.ACTIVE_STUDENT, convertedStudentId: createdStudent.id },
    })
    await tx.crmActivity.create({
      data: {
        contactId,
        actorId: session.userId,
        type: CrmActivityType.NOTE,
        status: CrmActivityStatus.DONE,
        title: 'Convertido a alumno',
        body: `Usuario creado con contraseña temporal alumno123. Código: ${studentCode}.`,
        completedAt: new Date(),
      },
    })
    await tx.auditLog.create({
      data: {
        actorId: session.userId,
        action: 'CRM_CONTACT_CONVERTED_TO_STUDENT',
        entityType: 'CRM_CONTACT',
        entityId: contactId,
        after: JSON.stringify({ studentId: createdStudent.id, teacherId, totalMinutes }),
      },
    })
    return createdStudent
  })

  revalidatePath('/admin/crm')
  revalidatePath(`/admin/crm/${contactId}`)
  revalidatePath('/admin/students')
  revalidatePath('/admin/packages')
  redirect(withQuery(`/admin/students?highlight=${student.id}`, { crm: 'converted' }))
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
  const to = String(formData.get('to') || '').trim()
  const phoneE164 = String(formData.get('phoneE164') || '').trim()
  const subject = String(formData.get('subject') || '').trim()

  if (!targetType || !targetId || !message) {
    redirect(withQuery(redirectPath, { notification: 'error', code: 'MISSING_NOTIFICATION_FIELDS' }))
  }

  const notification = await prisma.notificationAttempt.create({
    data: {
      targetType,
      targetId,
      channel,
      status: NotificationStatus.PENDING,
      payload: JSON.stringify({ message, subject: subject || undefined, to: to || undefined, phoneE164: phoneE164 || undefined, createdBy: session.userId }),
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
