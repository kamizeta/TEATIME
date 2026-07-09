import { prisma } from '@/lib/prisma'

export const settingKeys = {
  googleCalendarAccountEmail: 'GOOGLE_CALENDAR_ACCOUNT_EMAIL',
  googleCalendarId: 'GOOGLE_CALENDAR_ID',
  googleCalendarName: 'GOOGLE_CALENDAR_NAME',
  googleCalendarRefreshToken: 'GOOGLE_CALENDAR_REFRESH_TOKEN',
  googleCalendarCalendarsJson: 'GOOGLE_CALENDAR_CALENDARS_JSON',
  googleCalendarFallbackTeacherEmail: 'GOOGLE_CALENDAR_FALLBACK_TEACHER_EMAIL',
} as const

export async function getSettingsMap(keys: string[]) {
  const items = await prisma.setting.findMany({ where: { key: { in: keys } } })
  return Object.fromEntries(items.map((item) => [item.key, item.value]))
}

export async function upsertSettings(values: Record<string, string | null | undefined>) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined)

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: value ?? '' },
        create: { key, value: value ?? '' },
      })
    )
  )
}
