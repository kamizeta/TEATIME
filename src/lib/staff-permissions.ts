import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type StaffPermissionKey =
  | 'canManageUsers'
  | 'canManageRules'
  | 'canCloseWeeks'
  | 'canResolveIncidents'

export async function requireAdminOrStaffPermission(permission: StaffPermissionKey) {
  const session = await requireRole(['ADMIN', 'STAFF'])
  if (session.role === 'ADMIN') return session

  const permissions = await prisma.staffPermission.findUnique({ where: { userId: session.userId } })
  if (!permissions?.[permission]) throw new Error('FORBIDDEN_STAFF_PERMISSION')
  return session
}
