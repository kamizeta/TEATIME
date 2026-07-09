-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('NOTE', 'WHATSAPP', 'CALL', 'EMAIL', 'FOLLOW_UP', 'TRIAL_CLASS');

-- CreateEnum
CREATE TYPE "CrmActivityStatus" AS ENUM ('OPEN', 'DONE', 'CANCELED');

-- AlterTable
ALTER TABLE "CrmContact" ADD COLUMN     "interestProgram" TEXT,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "CrmActivityType" NOT NULL DEFAULT 'NOTE',
    "status" "CrmActivityStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmActivity_contactId_createdAt_idx" ON "CrmActivity"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmActivity_status_dueAt_idx" ON "CrmActivity"("status", "dueAt");

-- CreateIndex
CREATE INDEX "CrmContact_nextFollowUpAt_idx" ON "CrmContact"("nextFollowUpAt");

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
