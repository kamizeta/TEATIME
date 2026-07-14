import { LearningReportStatus, MeetEvidenceStatus, TranscriptStatus } from '@prisma/client'

import { settleClassLedger } from '@/lib/class-closing'
import { decryptSecret } from '@/lib/secret-crypto'
import { getSettingsMap, settingKeys } from '@/lib/settings'
import { getClassTranscriptionConsent } from '@/lib/legal-consent'
import { prisma } from '@/lib/prisma'

type MeetConference = {
  name: string
  startTime?: string
  endTime?: string
  space?: { meetingCode?: string }
}

type MeetParticipant = {
  name?: string
  signedinUser?: { displayName?: string }
  anonymousUser?: { displayName?: string }
  phoneUser?: { displayName?: string }
}

type MeetTranscript = {
  name: string
  docsDestination?: { exportUri?: string }
}

type MeetTranscriptEntry = {
  participant?: string
  text?: string
  languageCode?: string
  startTime?: string
  endTime?: string
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function getMeetingCode(meetUrl: string | null) {
  const match = meetUrl?.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i)
  return match?.[1]?.toLowerCase() || ''
}

function minutesBetween(start?: string, end?: string) {
  if (!start || !end) return 0
  const elapsed = new Date(end).getTime() - new Date(start).getTime()
  return Number.isFinite(elapsed) && elapsed > 0 ? Math.round(elapsed / 60000) : 0
}

function participantDisplayName(participant: MeetParticipant) {
  return participant.signedinUser?.displayName || participant.anonymousUser?.displayName || participant.phoneUser?.displayName || ''
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error desconocido al consultar Google Meet.'
}

async function getGoogleMeetAccessToken() {
  const values = await getSettingsMap([settingKeys.googleCalendarRefreshToken])
  const storedRefreshToken = values[settingKeys.googleCalendarRefreshToken]
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (process.env.GOOGLE_DRY_RUN !== 'false') throw new Error('Google está en modo de prueba.')
  if (!storedRefreshToken || !clientId || !clientSecret) throw new Error('Falta conexión real de Google para consultar Meet.')

  let refreshToken = storedRefreshToken
  try {
    refreshToken = decryptSecret(storedRefreshToken)
  } catch {
    // Compatibilidad con conexiones creadas antes de cifrar el token en la base de datos.
  }

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
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || 'No se pudo renovar el acceso a Google Meet.')
  }
  return String(body.access_token)
}

async function meetJson<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error?.message || body.error_description || 'Google Meet rechazó la solicitud.')
  return body as T
}

function conferenceMatchesClassWindow(conference: MeetConference, classStartAt: Date, classEndAt: Date) {
  if (!conference.startTime) return false
  const conferenceStart = new Date(conference.startTime).getTime()
  if (!Number.isFinite(conferenceStart)) return false

  // A single Meet link can be reused. Never let an older or future conference
  // settle a different scheduled class that happens to share that same link.
  const earliestAllowedStart = classStartAt.getTime() - 2 * 60 * 60 * 1000
  const latestAllowedStart = classEndAt.getTime() + 12 * 60 * 60 * 1000
  return conferenceStart >= earliestAllowedStart && conferenceStart <= latestAllowedStart
}

async function findConference(accessToken: string, meetingCode: string, classStartAt: Date, classEndAt: Date) {
  const url = new URL('https://meet.googleapis.com/v2/conferenceRecords')
  url.searchParams.set('filter', `space.meeting_code = "${meetingCode}"`)
  url.searchParams.set('pageSize', '10')
  const body = await meetJson<{ conferenceRecords?: MeetConference[] }>(accessToken, url.toString())
  return (body.conferenceRecords || [])
    .filter((conference) => conferenceMatchesClassWindow(conference, classStartAt, classEndAt))
    .sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime())[0]
}

async function listParticipants(accessToken: string, conferenceName: string) {
  const body = await meetJson<{ participants?: MeetParticipant[] }>(accessToken, `https://meet.googleapis.com/v2/${conferenceName}/participants?pageSize=250`)
  return body.participants || []
}

async function configureAutomaticTranscription(accessToken: string, meetingCode: string) {
  const url = new URL(`https://meet.googleapis.com/v2/spaces/${meetingCode}`)
  url.searchParams.set('updateMask', 'config.artifactConfig.transcriptionConfig.autoTranscriptionGeneration')
  await meetJson(accessToken, url.toString(), {
    method: 'PATCH',
    body: JSON.stringify({
      config: {
        artifactConfig: {
          transcriptionConfig: { autoTranscriptionGeneration: 'ON' },
        },
      },
    }),
  })
}

async function syncTranscript(accessToken: string, classId: string, conferenceName: string, canTranscribe: boolean) {
  if (!canTranscribe) {
    await prisma.classTranscript.upsert({
      where: { classEventId: classId },
      update: { status: TranscriptStatus.CONSENT_MISSING, errorMessage: 'Falta autorización de transcripción de al menos un participante.' },
      create: { classEventId: classId, status: TranscriptStatus.CONSENT_MISSING, errorMessage: 'Falta autorización de transcripción de al menos un participante.' },
    })
    return null
  }

  const transcripts = await meetJson<{ transcripts?: MeetTranscript[] }>(accessToken, `https://meet.googleapis.com/v2/${conferenceName}/transcripts?pageSize=20`)
  const transcript = (transcripts.transcripts || [])[0]
  if (!transcript) {
    await prisma.classTranscript.upsert({
      where: { classEventId: classId },
      update: { status: TranscriptStatus.PENDING, lastSyncedAt: new Date(), errorMessage: null },
      create: { classEventId: classId, status: TranscriptStatus.PENDING, lastSyncedAt: new Date() },
    })
    return null
  }

  const entries = await meetJson<{ transcriptEntries?: MeetTranscriptEntry[] }>(accessToken, `https://meet.googleapis.com/v2/${transcript.name}/entries?pageSize=1000`)
  const lines = (entries.transcriptEntries || [])
    .filter((entry) => entry.text)
    .map((entry) => `[${entry.startTime || ''}] ${entry.participant || 'Participante'}: ${entry.text}`)
  const text = lines.join('\n').slice(0, 180000)
  const languageCode = (entries.transcriptEntries || []).find((entry) => entry.languageCode)?.languageCode || null

  const saved = await prisma.classTranscript.upsert({
    where: { classEventId: classId },
    update: {
      googleTranscriptName: transcript.name,
      googleDriveUrl: transcript.docsDestination?.exportUri || null,
      status: TranscriptStatus.READY,
      languageCode,
      transcriptText: text,
      retentionDeleteAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      lastSyncedAt: new Date(),
      errorMessage: null,
    },
    create: {
      classEventId: classId,
      googleTranscriptName: transcript.name,
      googleDriveUrl: transcript.docsDestination?.exportUri || null,
      status: TranscriptStatus.READY,
      languageCode,
      transcriptText: text,
      retentionDeleteAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      lastSyncedAt: new Date(),
    },
  })
  return saved
}

async function generateLearningReport(classId: string, transcriptText: string) {
  if (process.env.CLASS_REPORT_AI_ENABLED !== 'true') {
    await prisma.classLearningReport.upsert({
      where: { classEventId: classId },
      update: { status: LearningReportStatus.WAITING_AI, provider: null, model: null, errorMessage: 'La generación de informes con IA está desactivada por configuración.' },
      create: { classEventId: classId, status: LearningReportStatus.WAITING_AI, errorMessage: 'La generación de informes con IA está desactivada por configuración.' },
    })
    return
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    await prisma.classLearningReport.upsert({
      where: { classEventId: classId },
      update: { status: LearningReportStatus.WAITING_AI, provider: 'openai', errorMessage: 'Falta OPENAI_API_KEY para generar el informe.' },
      create: { classEventId: classId, status: LearningReportStatus.WAITING_AI, provider: 'openai', errorMessage: 'Falta OPENAI_API_KEY para generar el informe.' },
    })
    return
  }

  const model = process.env.OPENAI_CLASS_REPORT_MODEL || 'gpt-5-mini'
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: 'Eres un asistente pedagógico de una academia de idiomas. Resume solo el contenido de una clase. No evalúes personas, no decidas asistencia, pagos ni sanciones. Responde en JSON con studentSummary, topics, vocabulary, corrections, homework, nextClassPlan y teacherInternalNotes. Los campos de listas deben ser arreglos de textos cortos en español.',
        },
        {
          role: 'user',
          content: `Transcripción de clase:\n---\n${transcriptText.slice(0, 120000)}\n---`,
        },
      ],
      text: { format: { type: 'json_object' } },
    }),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error?.message || 'No se pudo generar el informe con IA.')
  const text = String(body.output_text || '').trim()
  const report = JSON.parse(text || '{}') as Record<string, unknown>

  await prisma.classLearningReport.upsert({
    where: { classEventId: classId },
    update: {
      status: LearningReportStatus.READY,
      studentSummary: String(report.studentSummary || ''),
      topicsJson: JSON.stringify(report.topics || []),
      vocabularyJson: JSON.stringify(report.vocabulary || []),
      correctionsJson: JSON.stringify(report.corrections || []),
      homework: String(report.homework || ''),
      nextClassPlan: String(report.nextClassPlan || ''),
      teacherInternalNotes: String(report.teacherInternalNotes || ''),
      provider: 'openai',
      model,
      errorMessage: null,
      generatedAt: new Date(),
    },
    create: {
      classEventId: classId,
      status: LearningReportStatus.READY,
      studentSummary: String(report.studentSummary || ''),
      topicsJson: JSON.stringify(report.topics || []),
      vocabularyJson: JSON.stringify(report.vocabulary || []),
      correctionsJson: JSON.stringify(report.corrections || []),
      homework: String(report.homework || ''),
      nextClassPlan: String(report.nextClassPlan || ''),
      teacherInternalNotes: String(report.teacherInternalNotes || ''),
      provider: 'openai',
      model,
      generatedAt: new Date(),
    },
  })
}

export async function syncMeetClassAutomation(classId: string) {
  const classEvent = await prisma.classEvent.findUnique({
    where: { id: classId },
    include: {
      teacher: { include: { user: true } },
      enrollments: { where: { status: 'CONFIRMED' }, include: { student: { include: { user: true } }, attendance: true } },
    },
  })
  if (!classEvent) throw new Error('CLASS_NOT_FOUND')
  if (classEvent.status === 'CANCELED') return { status: 'ignored', message: 'La clase está cancelada; no se consulta Meet.' }

  const meetingCode = getMeetingCode(classEvent.meetUrl)
  if (!meetingCode) {
    await prisma.classMeetEvidence.upsert({
      where: { classEventId: classId },
      update: { status: MeetEvidenceStatus.NEEDS_REVIEW, exceptionReason: 'La clase no tiene enlace válido de Google Meet.', lastSyncedAt: new Date() },
      create: { classEventId: classId, status: MeetEvidenceStatus.NEEDS_REVIEW, exceptionReason: 'La clase no tiene enlace válido de Google Meet.', meetingCode: null },
    })
    return { status: 'review', message: 'La clase no tiene un enlace válido de Meet.' }
  }

  try {
    const accessToken = await getGoogleMeetAccessToken()
    const consent = await getClassTranscriptionConsent(classId)
    if (classEvent.transcriptionRequested && consent.allowed) {
      try {
        await configureAutomaticTranscription(accessToken, meetingCode)
      } catch {
        // La reunión pudo haber empezado o el token aún no tener los nuevos scopes. La evidencia sigue siendo consultable.
      }
    }

    const conference = await findConference(accessToken, meetingCode, classEvent.startAt, classEvent.endAt)
    if (!conference) {
      await prisma.classMeetEvidence.upsert({
        where: { classEventId: classId },
        update: { status: MeetEvidenceStatus.PENDING, meetingCode, exceptionReason: null, lastSyncedAt: new Date() },
        create: { classEventId: classId, status: MeetEvidenceStatus.PENDING, meetingCode },
      })
      return { status: 'pending', message: 'Meet aún no tiene una conferencia dentro del horario de esta clase.' }
    }

    const participants = await listParticipants(accessToken, conference.name)
    const participantNames = participants.map(participantDisplayName).filter(Boolean)
    const observedMinutes = minutesBetween(conference.startTime, conference.endTime)
    const teacherPresent = participantNames.some((name) => normalizeName(name) === normalizeName(classEvent.teacher.user.name))
    const minimumMinutes = Math.max(30, Math.ceil(classEvent.durationMinutes * 0.6))
    const classHasEnded = classEvent.endAt.getTime() <= Date.now()
    const readyToClose = classEvent.status !== 'COMPLETED' && classHasEnded && Boolean(conference.endTime) && observedMinutes >= minimumMinutes && teacherPresent && participants.length >= 2

    const evidenceStatus = readyToClose ? MeetEvidenceStatus.AUTO_CLOSED : conference.endTime ? MeetEvidenceStatus.NEEDS_REVIEW : MeetEvidenceStatus.EVIDENCE_FOUND
    const exceptionReason = readyToClose
      ? null
      : !classHasEnded
        ? 'La clase aún no ha terminado; no se cobrará automáticamente.'
        : !conference.endTime
        ? 'La conferencia sigue activa o Google aún no publicó su cierre.'
        : !teacherPresent
          ? 'Google Meet no identificó de forma suficiente al profesor; no se cobrará automáticamente.'
          : observedMinutes < minimumMinutes
            ? `La duración observada (${observedMinutes} min) no alcanza el umbral automático (${minimumMinutes} min).`
            : 'No hay suficientes participantes identificados para cierre automático.'

    await prisma.classMeetEvidence.upsert({
      where: { classEventId: classId },
      update: {
        conferenceRecordName: conference.name,
        meetingCode,
        status: evidenceStatus,
        conferenceStartedAt: conference.startTime ? new Date(conference.startTime) : null,
        conferenceEndedAt: conference.endTime ? new Date(conference.endTime) : null,
        observedMinutes,
        participantCount: participants.length,
        teacherEvidence: teacherPresent,
        exceptionReason,
        rawPayload: JSON.stringify({ conference, participants: participantNames }),
        lastSyncedAt: new Date(),
      },
      create: {
        classEventId: classId,
        conferenceRecordName: conference.name,
        meetingCode,
        status: evidenceStatus,
        conferenceStartedAt: conference.startTime ? new Date(conference.startTime) : null,
        conferenceEndedAt: conference.endTime ? new Date(conference.endTime) : null,
        observedMinutes,
        participantCount: participants.length,
        teacherEvidence: teacherPresent,
        exceptionReason,
        rawPayload: JSON.stringify({ conference, participants: participantNames }),
        lastSyncedAt: new Date(),
      },
    })

    const transcript = await syncTranscript(accessToken, classId, conference.name, classEvent.transcriptionRequested && consent.allowed)
    if (transcript?.transcriptText) {
      try {
        await generateLearningReport(classId, transcript.transcriptText)
      } catch (error) {
        await prisma.classLearningReport.upsert({
          where: { classEventId: classId },
          update: { status: LearningReportStatus.FAILED, errorMessage: toErrorMessage(error), provider: 'openai' },
          create: { classEventId: classId, status: LearningReportStatus.FAILED, errorMessage: toErrorMessage(error), provider: 'openai' },
        })
      }
    }

    if (!readyToClose) return { status: evidenceStatus.toLowerCase(), message: exceptionReason || 'Evidencia de Meet actualizada.' }

    await prisma.instructorAttendance.upsert({
      where: { classEventId: classId },
      update: { instructorId: classEvent.teacher.userId, present: true, markedAt: new Date() },
      create: { classEventId: classId, instructorId: classEvent.teacher.userId, present: true },
    })

    for (const enrollment of classEvent.enrollments) {
      if (enrollment.attendance) continue
      const studentWasSeen = participantNames.some((name) => normalizeName(name) === normalizeName(enrollment.student.user.name))
      await prisma.attendanceRecord.create({
        data: {
          classEventId: classId,
          studentId: enrollment.studentId,
          status: studentWasSeen ? 'attended' : 'no_show',
          markedBy: classEvent.teacher.userId,
        },
      })
    }

    await settleClassLedger(classId)
    await prisma.classMeetEvidence.update({ where: { classEventId: classId }, data: { status: MeetEvidenceStatus.AUTO_CLOSED, autoClosedAt: new Date(), exceptionReason: null } })
    return { status: 'auto_closed', message: 'Clase cerrada automáticamente con evidencia suficiente de Google Meet.' }
  } catch (error) {
    const message = toErrorMessage(error)
    await prisma.classMeetEvidence.upsert({
      where: { classEventId: classId },
      update: { status: MeetEvidenceStatus.FAILED, exceptionReason: message, meetingCode, lastSyncedAt: new Date() },
      create: { classEventId: classId, status: MeetEvidenceStatus.FAILED, exceptionReason: message, meetingCode },
    })
    return { status: 'failed', message }
  }
}
