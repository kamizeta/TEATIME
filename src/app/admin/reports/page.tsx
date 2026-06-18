export const dynamic = "force-dynamic"

export default function AdminReports() {
  return (
    <div>
      <h1>Reportes</h1>
      <p>Descarga CSV:</p>
      <a href="/api/reports/attendance/export">/api/reports/attendance/export</a>
    </div>
  )
}
