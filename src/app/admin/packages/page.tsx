export const dynamic = "force-dynamic"

import { prisma } from '@/lib/prisma'
import { formatMinutesLabel } from '@/lib/booking'
import { adjustPackageMinutesAction } from '@/lib/actions'

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
  const adjustments = await prisma.auditLog.findMany({
    where: { entityType: 'PACKAGE_LEDGER' },
    include: { actor: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const enrollments = await prisma.classEnrollment.findMany({
    include: {
      student: { include: { user: true } },
      classEvent: {
        include: {
          cancellations: {
            orderBy: { requestTime: 'desc' },
            take: 1,
          },
        },
      },
      package: true,
    },
    orderBy: { classEvent: { startAt: 'desc' } },
    take: 40,
  })
  const ledgerRows = [
    ...enrollments.flatMap((enrollment) => {
      const rows = []
      if (enrollment.reservedMinutes > 0) {
        rows.push({
          key: `${enrollment.id}-reserve`,
          student: enrollment.student.user.name,
          packageId: enrollment.packageId,
          type: 'Reserva',
          minutes: enrollment.reservedMinutes,
          date: enrollment.classEvent.startAt,
          note: enrollment.classEvent.title,
        })
      }
      if (enrollment.consumedMinutes > 0) {
        rows.push({
          key: `${enrollment.id}-consume`,
          student: enrollment.student.user.name,
          packageId: enrollment.packageId,
          type: 'Consumo',
          minutes: enrollment.consumedMinutes,
          date: enrollment.classEvent.startAt,
          note: enrollment.classEvent.title,
        })
      }
      if (enrollment.status === 'CANCELLED') {
        rows.push({
          key: `${enrollment.id}-release`,
          student: enrollment.student.user.name,
          packageId: enrollment.packageId,
          type: 'Liberación',
          minutes: enrollment.classEvent.durationMinutes || 60,
          date: enrollment.classEvent.startAt,
          note: enrollment.classEvent.cancellations[0]?.reason || 'Cancelación operativa',
        })
      }
      return rows
    }),
    ...adjustments.map((item) => {
      const after = item.after ? JSON.parse(item.after) : {}
      return {
        key: item.id,
        student: 'Ajuste manual',
        packageId: item.entityId,
        type: 'Ajuste',
        minutes: Number(after.deltaMinutes || 0),
        date: item.createdAt,
        note: String(after.note || item.action),
      }
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Packages</p>
        <h1 className="page-title">Paquetes y saldo real</h1>
        <p className="page-lead">
          Esta vista ya usa minutos como fuente principal para soportar duraciones variables sin seguir mintiendo con horas enteras.
        </p>
      </section>

      <section className="panel">
        <div className="card-header">
          <p className="eyebrow">Ajuste operativo</p>
          <h2>Modificar saldo total del paquete</h2>
        </div>
        <form action={adjustPackageMinutesAction} className="ops-form">
          <div className="stack-xs">
            <label htmlFor="packageId">Paquete</label>
            <select id="packageId" name="packageId" className="select">
              {rows.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.student.user.name} · {formatMinutesLabel(pack.totalMinutes)} totales
                </option>
              ))}
            </select>
          </div>
          <div className="stack-xs">
            <label htmlFor="deltaMinutes">Delta minutos</label>
            <input id="deltaMinutes" name="deltaMinutes" type="number" className="input" placeholder="60 o -60" />
          </div>
          <div className="stack-xs ops-span-2">
            <label htmlFor="note">Nota operativa</label>
            <input id="note" name="note" className="input" placeholder="Ajuste por compra extra, compensación o corrección." />
          </div>
          <button type="submit" className="button-primary ops-span-2">Aplicar ajuste</button>
        </form>
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

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Ledger</p>
          <h2>Movimientos recientes</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Alumno</th>
              <th>Paquete</th>
              <th>Tipo</th>
              <th>Minutos</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.slice(0, 60).map((row) => (
              <tr key={row.key}>
                <td>{new Date(row.date).toLocaleString('es-CO')}</td>
                <td>{row.student}</td>
                <td>{row.packageId.slice(0, 8)}</td>
                <td>{row.type}</td>
                <td>{row.minutes > 0 ? formatMinutesLabel(row.minutes) : `${row.minutes} min`}</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
