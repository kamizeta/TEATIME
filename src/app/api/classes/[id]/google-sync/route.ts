import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { syncClassEventToGoogleCalendar } from '@/lib/google-calendar'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  const body = await request.json().catch(() => ({}))
  const operation = body.operation === 'cancel' ? 'cancel' : 'upsert'
  const result = await syncClassEventToGoogleCalendar(params.id, operation)

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      action: operation === 'cancel' ? 'GOOGLE_CLASS_CANCEL_SYNC_REQUESTED' : 'GOOGLE_CLASS_SYNC_REQUESTED',
      entityType: 'CLASS_EVENT',
      entityId: params.id,
      after: JSON.stringify(result),
    },
  })

  return NextResponse.json(result)
}
