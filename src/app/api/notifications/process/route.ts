import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { processNotificationQueue } from '@/lib/notifications/dispatcher'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const body = await request.json().catch(() => ({}))
  const limit = Number(body.limit || 20)
  const result = await processNotificationQueue(Number.isFinite(limit) ? limit : 20)

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: 'NOTIFICATION_QUEUE_PROCESSED_API',
      entityType: 'NOTIFICATION_ATTEMPT',
      entityId: 'QUEUE',
      after: JSON.stringify(result),
    },
  })

  return NextResponse.json({ ok: true, ...result })
}
