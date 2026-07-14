CREATE TABLE "LearningProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guideKey" TEXT NOT NULL,
    "lessonKey" TEXT NOT NULL,
    "contentVersion" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningProgress_userId_guideKey_lessonKey_key" ON "LearningProgress"("userId", "guideKey", "lessonKey");
CREATE INDEX "LearningProgress_userId_guideKey_completedAt_idx" ON "LearningProgress"("userId", "guideKey", "completedAt");

ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
