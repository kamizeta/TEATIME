import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function redactUsers(users) {
  return users.map((user) => ({
    ...user,
    password: '[REDACTED]',
  }))
}

async function main() {
  const outputDir = process.env.BACKUP_DIR || 'backups'
  await mkdir(outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = path.join(outputDir, `teatime-backup-${timestamp}.json`)

  const [
    users,
    teachers,
    students,
    studentTeacherAssignments,
    hourPackages,
    classEvents,
    classEnrollments,
    attendanceRecords,
    instructorAttendances,
    cancellations,
    crmContacts,
    crmActivities,
    incidents,
    weeklyClosings,
    messageTemplates,
    notificationAttempts,
    settings,
    auditLogs,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.teacher.findMany(),
    prisma.student.findMany(),
    prisma.studentTeacherAssignment.findMany(),
    prisma.hourPackage.findMany(),
    prisma.classEvent.findMany({ orderBy: { startAt: 'asc' } }),
    prisma.classEnrollment.findMany(),
    prisma.attendanceRecord.findMany(),
    prisma.instructorAttendance.findMany(),
    prisma.cancellation.findMany(),
    prisma.crmContact.findMany(),
    prisma.crmActivity.findMany(),
    prisma.incident.findMany(),
    prisma.weeklyClosing.findMany(),
    prisma.messageTemplate.findMany(),
    prisma.notificationAttempt.findMany(),
    prisma.setting.findMany(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
  ])

  const payload = {
    exportedAt: new Date().toISOString(),
    source: 'TEATIME Ops local export',
    warning: 'Passwords are redacted. This is a portability snapshot, not a full Postgres restore dump.',
    counts: {
      users: users.length,
      teachers: teachers.length,
      students: students.length,
      classEvents: classEvents.length,
      crmContacts: crmContacts.length,
      incidents: incidents.length,
      auditLogs: auditLogs.length,
    },
    data: {
      users: redactUsers(users),
      teachers,
      students,
      studentTeacherAssignments,
      hourPackages,
      classEvents,
      classEnrollments,
      attendanceRecords,
      instructorAttendances,
      cancellations,
      crmContacts,
      crmActivities,
      incidents,
      weeklyClosings,
      messageTemplates,
      notificationAttempts,
      settings,
      auditLogs,
    },
  }

  await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`Backup exported: ${outputPath}`)
  console.log(JSON.stringify(payload.counts, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
