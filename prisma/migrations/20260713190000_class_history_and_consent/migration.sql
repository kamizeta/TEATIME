CREATE TYPE "LegalDocumentType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'TRANSCRIPTION_CONSENT');
CREATE TYPE "MeetEvidenceStatus" AS ENUM ('PENDING', 'EVIDENCE_FOUND', 'AUTO_CLOSED', 'NEEDS_REVIEW', 'FAILED');
CREATE TYPE "TranscriptStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'READY', 'CONSENT_MISSING', 'FAILED');
CREATE TYPE "LearningReportStatus" AS ENUM ('PENDING', 'READY', 'WAITING_AI', 'FAILED');

ALTER TABLE "ClassEvent" ADD COLUMN "transcriptionRequested" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "LegalConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "document" "LegalDocumentType" NOT NULL,
  "version" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'PORTAL',
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegalConsent_userId_document_version_key" ON "LegalConsent"("userId", "document", "version");
CREATE INDEX "LegalConsent_userId_document_granted_idx" ON "LegalConsent"("userId", "document", "granted");
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ClassMeetEvidence" (
  "id" TEXT NOT NULL,
  "classEventId" TEXT NOT NULL,
  "conferenceRecordName" TEXT,
  "meetingCode" TEXT,
  "status" "MeetEvidenceStatus" NOT NULL DEFAULT 'PENDING',
  "conferenceStartedAt" TIMESTAMP(3),
  "conferenceEndedAt" TIMESTAMP(3),
  "observedMinutes" INTEGER NOT NULL DEFAULT 0,
  "participantCount" INTEGER NOT NULL DEFAULT 0,
  "teacherEvidence" BOOLEAN NOT NULL DEFAULT false,
  "autoClosedAt" TIMESTAMP(3),
  "exceptionReason" TEXT,
  "rawPayload" TEXT,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassMeetEvidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassMeetEvidence_classEventId_key" ON "ClassMeetEvidence"("classEventId");
CREATE UNIQUE INDEX "ClassMeetEvidence_conferenceRecordName_key" ON "ClassMeetEvidence"("conferenceRecordName");
ALTER TABLE "ClassMeetEvidence" ADD CONSTRAINT "ClassMeetEvidence_classEventId_fkey" FOREIGN KEY ("classEventId") REFERENCES "ClassEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ClassTranscript" (
  "id" TEXT NOT NULL,
  "classEventId" TEXT NOT NULL,
  "googleTranscriptName" TEXT,
  "googleDriveUrl" TEXT,
  "status" "TranscriptStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "languageCode" TEXT,
  "transcriptText" TEXT,
  "retentionDeleteAt" TIMESTAMP(3),
  "shareWithStudent" BOOLEAN NOT NULL DEFAULT true,
  "shareWithTeacher" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassTranscript_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassTranscript_classEventId_key" ON "ClassTranscript"("classEventId");
CREATE UNIQUE INDEX "ClassTranscript_googleTranscriptName_key" ON "ClassTranscript"("googleTranscriptName");
ALTER TABLE "ClassTranscript" ADD CONSTRAINT "ClassTranscript_classEventId_fkey" FOREIGN KEY ("classEventId") REFERENCES "ClassEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ClassLearningReport" (
  "id" TEXT NOT NULL,
  "classEventId" TEXT NOT NULL,
  "status" "LearningReportStatus" NOT NULL DEFAULT 'PENDING',
  "studentSummary" TEXT,
  "topicsJson" TEXT,
  "vocabularyJson" TEXT,
  "correctionsJson" TEXT,
  "homework" TEXT,
  "nextClassPlan" TEXT,
  "teacherInternalNotes" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "errorMessage" TEXT,
  "generatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassLearningReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassLearningReport_classEventId_key" ON "ClassLearningReport"("classEventId");
ALTER TABLE "ClassLearningReport" ADD CONSTRAINT "ClassLearningReport_classEventId_fkey" FOREIGN KEY ("classEventId") REFERENCES "ClassEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
