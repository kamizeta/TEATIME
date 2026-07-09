export const dynamic = "force-dynamic"

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import Link from 'next/link'

export default async function TeacherDashboard() {
  const session = await getSession()
  if (!session || session.role !== 'TEACHER') return <p>Sin sesión docente</p>

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
  if (!teacher) return <p>Docente no registrado</p>

  const rows = await prisma.classEvent.findMany({
    where: { teacherId: teacher.id },
    include: {
      enrollments: { include: { student: { include: { user: true } } }, },
    },
    orderBy: { startAt: 'asc' },
  })

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Teacher</p>
        <h1 className="page-title">Tu agenda operativa</h1>
        <p className="page-lead">Desde aquí vas a cerrar clases rápido y luego publicar disponibilidad para reservas.</p>
        <div className="toolbar">
          <Link href="/teacher/today" className="button-primary">Ver hoy</Link>
          <Link href="/teacher/availability" className="button-ghost">Mi disponibilidad</Link>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Agenda</p>
          <h2>Clases asignadas</h2>
        </div>
        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Clase</th>
                <th>Alumnos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.startAt).toLocaleString('es-CO')}</td>
                  <td>{c.title}</td>
                  <td>{c.enrollments.map((enrollment) => enrollment.student.user.name).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">Todavía no tienes clases cargadas en esta cuenta demo.</div>
        )}
      </section>
    </div>
  )
}
