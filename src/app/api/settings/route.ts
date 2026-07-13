export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { requireAdminOrStaffPermission } from '@/lib/staff-permissions'
import { getGoogleCalendarSettingsState } from '@/lib/google-calendar'
import { settingKeys, upsertSettings } from '@/lib/settings'

const Body = z.object({
  minimumNoticeHours: z.number().int().min(0).max(72),
  googleCalendarId: z.string().optional(),
  fallbackTeacherEmail: z.string().email().or(z.literal('')).optional(),
})

export async function GET() {
  await requireAdminOrStaffPermission('canManageRules')
  const bookingRule = await prisma.bookingRule.findFirst({ orderBy: { createdAt: 'asc' } })
  const google = await getGoogleCalendarSettingsState()
  return NextResponse.json({ ok: true, minimumNoticeHours: bookingRule?.minimumNoticeHours || 6, google })
}

export async function PATCH(req: Request) {
  try {
    await requireRole(['ADMIN'])
    const { minimumNoticeHours, googleCalendarId, fallbackTeacherEmail } = Body.parse(await req.json())
    const bookingRule = await prisma.bookingRule.findFirst({ orderBy: { createdAt: 'asc' } })
    const savedRule = bookingRule
      ? await prisma.bookingRule.update({ where: { id: bookingRule.id }, data: { minimumNoticeHours } })
      : await prisma.bookingRule.create({ data: { minimumNoticeHours } })

    await upsertSettings({
      [settingKeys.googleCalendarId]: googleCalendarId || '',
      [settingKeys.googleCalendarFallbackTeacherEmail]: fallbackTeacherEmail || '',
    })

    return NextResponse.json({ ok: true, bookingRule: savedRule })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
