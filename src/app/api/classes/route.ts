import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const from = q.get('from')
  const to = q.get('to')

  const startFilters: Record<string, Date> = {}
  if (from) startFilters.gte = new Date(from)
  if (to) startFilters.lte = new Date(to)

  const events = await prisma.classEvent.findMany({
    where: Object.keys(startFilters).length
      ? { startAt: startFilters }
      : undefined,
    include: { enrollments: { include: { student: { include: { user: true } }, attendance: true } } },
    orderBy: { startAt: 'asc' },
  })

  return NextResponse.json({ ok: true, events })
}
