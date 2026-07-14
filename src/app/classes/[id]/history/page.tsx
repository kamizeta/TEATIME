import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseList(value: string | null) {
  if (!value) return [] as string[]
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function ListBlock({ title, value }: { title: string; value: string | null }) {
  const items = parseList(value)
  if (!items.length) return null
  return <div><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>
}

export default async function ClassHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const classEvent = await prisma.classEvent.findUnique({
    where: { id },
    include: {
      teacher: { include: { user: true } },
      enrollments: { include: { student: { include: { user: true } }, attendance: true } },
      meetEvidence: true,
      transcript: true,
      learningReport: true,
    },
  })
  if (!classEvent) notFound()

  const isAdmin = session.role === 'ADMIN' || session.role === 'STAFF'
  const isTeacher = session.role === 'TEACHER' && classEvent.teacher.userId === session.userId
  const isStudent = session.role === 'STUDENT' && classEvent.enrollments.some((item) => item.student.userId === session.userId)
  if (!isAdmin && !isTeacher && !isStudent) notFound()

  const canReadTranscript = isAdmin || (isTeacher && classEvent.transcript?.shareWithTeacher) || (isStudent && classEvent.transcript?.shareWithStudent)
  const transcript = canReadTranscript ? classEvent.transcript : null
  const report = classEvent.learningReport

  return (
    <div className="page-stack">
      <Link href={isStudent ? '/student/home' : isTeacher ? '/teacher/today' : `/admin/classes/${id}`} className="text-link">Volver</Link>
      <section className="hero">
        <p className="eyebrow">Historial de clase</p>
        <h1 className="page-title">{classEvent.title}</h1>
        <p className="page-lead">{new Date(classEvent.startAt).toLocaleString('es-CO')} · Profesor: {classEvent.teacher.user.name}</p>
        <div className="toolbar"><Link href="/legal/consent" className="button-ghost">Gestionar consentimiento de transcripción</Link></div>
      </section>

      <section className="panel">
        <div className="card-header"><p className="eyebrow">Evidencia de Meet</p><h2>Estado operativo</h2></div>
        {classEvent.meetEvidence ? (
          <div className="metric-row">
            <span className="status-pill">Estado: {classEvent.meetEvidence.status}</span>
            <span className="status-pill">Duración observada: {classEvent.meetEvidence.observedMinutes} min</span>
            <span className="status-pill">Participantes: {classEvent.meetEvidence.participantCount}</span>
            <span className="status-pill">Profesor identificado: {classEvent.meetEvidence.teacherEvidence ? 'Sí' : 'No'}</span>
          </div>
        ) : <p className="muted">Aún no se ha consultado evidencia de Google Meet para esta clase.</p>}
        {classEvent.meetEvidence?.exceptionReason ? <p className="status-warning">{classEvent.meetEvidence.exceptionReason}</p> : null}
      </section>

      <section className="panel table-panel">
        <div className="card-header"><p className="eyebrow">Participación</p><h2>Asistencia registrada</h2></div>
        <table><thead><tr><th>Alumno</th><th>Estado</th></tr></thead><tbody>
          {classEvent.enrollments.map((item) => <tr key={item.id}><td>{item.student.user.name}</td><td>{item.attendance?.status === 'attended' ? 'Asistió' : item.attendance?.status === 'late' ? 'Llegó tarde' : item.attendance?.status === 'no_show' || item.attendance?.status === 'absent' ? 'No asistió' : 'Pendiente'}</td></tr>)}
        </tbody></table>
      </section>

      <section className="panel">
        <div className="card-header"><p className="eyebrow">Informe pedagógico</p><h2>Resumen de la clase</h2></div>
        {report?.status === 'READY' ? (
          <div className="legal-copy">
            <p>{report.studentSummary}</p>
            <ListBlock title="Temas tratados" value={report.topicsJson} />
            <ListBlock title="Vocabulario y expresiones" value={report.vocabularyJson} />
            <ListBlock title="Correcciones" value={report.correctionsJson} />
            {report.homework ? <div><h3>Práctica recomendada</h3><p>{report.homework}</p></div> : null}
            {report.nextClassPlan ? <div><h3>Próxima clase</h3><p>{report.nextClassPlan}</p></div> : null}
            {isAdmin || isTeacher ? report.teacherInternalNotes ? <div><h3>Notas internas del profesor</h3><p>{report.teacherInternalNotes}</p></div> : null : null}
          </div>
        ) : <p className="muted">{report?.errorMessage || 'El informe estará disponible cuando Google publique la transcripción y se configure el proveedor de IA.'}</p>}
      </section>

      <section className="panel">
        <div className="card-header"><p className="eyebrow">Transcripción</p><h2>Contenido de la clase</h2></div>
        {!canReadTranscript ? <p className="muted">La transcripción no está disponible para tu rol.</p> : transcript?.status === 'READY' ? (
          <div className="legal-copy">
            {transcript.googleDriveUrl ? <a href={transcript.googleDriveUrl} target="_blank" rel="noreferrer" className="text-link">Abrir documento original en Google Drive</a> : null}
            <pre className="transcript-view">{transcript.transcriptText}</pre>
          </div>
        ) : <p className="muted">{transcript?.errorMessage || 'Aún no hay transcripción disponible.'}</p>}
      </section>
    </div>
  )
}
