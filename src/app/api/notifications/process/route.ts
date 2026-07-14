import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminOrStaffPermission } from '@/lib/staff-permissions'
import { processNotificationQueue } from '@/lib/notifications/dispatcher'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await requireAdminOrStaffPermission('canManageRules')
  const body = await request.json().catch(() => ({}))
  const parsed = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'El límite debe estar entre 1 y 100.' }, { status: 400 })
  const result = await processNotificationQueue(parsed.data.limit)

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
