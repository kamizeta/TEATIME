-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('MISSING_ATTENDANCE', 'LATE_CANCELLATION', 'PACKAGE_MISMATCH', 'CALENDAR_CONFLICT', 'TEACHER_ABSENT', 'STUDENT_CLAIM', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "WeeklyClosingStatus" AS ENUM ('DRAFT', 'REVIEWED');

-- CreateEnum
CREATE TYPE "MessageTemplateChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'IN_APP');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "IncidentType" NOT NULL DEFAULT 'OTHER',
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "classEventId" TEXT,
    "reportedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyClosing" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "WeeklyClosingStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "MessageTemplateChannel" NOT NULL DEFAULT 'WHATSAPP',
    "language" TEXT NOT NULL DEFAULT 'es',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
    "canManageRules" BOOLEAN NOT NULL DEFAULT false,
    "canCloseWeeks" BOOLEAN NOT NULL DEFAULT true,
    "canResolveIncidents" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incident_status_severity_createdAt_idx" ON "Incident"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_assignedToId_status_idx" ON "Incident"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Incident_classEventId_idx" ON "Incident"("classEventId");

-- CreateIndex
CREATE INDEX "WeeklyClosing_status_weekStart_idx" ON "WeeklyClosing"("status", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyClosing_weekStart_key" ON "WeeklyClosing"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_key_key" ON "MessageTemplate"("key");

-- CreateIndex
CREATE INDEX "MessageTemplate_channel_language_isActive_idx" ON "MessageTemplate"("channel", "language", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPermission_userId_key" ON "StaffPermission"("userId");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_classEventId_fkey" FOREIGN KEY ("classEventId") REFERENCES "ClassEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyClosing" ADD CONSTRAINT "WeeklyClosing_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPermission" ADD CONSTRAINT "StaffPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
