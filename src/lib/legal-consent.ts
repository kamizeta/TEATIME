import { createHash } from 'crypto'
import { LegalDocumentType } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export const legalVersions = {
  terms: '2026-07-13',
  privacy: '2026-07-13',
  transcription: '2026-07-13',
} as const

function fingerprint(value: string) {
  return value ? createHash('sha256').update(value).digest('hex') : null
}

export async function recordPortalAccessConsents(input: {
  userId: string
  transcriptionAccepted: boolean
  ip: string
  userAgent: string
}) {
  const metadata = {
    source: 'PORTAL_ACCESS_ACTIVATION',
    ipHash: fingerprint(input.ip.split(',')[0]?.trim() || ''),
    userAgentHash: fingerprint(input.userAgent),
  }

  await prisma.$transaction([
    prisma.legalConsent.upsert({
      where: {
        userId_document_version: {
          userId: input.userId,
          document: LegalDocumentType.TERMS_OF_SERVICE,
          version: legalVersions.terms,
        },
      },
      update: { granted: true, ...metadata, acceptedAt: new Date() },
      create: {
        userId: input.userId,
        document: LegalDocumentType.TERMS_OF_SERVICE,
        version: legalVersions.terms,
        granted: true,
        ...metadata,
      },
    }),
    prisma.legalConsent.upsert({
      where: {
        userId_document_version: {
          userId: input.userId,
          document: LegalDocumentType.PRIVACY_POLICY,
          version: legalVersions.privacy,
        },
      },
      update: { granted: true, ...metadata, acceptedAt: new Date() },
      create: {
        userId: input.userId,
        document: LegalDocumentType.PRIVACY_POLICY,
        version: legalVersions.privacy,
        granted: true,
        ...metadata,
      },
    }),
    prisma.legalConsent.upsert({
      where: {
        userId_document_version: {
          userId: input.userId,
          document: LegalDocumentType.TRANSCRIPTION_CONSENT,
          version: legalVersions.transcription,
        },
      },
      update: { granted: input.transcriptionAccepted, ...metadata, acceptedAt: new Date() },
      create: {
        userId: input.userId,
        document: LegalDocumentType.TRANSCRIPTION_CONSENT,
        version: legalVersions.transcription,
        granted: input.transcriptionAccepted,
        ...metadata,
      },
    }),
  ])
}

export async function getClassTranscriptionConsent(classId: string) {
  const classEvent = await prisma.classEvent.findUnique({
    where: { id: classId },
    include: {
      teacher: { select: { userId: true } },
      enrollments: { where: { status: 'CONFIRMED' }, select: { student: { select: { userId: true } } } },
    },
  })

  if (!classEvent) throw new Error('CLASS_NOT_FOUND')

  const userIds = [classEvent.teacher.userId, ...classEvent.enrollments.map((item) => item.student.userId)]
  const consents = await prisma.legalConsent.findMany({
    where: {
      userId: { in: userIds },
      document: LegalDocumentType.TRANSCRIPTION_CONSENT,
      version: legalVersions.transcription,
      granted: true,
    },
    select: { userId: true },
  })
  const approvedIds = new Set(consents.map((item) => item.userId))
  const missingUserIds = userIds.filter((userId) => !approvedIds.has(userId))

  return {
    allowed: missingUserIds.length === 0,
    missingUserIds,
  }
}
