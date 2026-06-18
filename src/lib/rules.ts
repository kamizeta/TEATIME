import { prisma } from '@/lib/prisma'
import { hoursBetween } from '@/lib/time'

export async function canCancel(startAt: Date, now = new Date()) {
  const setting = await prisma.setting.findUnique({ where: { key: 'CANCEL_GRACE_HOURS' } })
  const graceHours = Number(setting?.value ?? '6')
  const diff = hoursBetween(startAt, now)
  return {
    allowed: diff >= graceHours,
    graceHours,
    diffHours: Math.floor(diff * 100) / 100,
  }
}

export const DEFAULT_GRACE_HOURS = 6
