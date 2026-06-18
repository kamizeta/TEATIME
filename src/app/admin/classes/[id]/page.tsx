import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function ClassDetail({ params }: { params: { id: string } }) {
  const ev = await prisma.classEvent.findUnique({
    where: { id: params.id },
    include: {
      enrollments: {
        include: {
          student: { include: { user: true } },
          package: true,
          attendance: true,
        },
      },
      instructorAttendance: true,
      cancellations: true,
    },
  })

  if (!ev) return notFound()

  return (
    <div>
      <h1>{ev.title}</h1>
      <p>{new Date(ev.startAt).toLocaleString()} - {new Date(ev.endAt).toLocaleString()}</p>
      <p>Estado: {ev.status}</p>
      <p>Meet: {ev.meetUrl || 'sin link'}</p>

      <h2>Asistencia por alumno</h2>
      <table>
        <thead>
          <tr><th>Alumno</th><th>Paquete</th><th>Estado</th></tr>
        </thead>
        <tbody>
          {ev.enrollments.map((en) => (
            <tr key={en.id}>
              <td>{en.student.user.name}</td>
              <td>{en.package.id}</td>
              <td>{en.attendance?.status || 'pendiente'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p><Link href={`/admin/classes/${ev.id}/attendance`}>Registrar asistencia</Link></p>
    </div>
  )
}
