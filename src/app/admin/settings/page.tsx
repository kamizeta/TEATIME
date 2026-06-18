export default function AdminSettings() {
  return (
    <div>
      <h1>Ajustes</h1>
      <p>Regla de cancelación: mínimo 6 horas por defecto.</p>
      <p>Endpoint ajustes: <a href="/api/settings">/api/settings</a> (GET/PATCH)</p>
    </div>
  )
}
