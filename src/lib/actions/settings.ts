'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { getGoogleCalendarSettingsState, syncGoogleCalendarIntoClasses } from '@/lib/google-calendar'
import { settingKeys, upsertSettings } from '@/lib/settings'

export async function saveAdminSettingsAction(formData: FormData) {
  await requireRole(['ADMIN'])

  const minimumNoticeHours = Number(formData.get('minimumNoticeHours') || 6)
  const fallbackTeacherEmail = String(formData.get('fallbackTeacherEmail') || '').trim().toLowerCase()
  const calendarId = String(formData.get('calendarId') || '').trim()

  const bookingRule = await prisma.bookingRule.findFirst({ orderBy: { createdAt: 'asc' } })
  if (bookingRule) {
    await prisma.bookingRule.update({
      where: { id: bookingRule.id },
      data: { minimumNoticeHours: Number.isFinite(minimumNoticeHours) ? minimumNoticeHours : 6 },
    })
  } else {
    await prisma.bookingRule.create({
      data: { minimumNoticeHours: Number.isFinite(minimumNoticeHours) ? minimumNoticeHours : 6 },
    })
  }

  const googleState = await getGoogleCalendarSettingsState()
  const selectedCalendar = googleState.calendars.find((calendar) => calendar.id === calendarId)

  await upsertSettings({
    [settingKeys.googleCalendarId]: calendarId,
    [settingKeys.googleCalendarName]: selectedCalendar?.summary || googleState.calendarName || '',
    [settingKeys.googleCalendarFallbackTeacherEmail]: fallbackTeacherEmail,
  })

  revalidatePath('/admin/settings')
  revalidatePath('/admin/calendar')
  redirect('/admin/settings?saved=1')
}

export async function syncGoogleCalendarAction() {
  await requireRole(['ADMIN'])
  const result = await syncGoogleCalendarIntoClasses()
  revalidatePath('/admin/settings')
  revalidatePath('/admin/calendar')
  redirect(`/admin/settings?sync=${result.synced}&skipped=${result.skipped}`)
}
