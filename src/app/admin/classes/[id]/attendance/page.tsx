export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AttendanceClient from './attendance-client'

export default async function AttendancePage({ params }: { params: { id: string } }) {
  const classEvent = await prisma.classEvent.findUnique({
    where: { id: params.id },
    include: {
      enrollments: {
        include: {
          student: { include: { user: true } },
          attendance: true,
        },
      },
    },
  })

  if (!classEvent) return notFound()

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Attendance</p>
        <h1 className="page-title">Registrar asistencia</h1>
        <p className="page-lead">
          Marca la asistencia sin usar IDs manuales. Esto ya está conectado al cierre real de saldo.
        </p>
      </section>

      <AttendanceClient
        classId={classEvent.id}
        title={classEvent.title}
        rows={classEvent.enrollments.map((enrollment) => ({
          studentId: enrollment.studentId,
          studentName: enrollment.student.user.name,
          status: enrollment.attendance?.status || 'pending',
        }))}
      />
    </div>
  )
}
