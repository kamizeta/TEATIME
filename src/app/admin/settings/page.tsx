export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGoogleCalendarSettingsState } from '@/lib/google-calendar'
import { saveAdminSettingsAction, syncGoogleCalendarAction } from '@/lib/actions'
import { DirtySubmitButton } from '@/components/dirty-submit-button'

export default async function AdminSettings({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN' && session.role !== 'STAFF') redirect('/')

  const canEdit = session?.role === 'ADMIN'
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    orderBy: { name: 'asc' },
    select: { email: true, name: true },
  })
  const bookingRule = await prisma.bookingRule.findFirst({ orderBy: { createdAt: 'asc' } })
  const googleState = await getGoogleCalendarSettingsState()

  const syncCount = typeof searchParams?.sync === 'string' ? searchParams.sync : ''
  const skippedCount = typeof searchParams?.skipped === 'string' ? searchParams.skipped : ''
  const googleError = typeof searchParams?.google_error === 'string' ? searchParams.google_error : ''

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Ajustes operativos</p>
        <h1 className="page-title">Google Calendar, políticas y cuenta activa</h1>
        <p className="page-lead">
          Aquí conectas tu cuenta de prueba hoy y luego reemplazas por la cuenta oficial de `teatimeacademy.com`
          sin tocar el código.
        </p>
      </section>

      {searchParams?.saved ? <p className="status-success">Configuración guardada.</p> : null}
      {syncCount ? (
        <p className="status-success">
          Sincronización terminada. Eventos sincronizados: {syncCount}. Omitidos: {skippedCount || '0'}.
        </p>
      ) : null}
      {searchParams?.google === 'connected' ? <p className="status-success">Cuenta de Google conectada.</p> : null}
      {searchParams?.google === 'missing_env' ? (
        <p className="status-warning">
          Faltan `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` o `APP_BASE_URL` para conectar Google.
        </p>
      ) : null}
      {googleError ? <p className="status-warning">Google devolvió un error: {googleError}</p> : null}
      {!canEdit ? (
        <p className="status-warning">Entraste como equipo operativo. Puedes revisar, pero solo el administrador puede cambiar esto.</p>
      ) : null}

      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Cuenta conectada</p>
            <h2>Integración Google Calendar</h2>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <strong>OAuth</strong>
              <span>{googleState.refreshTokenPresent ? 'Conectado' : 'Pendiente'}</span>
            </div>
            <div className="settings-row">
              <strong>Cuenta actual</strong>
              <span>{googleState.accountEmail || 'Sin cuenta conectada todavía'}</span>
            </div>
            <div className="settings-row">
              <strong>Calendario activo</strong>
              <span>{googleState.calendarName || googleState.calendarId || 'Sin calendario seleccionado'}</span>
            </div>
          </div>
          <p className="hint">
            En pruebas puedes conectar tu cuenta. Luego cambias el calendario o reconectas con la cuenta oficial
            desde la misma pantalla.
          </p>
          <div className="inline-actions">
            {canEdit ? (
              <Link href="/api/integrations/google/connect" className="button-link">
                Conectar o reconectar Google
              </Link>
            ) : null}
            <Link href="/admin/calendar" className="button-ghost">
              Ver calendario operativo
            </Link>
          </div>
        </section>

        <section className="panel settings-card">
          <div className="card-header">
            <p className="eyebrow">Reglas</p>
            <h2>Configuración editable</h2>
          </div>
          <form action={saveAdminSettingsAction} className="stack-md">
            <div className="stack-xs">
              <label htmlFor="minimumNoticeHours">Horas mínimas de anticipación para cancelar</label>
              <input
                id="minimumNoticeHours"
                name="minimumNoticeHours"
                type="number"
                min="0"
                max="72"
                className="input"
                defaultValue={bookingRule?.minimumNoticeHours || 6}
                disabled={!canEdit}
              />
            </div>

            <div className="stack-xs">
              <label htmlFor="calendarId">ID del calendario activo</label>
              {googleState.calendars.length ? (
                <select
                  id="calendarId"
                  name="calendarId"
                  className="select"
                  defaultValue={googleState.calendarId}
                  disabled={!canEdit}
                >
                  <option value="">Selecciona un calendario</option>
                  {googleState.calendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.summary} {calendar.primary ? '(Principal)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="calendarId"
                  name="calendarId"
                  className="input"
                  defaultValue={googleState.calendarId}
                  placeholder="tu-correo@gmail.com o calendarId"
                  disabled={!canEdit}
                />
              )}
              <p className="hint">Aquí dejas el calendario de pruebas hoy y luego cambias al oficial sin tocar código.</p>
            </div>

            <div className="stack-xs">
              <label htmlFor="fallbackTeacherEmail">Profesor de respaldo para importar eventos</label>
              <select
                id="fallbackTeacherEmail"
                name="fallbackTeacherEmail"
                className="select"
                defaultValue={googleState.fallbackTeacherEmail}
                disabled={!canEdit}
              >
                <option value="">Detectar profesor desde el evento</option>
                {teachers.map((teacher) => (
                  <option key={teacher.email} value={teacher.email}>
                    {teacher.name} - {teacher.email}
                  </option>
                ))}
              </select>
              <p className="hint">
                Si tu calendario de prueba no trae un profesor identificable entre organizador o invitados, usamos este
                profesor de respaldo para no bloquear la importación.
              </p>
            </div>

            {canEdit ? (
              <div className="inline-actions">
                <DirtySubmitButton>
                  Guardar ajustes
                </DirtySubmitButton>
                <button formAction={syncGoogleCalendarAction} className="button-ghost">
                  Sincronizar ahora
                </button>
              </div>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  )
}
