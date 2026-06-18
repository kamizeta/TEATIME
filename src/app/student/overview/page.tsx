export const dynamic = "force-dynamic"

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export default async function StudentOverview() {
  const session = await getSession()
  if (!session || session.role !== 'STUDENT') return <p>Sin sesión</p>

  const student = await prisma.student.findUnique({ where: { userId: session.userId } })
  if (!student) return <p>Perfil no encontrado</p>

  const rows = await prisma.classEnrollment.findMany({
    where: { studentId: student.id },
    include: {
      classEvent: true,
      attendance: true,
      package: true,
    },
    orderBy: { classEvent: { startAt: 'asc' } }
  })

  return (
    <div>
      <h1>Vista alumno</h1>
      <table>
        <thead>
          <tr><th>Clase</th><th>Inicio</th><th>Asistencia</th><th>Saldo</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.classEvent.title}</td>
              <td>{new Date(r.classEvent.startAt).toLocaleString()}</td>
              <td>{r.attendance?.status || 'pendiente'}</td>
              <td>{r.package.usedHours}/{r.package.totalHours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
