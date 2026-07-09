-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'CONTACTED', 'TRIAL_SCHEDULED', 'ACTIVE_STUDENT', 'LOST');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('WHATSAPP', 'WEBSITE', 'REFERRAL', 'MANUAL', 'OTHER');

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phoneE164" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'es',
    "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "ownerId" TEXT,
    "convertedStudentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmContact_status_createdAt_idx" ON "CrmContact"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CrmContact_ownerId_idx" ON "CrmContact"("ownerId");

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_convertedStudentId_fkey" FOREIGN KEY ("convertedStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
