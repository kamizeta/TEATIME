import { prisma } from '@/lib/prisma'

export default async function AdminPackages() {
  const rows = await prisma.hourPackage.findMany({ include: { student: { include: { user: true } } } })
  return (
    <div>
      <h1>Paquetes</h1>
      <table>
        <thead>
          <tr><th>Alumno</th><th>Total</th><th>Usadas</th><th>Disponible</th><th>Estado</th><th>Inicio</th><th>Fin</th></tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.student.user.name}</td>
              <td>{p.totalHours}</td>
              <td>{p.usedHours}</td>
              <td>{p.totalHours - p.usedHours}</td>
              <td>{p.status}</td>
              <td>{new Date(p.validFrom).toLocaleDateString()}</td>
              <td>{new Date(p.validTo).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
