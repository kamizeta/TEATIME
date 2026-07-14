export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const statusLabels: Record<string, string> = {
  SCHEDULED: 'Programada',
  RESERVED: 'Reservada',
  COMPLETED: 'Finalizada',
  CANCELED: 'Cancelada',
}

export default async function TeacherClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'TEACHER') redirect('/')

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
  if (!teacher) notFound()

  const classEvent = await prisma.classEvent.findFirst({
    where: { id, teacherId: teacher.id },
    include: {
      enrollments: {
        include: {
          student: { include: { user: { select: { name: true, email: true } } } },
        },
      },
    },
  })

  if (!classEvent) notFound()

  const schedule = new Date(classEvent.startAt).toLocaleString('es-CO', {
    timeZone: classEvent.timezone || 'America/Bogota',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="page-stack">
      <Link href="/teacher/today" className="text-link">Volver a mi agenda</Link>
      <section className="hero">
        <p className="eyebrow">Clase asignada</p>
        <h1 className="page-title">{classEvent.title}</h1>
        <p className="page-lead">{schedule} · {classEvent.durationMinutes} min · {classEvent.classType === 'GROUP' ? 'Grupal' : '1:1'}</p>
        <div className="toolbar">
          <span className="status-pill">{statusLabels[classEvent.status] || classEvent.status}</span>
          <Link href={`/classes/${classEvent.id}/history`} className="button-ghost">Historial e informe</Link>
          {classEvent.meetUrl ? (
            <a href={classEvent.meetUrl} target="_blank" rel="noreferrer" className="button-primary">Conectarse por Google Meet</a>
          ) : null}
        </div>
      </section>

      <section className="panel class-detail-panel">
        <div className="card-header">
          <p className="eyebrow">Conexión virtual</p>
          <h2>Google Meet</h2>
        </div>
        {classEvent.meetUrl ? (
          <div className="meet-link-row">
            <a href={classEvent.meetUrl} target="_blank" rel="noreferrer" className="text-link">{classEvent.meetUrl}</a>
            <a href={classEvent.meetUrl} target="_blank" rel="noreferrer" className="button-primary compact-button">Abrir Meet</a>
          </div>
        ) : <p className="status-warning">El enlace de Meet todavía no existe. Aparecerá aquí cuando la clase se sincronice con Google Calendar.</p>}
      </section>

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Participantes</p>
          <h2>Alumnos de la clase</h2>
        </div>
        {classEvent.enrollments.length ? (
          <table>
            <thead><tr><th>Alumno</th><th>Correo electrónico</th></tr></thead>
            <tbody>
              {classEvent.enrollments.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td>{enrollment.student.user.name}</td>
                  <td>{enrollment.student.user.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty-state">Esta clase aún no tiene alumnos inscritos.</div>}
      </section>
    </div>
  )
}
