import { NotificationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type NotificationPayload = {
  message?: string
  subject?: string
  to?: string
  phoneE164?: string
  createdBy?: string
  dispatch?: unknown[]
  [key: string]: unknown
}

type DispatchResult = {
  ok: boolean
  provider: string
  providerId?: string
  error?: string
  dryRun: boolean
}

function parsePayload(payload: string | null): NotificationPayload {
  if (!payload) return {}
  try {
    return JSON.parse(payload) as NotificationPayload
  } catch {
    return { message: payload }
  }
}

function mergePayload(payload: string | null, result: DispatchResult) {
  const parsed = parsePayload(payload)
  return JSON.stringify({
    ...parsed,
    dispatch: [
      ...((Array.isArray(parsed.dispatch) ? parsed.dispatch : []) as unknown[]),
      {
        ...result,
        at: new Date().toISOString(),
      },
    ],
  })
}

async function resolveRecipient(targetType: string, targetId: string, payload: NotificationPayload) {
  if (payload.to || payload.phoneE164) {
    return { email: String(payload.to || ''), phoneE164: String(payload.phoneE164 || '') }
  }

  if (targetType === 'CRM_CONTACT') {
    const contact = await prisma.crmContact.findUnique({ where: { id: targetId } })
    return { email: contact?.email || '', phoneE164: contact?.phoneE164 || '' }
  }

  if (targetType === 'USER') {
    const user = await prisma.user.findUnique({ where: { id: targetId } })
    return { email: user?.email || '', phoneE164: user?.phoneE164 || '' }
  }

  if (targetType === 'CLASS_EVENT') {
    const classEvent = await prisma.classEvent.findUnique({
      where: { id: targetId },
      include: { enrollments: { include: { student: { include: { user: true } } } } },
    })
    const firstStudent = classEvent?.enrollments[0]?.student.user
    return { email: firstStudent?.email || '', phoneE164: firstStudent?.phoneE164 || '' }
  }

  return { email: '', phoneE164: '' }
}

async function sendEmail(to: string, subject: string, message: string): Promise<DispatchResult> {
  const dryRun = process.env.NOTIFICATIONS_DRY_RUN !== 'false'
  const provider = process.env.EMAIL_PROVIDER || 'dry-run-email'

  if (!to) return { ok: false, provider, error: 'Missing email recipient', dryRun }
  if (dryRun) return { ok: true, provider, providerId: `dry-email-${Date.now()}`, dryRun }

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    if (!apiKey || !from) return { ok: false, provider, error: 'Missing RESEND_API_KEY or EMAIL_FROM', dryRun }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text: message }),
    })
    const body = await response.json().catch(() => ({}))
    return {
      ok: response.ok,
      provider,
      providerId: body.id || undefined,
      error: response.ok ? undefined : JSON.stringify(body),
      dryRun,
    }
  }

  return { ok: false, provider, error: `Unsupported EMAIL_PROVIDER ${provider}`, dryRun }
}

async function sendWhatsApp(phoneE164: string, message: string): Promise<DispatchResult> {
  const dryRun = process.env.NOTIFICATIONS_DRY_RUN !== 'false'
  const provider = process.env.WHATSAPP_PROVIDER || 'dry-run-whatsapp'

  if (!phoneE164) return { ok: false, provider, error: 'Missing WhatsApp recipient', dryRun }
  if (dryRun) return { ok: true, provider, providerId: `dry-whatsapp-${Date.now()}`, dryRun }

  const apiUrl = process.env.WHATSAPP_API_URL
  const token = process.env.WHATSAPP_TOKEN
  if (!apiUrl || !token) return { ok: false, provider, error: 'Missing WHATSAPP_API_URL or WHATSAPP_TOKEN', dryRun }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: phoneE164,
      type: 'text',
      text: { body: message },
    }),
  })
  const body = await response.json().catch(() => ({}))
  return {
    ok: response.ok,
    provider,
    providerId: body.messages?.[0]?.id || body.id || undefined,
    error: response.ok ? undefined : JSON.stringify(body),
    dryRun,
  }
}

async function dispatchOne(notificationId: string) {
  const notification = await prisma.notificationAttempt.findUnique({ where: { id: notificationId } })
  if (!notification) return { ok: false, error: 'Notification not found' }
  if (notification.status !== NotificationStatus.PENDING && notification.status !== NotificationStatus.RETRY) {
    return { ok: false, error: `Notification status is ${notification.status}` }
  }

  const payload = parsePayload(notification.payload)
  const message = String(payload.message || '').trim()
  const subject = String(payload.subject || 'TEATIME Academy').trim()
  const recipient = await resolveRecipient(notification.targetType, notification.targetId, payload)

  if (!message) {
    await prisma.notificationAttempt.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.FAILED,
        payload: mergePayload(notification.payload, {
          ok: false,
          provider: 'dispatcher',
          error: 'Missing message',
          dryRun: process.env.NOTIFICATIONS_DRY_RUN !== 'false',
        }),
      },
    })
    return { ok: false, error: 'Missing message' }
  }

  const channel = notification.channel.toUpperCase()
  const result =
    channel === 'EMAIL'
      ? await sendEmail(recipient.email, subject, message)
      : channel === 'WHATSAPP'
        ? await sendWhatsApp(recipient.phoneE164, message)
        : {
            ok: true,
            provider: `dry-run-${channel.toLowerCase()}`,
            providerId: `dry-${channel.toLowerCase()}-${Date.now()}`,
            dryRun: true,
          }

  await prisma.notificationAttempt.update({
    where: { id: notification.id },
    data: {
      status: result.ok ? NotificationStatus.SENT : NotificationStatus.FAILED,
      providerId: result.providerId || notification.providerId,
      payload: mergePayload(notification.payload, result),
    },
  })

  return result
}

export async function sendTransactionalEmail(input: {
  targetId: string
  to: string
  subject: string
  message: string
  createdBy: string
}) {
  const notification = await prisma.notificationAttempt.create({
    data: {
      targetType: 'USER',
      targetId: input.targetId,
      channel: 'EMAIL',
      status: NotificationStatus.PENDING,
      payload: JSON.stringify({
        to: input.to,
        subject: input.subject,
        message: input.message,
        createdBy: input.createdBy,
      }),
    },
  })
  return dispatchOne(notification.id)
}

export async function processNotificationQueue(limit = 20) {
  const notifications = await prisma.notificationAttempt.findMany({
    where: { status: { in: [NotificationStatus.PENDING, NotificationStatus.RETRY] } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  const results = []
  for (const notification of notifications) {
    results.push({ id: notification.id, result: await dispatchOne(notification.id) })
  }

  return {
    processed: results.length,
    sent: results.filter((item) => item.result.ok).length,
    failed: results.filter((item) => !item.result.ok).length,
    dryRun: process.env.NOTIFICATIONS_DRY_RUN !== 'false',
    results,
  }
}
