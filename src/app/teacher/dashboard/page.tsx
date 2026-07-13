export const dynamic = "force-dynamic"

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import Link from 'next/link'
import { TeacherSchedule } from '@/components/teacher-schedule'

export default async function TeacherDashboard({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getSession()
  if (!session || session.role !== 'TEACHER') return <p>Sin sesión de profesor</p>

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
  if (!teacher) return <p>Profesor no registrado</p>

  const rows = await prisma.classEvent.findMany({
    where: { teacherId: teacher.id },
    include: {
      enrollments: { include: { student: { include: { user: true } } }, },
    },
    orderBy: { startAt: 'asc' },
  })
  const completedClasses = rows.filter((classEvent) => classEvent.status === 'COMPLETED').length
  const programmedClasses = rows.filter((classEvent) => classEvent.status !== 'CANCELED').length

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Profesor</p>
        <h1 className="page-title">Tu agenda operativa</h1>
        <p className="page-lead">Desde aquí vas a cerrar clases rápido y luego publicar disponibilidad para reservas.</p>
        <div className="toolbar">
          <Link href="/teacher/availability" className="button-primary">Mi disponibilidad</Link>
        </div>
        <div className="metric-row">
          <span className="status-pill">Clases realizadas: {completedClasses} / {programmedClasses}</span>
          <span className="status-pill">Realizadas / programadas</span>
        </div>
      </section>

      {searchParams?.cancel === 'ok' ? (
        <p className="status-success">Clase cancelada. El saldo reservado ya fue liberado.</p>
      ) : null}
      {searchParams?.cancel === 'denied' ? (
        <p className="status-warning">
          No puedes cancelar fuera de la ventana mínima de {searchParams?.hours || '6'} horas.
        </p>
      ) : null}

      <TeacherSchedule
        classes={rows.map((classEvent) => ({
          id: classEvent.id,
          title: classEvent.title,
          startAt: classEvent.startAt.toISOString(),
          endAt: classEvent.endAt.toISOString(),
          durationMinutes: classEvent.durationMinutes,
          meetUrl: classEvent.meetUrl,
          status: classEvent.status,
          students: classEvent.enrollments.map((enrollment) => enrollment.student.user.name),
        }))}
      />
    </div>
  )
}
