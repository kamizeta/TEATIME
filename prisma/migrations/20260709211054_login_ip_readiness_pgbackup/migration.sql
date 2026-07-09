-- AlterTable
ALTER TABLE "LoginAttempt" ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateIndex
CREATE INDEX "LoginAttempt_ipHash_createdAt_idx" ON "LoginAttempt"("ipHash", "createdAt");
