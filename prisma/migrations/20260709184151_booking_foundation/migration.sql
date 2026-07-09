-- CreateEnum
CREATE TYPE "ClassType" AS ENUM ('ONE_ON_ONE', 'GROUP');

-- CreateEnum
CREATE TYPE "AvailabilityExceptionType" AS ENUM ('UNAVAILABLE', 'AVAILABLE');

-- AlterEnum
ALTER TYPE "ClassStatus" ADD VALUE 'RESERVED';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "ClassEnrollment" ADD COLUMN     "consumedHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "consumedMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reservedHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reservedMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ClassEvent" ADD COLUMN     "bookedById" TEXT,
ADD COLUMN     "bookingSource" TEXT,
ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "classType" "ClassType" NOT NULL DEFAULT 'ONE_ON_ONE',
ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "HourPackage" ADD COLUMN     "allowedClassTypes" TEXT NOT NULL DEFAULT 'ONE_ON_ONE,GROUP',
ADD COLUMN     "allowedDurations" TEXT NOT NULL DEFAULT '50,60,90',
ADD COLUMN     "reservedHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reservedMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalMinutes" INTEGER NOT NULL DEFAULT 1200,
ADD COLUMN     "usedMinutes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StudentTeacherAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentTeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAvailabilityBlock" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startLocalTime" TEXT NOT NULL,
    "endLocalTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Bogota',
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "classType" "ClassType" NOT NULL DEFAULT 'ONE_ON_ONE',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAvailabilityException" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "type" "AvailabilityExceptionType" NOT NULL DEFAULT 'UNAVAILABLE',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherAvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRule" (
    "id" TEXT NOT NULL,
    "minimumNoticeHours" INTEGER NOT NULL DEFAULT 6,
    "maximumNoticeDays" INTEGER NOT NULL DEFAULT 30,
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "allowStudentReschedule" BOOLEAN NOT NULL DEFAULT true,
    "allowTeacherReschedule" BOOLEAN NOT NULL DEFAULT true,
    "allowStaffOverride" BOOLEAN NOT NULL DEFAULT true,
    "firstBookingStaffAssisted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentTeacherAssignment_teacherId_startsAt_idx" ON "StudentTeacherAssignment"("teacherId", "startsAt");

-- CreateIndex
CREATE INDEX "StudentTeacherAssignment_studentId_isPrimary_idx" ON "StudentTeacherAssignment"("studentId", "isPrimary");

-- CreateIndex
CREATE INDEX "TeacherAvailabilityBlock_teacherId_weekday_isActive_idx" ON "TeacherAvailabilityBlock"("teacherId", "weekday", "isActive");

-- CreateIndex
CREATE INDEX "TeacherAvailabilityException_teacherId_startsAt_endsAt_idx" ON "TeacherAvailabilityException"("teacherId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ClassEvent_teacherId_startAt_endAt_idx" ON "ClassEvent"("teacherId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "ClassEvent_status_startAt_idx" ON "ClassEvent"("status", "startAt");

-- AddForeignKey
ALTER TABLE "StudentTeacherAssignment" ADD CONSTRAINT "StudentTeacherAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTeacherAssignment" ADD CONSTRAINT "StudentTeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTeacherAssignment" ADD CONSTRAINT "StudentTeacherAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEvent" ADD CONSTRAINT "ClassEvent_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailabilityBlock" ADD CONSTRAINT "TeacherAvailabilityBlock_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailabilityException" ADD CONSTRAINT "TeacherAvailabilityException_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
