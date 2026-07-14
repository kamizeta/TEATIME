import { NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { syncMeetClassAutomation } from '@/lib/meet-automation'
import { prisma } from '@/lib/prisma'

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

export async function POST(request: Request) {
  const cronAuthorized = isAuthorizedCron(request)
  if (!cronAuthorized) {
    try {
      await requireRole(['ADMIN'])
    } catch {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
    }
  }

  const body = await request.json().catch(() => ({})) as { classId?: string }
  if (body.classId) {
    const result = await syncMeetClassAutomation(String(body.classId))
    return NextResponse.json(result)
  }

  const rows = await prisma.classEvent.findMany({
    where: {
      status: { in: ['SCHEDULED', 'RESERVED'] },
      endAt: { lt: new Date() },
      meetUrl: { not: null },
    },
    select: { id: true },
    orderBy: { endAt: 'asc' },
    take: 50,
  })
  const results = []
  for (const row of rows) results.push({ classId: row.id, ...(await syncMeetClassAutomation(row.id)) })
  return NextResponse.json(
    { processed: results.length, results },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
