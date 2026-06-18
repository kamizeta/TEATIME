import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

const Body = z.object({ cancelGraceHours: z.number().int().min(0).max(72) })

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { key: 'CANCEL_GRACE_HOURS' } })
  return NextResponse.json({ ok: true, cancelGraceHours: Number(setting?.value || 6) })
}

export async function PATCH(req: Request) {
  try {
    await requireRole(['ADMIN'])
    const { cancelGraceHours } = Body.parse(await req.json())
    const saved = await prisma.setting.upsert({
      where: { key: 'CANCEL_GRACE_HOURS' },
      update: { value: String(cancelGraceHours) },
      create: { key: 'CANCEL_GRACE_HOURS', value: String(cancelGraceHours) },
    })
    return NextResponse.json({ ok: true, setting: saved })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
