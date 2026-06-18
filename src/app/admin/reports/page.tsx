export default function AdminReports() {
  return (
    <div>
      <h1>Reportes</h1>
      <p>Descarga CSV:</p>
      <a href="/api/reports/attendance/export">/api/reports/attendance/export</a>
    </div>
  )
}

cat > src/app/admin/settings/page.tsx <<'EOF'
export default function AdminSettings() {
  return (
    <div>
      <h1>Ajustes</h1>
      <p>Regla de cancelación: mínimo 6 horas por defecto.</p>
      <p>Endpoint ajustes: <a href="/api/settings">/api/settings</a> (GET/PATCH)</p>
    </div>
  )
}
