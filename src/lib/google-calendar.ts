import { prisma } from '@/lib/prisma'
import { getSettingsMap, settingKeys, upsertSettings } from '@/lib/settings'

type GoogleCalendarListItem = {
  id: string
  summary: string
  primary?: boolean
}

type GoogleTokenResponse = {
  access_token: string
  refresh_token?: string
}

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

function requireGoogleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el entorno.')
  }

  return { clientId, clientSecret }
}

export function isGoogleCalendarConfiguredInEnv() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_BASE_URL)
}

export function getGoogleCalendarRedirectUri() {
  const baseUrl = process.env.APP_BASE_URL
  if (!baseUrl) throw new Error('Falta APP_BASE_URL en el entorno.')
  return `${baseUrl.replace(/\/$/, '')}/api/integrations/google/callback`
}

export function buildGoogleCalendarConnectUrl() {
  const { clientId } = requireGoogleEnv()
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', getGoogleCalendarRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('scope', `openid email profile ${GOOGLE_CALENDAR_SCOPE}`)
  return url.toString()
}

async function exchangeGoogleCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireGoogleEnv()

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleCalendarRedirectUri(),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json.error_description || json.error || 'No se pudo intercambiar el código de Google.')
  }

  return json as GoogleTokenResponse
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = requireGoogleEnv()

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })

  const json = await response.json()
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || 'No se pudo refrescar el token de Google.')
  }

  return json.access_token as string
}

async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json.error?.message || 'No se pudo leer el perfil de Google.')
  }

  return json as { email?: string }
}

async function fetchGoogleCalendars(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json.error?.message || 'No se pudo leer la lista de calendarios de Google.')
  }

  return (json.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary || item.id,
    primary: Boolean(item.primary),
  })) as GoogleCalendarListItem[]
}

function parseCalendarsJson(raw?: string | null) {
  if (!raw) return [] as GoogleCalendarListItem[]
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as GoogleCalendarListItem[]) : []
  } catch {
    return []
  }
}

export async function getGoogleCalendarSettingsState() {
  const values = await getSettingsMap([
    settingKeys.googleCalendarAccountEmail,
    settingKeys.googleCalendarId,
    settingKeys.googleCalendarName,
    settingKeys.googleCalendarRefreshToken,
    settingKeys.googleCalendarCalendarsJson,
    settingKeys.googleCalendarFallbackTeacherEmail,
  ])

  return {
    envConfigured: isGoogleCalendarConfiguredInEnv(),
    accountEmail: values[settingKeys.googleCalendarAccountEmail] || '',
    calendarId: values[settingKeys.googleCalendarId] || '',
    calendarName: values[settingKeys.googleCalendarName] || '',
    fallbackTeacherEmail: values[settingKeys.googleCalendarFallbackTeacherEmail] || '',
    refreshTokenPresent: Boolean(values[settingKeys.googleCalendarRefreshToken]),
    calendars: parseCalendarsJson(values[settingKeys.googleCalendarCalendarsJson]),
  }
}

export async function completeGoogleCalendarConnection(code: string) {
  const current = await getGoogleCalendarSettingsState()
  const tokens = await exchangeGoogleCodeForTokens(code)
  const accessToken = tokens.access_token
  const profile = await fetchGoogleProfile(accessToken)
  const calendars = await fetchGoogleCalendars(accessToken)
  const selectedCalendar =
    calendars.find((calendar) => calendar.primary) ||
    calendars.find((calendar) => calendar.id === current.calendarId) ||
    calendars[0]

  if (!tokens.refresh_token && !current.refreshTokenPresent) {
    throw new Error('Google no devolvió refresh token. Vuelve a conectar con consentimiento completo.')
  }

  await upsertSettings({
    [settingKeys.googleCalendarAccountEmail]: profile.email || '',
    [settingKeys.googleCalendarRefreshToken]: tokens.refresh_token,
    [settingKeys.googleCalendarCalendarsJson]: JSON.stringify(calendars),
    [settingKeys.googleCalendarId]: current.calendarId || selectedCalendar?.id || '',
    [settingKeys.googleCalendarName]: current.calendarId ? current.calendarName : selectedCalendar?.summary || '',
  })
}

function getMeetLinkFromEvent(item: any) {
  const videoEntry = item.conferenceData?.entryPoints?.find((entry: any) => entry.entryPointType === 'video')
  return item.hangoutLink || videoEntry?.uri || ''
}

async function resolveTeacherByEvent(item: any, fallbackTeacherEmail?: string) {
  const teacherUsers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    include: { teacherProfile: true },
  })
  const teacherMap = new Map(
    teacherUsers
      .filter((user) => user.teacherProfile?.id)
      .map((user) => [user.email.toLowerCase(), user.teacherProfile!])
  )

  const candidates = [
    item.organizer?.email,
    item.creator?.email,
    ...(item.attendees || []).map((attendee: any) => attendee.email),
    fallbackTeacherEmail,
  ]
    .filter(Boolean)
    .map((value: string) => value.toLowerCase())

  const matched = candidates.find((candidate) => teacherMap.has(candidate))
  return matched ? teacherMap.get(matched) || null : null
}

export async function syncGoogleCalendarIntoClasses() {
  const settings = await getGoogleCalendarSettingsState()
  if (!settings.refreshTokenPresent) throw new Error('No hay refresh token guardado. Conecta Google primero.')
  if (!settings.calendarId) throw new Error('No hay calendar ID configurado.')

  const values = await getSettingsMap([settingKeys.googleCalendarRefreshToken])
  const accessToken = await refreshGoogleAccessToken(values[settingKeys.googleCalendarRefreshToken] || '')
  const calendars = await fetchGoogleCalendars(accessToken)
  const currentCalendar = calendars.find((calendar) => calendar.id === settings.calendarId)

  await upsertSettings({
    [settingKeys.googleCalendarCalendarsJson]: JSON.stringify(calendars),
    [settingKeys.googleCalendarName]: currentCalendar?.summary || settings.calendarName,
  })

  const now = new Date()
  const timeMin = new Date(now)
  timeMin.setDate(timeMin.getDate() - 14)
  const timeMax = new Date(now)
  timeMax.setDate(timeMax.getDate() + 90)

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      settings.calendarId
    )}/events?singleEvents=true&orderBy=startTime&maxResults=2500&timeMin=${encodeURIComponent(
      timeMin.toISOString()
    )}&timeMax=${encodeURIComponent(timeMax.toISOString())}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  )

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json.error?.message || 'No se pudieron descargar los eventos del calendario.')
  }

  let synced = 0
  let skipped = 0

  for (const item of json.items || []) {
    if (item.status === 'cancelled' || !item.start?.dateTime || !item.end?.dateTime) {
      skipped += 1
      continue
    }

    const teacher = await resolveTeacherByEvent(item, settings.fallbackTeacherEmail)
    if (!teacher) {
      skipped += 1
      continue
    }

    const startAt = new Date(item.start.dateTime)
    const endAt = new Date(item.end.dateTime)
    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || startAt >= endAt) {
      skipped += 1
      continue
    }

    await prisma.classEvent.upsert({
      where: { googleEventId: item.id },
      update: {
        title: item.summary || 'Clase TEATIME',
        startAt,
        endAt,
        timezone: item.start.timeZone || 'America/Bogota',
        meetUrl: getMeetLinkFromEvent(item),
        teacherId: teacher.id,
        bookingSource: 'GOOGLE_CALENDAR_SYNC',
      },
      create: {
        googleEventId: item.id,
        title: item.summary || 'Clase TEATIME',
        startAt,
        endAt,
        timezone: item.start.timeZone || 'America/Bogota',
        meetUrl: getMeetLinkFromEvent(item),
        teacherId: teacher.id,
        bookingSource: 'GOOGLE_CALENDAR_SYNC',
      },
    })

    await prisma.calendarSyncEvent.create({
      data: {
        source: 'google',
        eventId: item.id,
        status: 'synced',
        payload: JSON.stringify({
          id: item.id,
          summary: item.summary || '',
          start: item.start.dateTime,
          end: item.end.dateTime,
          calendarId: settings.calendarId,
        }),
      },
    })

    synced += 1
  }

  return { synced, skipped }
}
