export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const Body = z.object({ usedHours: z.number().int().min(0) })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(['ADMIN'])
  const { id } = await params
  const { usedHours } = Body.parse(await req.json())
  const updated = await prisma.hourPackage.update({ where: { id }, data: { usedHours } })
  return NextResponse.json({ ok: true, updated })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pack = await prisma.hourPackage.findUnique({ where: { id } })
  if (!pack) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, package: pack })
}
