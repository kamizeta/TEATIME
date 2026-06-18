export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const event = await prisma.classEvent.findUnique({
    where: { id: params.id },
    include: { enrollments: { include: { student: { include: { user: true } }, package: true, attendance: true } } },
  })

  if (!event) return NextResponse.json({ ok: false, error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true, event })
}
