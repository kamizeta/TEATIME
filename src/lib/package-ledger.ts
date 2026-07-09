import { AttendanceStatus, Prisma } from '@prisma/client'

function toLegacyHourUnits(minutes: number) {
  return Math.ceil(minutes / 60)
}

export function shouldConsumeAttendance(status: AttendanceStatus) {
  return status === 'attended' || status === 'late'
}

export function buildLedgerReleaseUpdate(reservedMinutes: number): Prisma.HourPackageUpdateInput {
  return {
    reservedMinutes: { decrement: reservedMinutes },
    reservedHours: { decrement: toLegacyHourUnits(reservedMinutes) },
  }
}

export function buildLedgerConsumeUpdate(minutes: number): Prisma.HourPackageUpdateInput {
  return {
    reservedMinutes: { decrement: minutes },
    usedMinutes: { increment: minutes },
    reservedHours: { decrement: toLegacyHourUnits(minutes) },
    usedHours: { increment: toLegacyHourUnits(minutes) },
  }
}
