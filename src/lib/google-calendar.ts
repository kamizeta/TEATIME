import { prisma } from '@/lib/prisma'
import { getSettingsMap, settingKeys, upsertSettings } from '@/lib/settings'
import { decryptSecret, encryptSecret } from '@/lib/secret-crypto'
import { randomBytes, timingSafeEqual } from 'crypto'

type GoogleCalendarListItem = {
  id: string
  summary: string
  primary?: boolean
}

type GoogleTokenResponse = {
  access_token: string
  refresh_token?: string
}

const GOOGLE_CALENDAR_SCOPE = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/meetings.space.settings',
].join(' ')
const DRY_GOOGLE_EVENT_PREFIX = 'dry-google-event-'

type GoogleClassSyncOperation = 'upsert' | 'cancel'

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

export const GOOGLE_OAUTH_STATE_COOKIE = 'teatime_google_oauth_state'

export function createGoogleOAuthState() {
  return randomBytes(32).toString('base64url')
}

export function isGoogleOAuthStateValid(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function buildGoogleCalendarConnectUrl(state: string) {
  const { clientId } = requireGoogleEnv()
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', getGoogleCalendarRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('scope', `openid email profile ${GOOGLE_CALENDAR_SCOPE}`)
  url.searchParams.set('state', state)
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

function isGoogleDryRun() {
  return process.env.GOOGLE_DRY_RUN !== 'false'
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

  const existing = await getSettingsMap([settingKeys.googleCalendarRefreshToken])
  await upsertSettings({
    [settingKeys.googleCalendarAccountEmail]: profile.email || '',
    [settingKeys.googleCalendarRefreshToken]: tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : existing[settingKeys.googleCalendarRefreshToken] || '',
    [settingKeys.googleCalendarCalendarsJson]: JSON.stringify(calendars),
    [settingKeys.googleCalendarId]: current.calendarId || selectedCalendar?.id || '',
    [settingKeys.googleCalendarName]: current.calendarId ? current.calendarName : selectedCalendar?.summary || '',
  })
}

function getMeetLinkFromEvent(item: any) {
  const videoEntry = item.conferenceData?.entryPoints?.find((entry: any) => entry.entryPointType === 'video')
  return item.hangoutLink || videoEntry?.uri || ''
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean)
    )
  )
}

function buildConferenceRequestId(classId: string) {
  return `teatime-${classId}-${Date.now()}`
}

function buildGoogleEventBody(classEvent: any) {
  const studentEmails = classEvent.enrollments.map((enrollment: any) => enrollment.student.user.email)
  const attendees = uniqueEmails([classEvent.teacher.user.email, ...studentEmails]).map((email) => ({ email }))

  return {
    summary: classEvent.title || 'Clase TEATIME',
    description: [
      'Clase creada desde TEATIME Ops.',
      `Tipo: ${classEvent.classType}`,
      `Duración: ${classEvent.durationMinutes} minutos`,
      `Clase ID: ${classEvent.id}`,
    ].join('\n'),
    start: {
      dateTime: classEvent.startAt.toISOString(),
      timeZone: classEvent.timezone || classEvent.teacher.timezone || 'America/Bogota',
    },
    end: {
      dateTime: classEvent.endAt.toISOString(),
      timeZone: classEvent.timezone || classEvent.teacher.timezone || 'America/Bogota',
    },
    attendees,
    conferenceData: {
      createRequest: {
        requestId: buildConferenceRequestId(classEvent.id),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  }
}

async function getGoogleCalendarAccessContext() {
  const settings = await getGoogleCalendarSettingsState()
  const values = await getSettingsMap([settingKeys.googleCalendarRefreshToken])
  const refreshToken = values[settingKeys.googleCalendarRefreshToken] || ''

  if (!settings.calendarId) throw new Error('No hay calendar ID configurado.')
  if (!refreshToken) throw new Error('No hay refresh token guardado. Conecta Google primero.')

  return {
    settings,
    accessToken: await refreshGoogleAccessToken(decryptSecret(refreshToken)),
  }
}

async function recordClassCalendarSync(classId: string, status: string, payload: Record<string, unknown>) {
  await prisma.calendarSyncEvent.create({
    data: {
      source: 'google',
      eventId: classId,
      status,
      payload: JSON.stringify(payload),
    },
  })
}

export async function syncClassEventToGoogleCalendar(classId: string, operation: GoogleClassSyncOperation = 'upsert') {
  const classEvent = await prisma.classEvent.findUnique({
    where: { id: classId },
    include: {
      teacher: { include: { user: true } },
      enrollments: {
        where: { status: 'CONFIRMED' },
        include: { student: { include: { user: true } } },
      },
    },
  })

  if (!classEvent) {
    return { ok: false, skipped: true, reason: 'CLASS_NOT_FOUND' }
  }

  if (isGoogleDryRun()) {
    const dryEventId = classEvent.googleEventId || `${DRY_GOOGLE_EVENT_PREFIX}${classEvent.id}`
    const dryMeetUrl = classEvent.meetUrl || `https://meet.google.com/dry-${classEvent.id.slice(-10)}`

    if (operation === 'cancel') {
      await prisma.classEvent.update({
        where: { id: classId },
        data: { googleEventId: dryEventId, meetUrl: dryMeetUrl },
      })
    } else {
      await prisma.classEvent.update({
        where: { id: classId },
        data: { googleEventId: dryEventId, meetUrl: dryMeetUrl },
      })
    }

    await recordClassCalendarSync(classId, `dry_run_${operation}`, {
      operation,
      calendar: 'dry-run',
      googleEventId: dryEventId,
      meetUrl: dryMeetUrl,
      attendees: uniqueEmails([
        classEvent.teacher.user.email,
        ...classEvent.enrollments.map((enrollment) => enrollment.student.user.email),
      ]),
    })

    return { ok: true, dryRun: true, googleEventId: dryEventId, meetUrl: dryMeetUrl }
  }

  try {
    const { settings, accessToken } = await getGoogleCalendarAccessContext()
    const calendarId = settings.calendarId
    const currentGoogleEventId =
      classEvent.googleEventId && !classEvent.googleEventId.startsWith(DRY_GOOGLE_EVENT_PREFIX)
        ? classEvent.googleEventId
        : ''

    if (operation === 'cancel') {
      if (!currentGoogleEventId) {
        await recordClassCalendarSync(classId, 'cancel_skipped_no_google_event', { operation, calendarId })
        return { ok: true, skipped: true, reason: 'NO_GOOGLE_EVENT' }
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(
          currentGoogleEventId
        )}?sendUpdates=all`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        }
      )

      if (!response.ok && response.status !== 410 && response.status !== 404) {
        const json = await response.json().catch(() => ({}))
        throw new Error(json.error?.message || 'No se pudo cancelar el evento en Google Calendar.')
      }

      await recordClassCalendarSync(classId, 'cancelled', { operation, calendarId, googleEventId: currentGoogleEventId })
      return { ok: true, googleEventId: currentGoogleEventId, cancelled: true }
    }

    const body = buildGoogleEventBody(classEvent)
    const url = currentGoogleEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(
          currentGoogleEventId
        )}?conferenceDataVersion=1&sendUpdates=all`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId
        )}/events?conferenceDataVersion=1&sendUpdates=all`

    const response = await fetch(url, {
      method: currentGoogleEventId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const json = await response.json()
    if (!response.ok) {
      throw new Error(json.error?.message || 'No se pudo crear/actualizar el evento en Google Calendar.')
    }

    const meetUrl = getMeetLinkFromEvent(json)
    await prisma.classEvent.update({
      where: { id: classId },
      data: {
        googleEventId: json.id || currentGoogleEventId,
        meetUrl: meetUrl || classEvent.meetUrl,
      },
    })

    await recordClassCalendarSync(classId, currentGoogleEventId ? 'updated' : 'created', {
      operation,
      calendarId,
      googleEventId: json.id || currentGoogleEventId,
      meetUrl,
      attendees: body.attendees,
    })

    return { ok: true, googleEventId: json.id || currentGoogleEventId, meetUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido sincronizando Google Calendar.'
    await recordClassCalendarSync(classId, 'failed', { operation, error: message })
    return { ok: false, error: message }
  }
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
  const accessToken = await refreshGoogleAccessToken(decryptSecret(values[settingKeys.googleCalendarRefreshToken] || ''))
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
