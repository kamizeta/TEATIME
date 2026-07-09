export const dynamic = "force-dynamic"

import { prisma } from '@/lib/prisma'
import { formatMinutesLabel } from '@/lib/booking'

export default async function AdminPackages() {
  const rows = await prisma.hourPackage.findMany({
    include: {
      student: {
        include: {
          user: true,
          teacherAssignments: {
            where: { isPrimary: true, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
            include: { teacher: { include: { user: true } } },
            take: 1,
          },
        },
      },
    },
  })
  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Packages</p>
        <h1 className="page-title">Paquetes y saldo real</h1>
        <p className="page-lead">
          Esta vista ya usa minutos como fuente principal para soportar duraciones variables sin seguir mintiendo con horas enteras.
        </p>
      </section>

      <section className="panel table-panel">
        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Profesor asignado</th>
              <th>Total</th>
              <th>Reservado</th>
              <th>Consumido</th>
              <th>Disponible</th>
              <th>Estado</th>
              <th>Inicio</th>
              <th>Fin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((pack) => {
              const assignedTeacher = pack.student.teacherAssignments[0]?.teacher.user.name || 'Sin asignar'
              const availableMinutes = pack.totalMinutes - pack.usedMinutes - pack.reservedMinutes

              return (
                <tr key={pack.id}>
                  <td>{pack.student.user.name}</td>
                  <td>{assignedTeacher}</td>
                  <td>{formatMinutesLabel(pack.totalMinutes)}</td>
                  <td>{formatMinutesLabel(pack.reservedMinutes)}</td>
                  <td>{formatMinutesLabel(pack.usedMinutes)}</td>
                  <td>{formatMinutesLabel(availableMinutes)}</td>
                  <td>{pack.status}</td>
                  <td>{new Date(pack.validFrom).toLocaleDateString('es-CO')}</td>
                  <td>{new Date(pack.validTo).toLocaleDateString('es-CO')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
