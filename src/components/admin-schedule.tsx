'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { classStatusLabels } from '@/lib/display-labels'

type OperationalClass = {
  id: string
  title: string
  startAt: string
  endAt: string
  teacherName: string
  students: string[]
  status: string
  meetReady: boolean
  hasCancellation: boolean
}

type View = 'list' | 'calendar'
const BOGOTA_TIMEZONE = 'America/Bogota'

function dateKey(value: string | Date) {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: BOGOTA_TIMEZONE })
}

function getWeekDays(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00-05:00`)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start)
    day.setUTCDate(start.getUTCDate() + index)
    return day
  })
}

function moveWeek(weekStart: string, amount: number) {
  const [year, month, day] = weekStart.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day))
  next.setUTCDate(next.getUTCDate() + amount * 7)
  return next.toISOString().slice(0, 10)
}

function todayValue() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function formatWeekRange(days: Date[]) {
  const formatter = new Intl.DateTimeFormat('es-CO', { timeZone: BOGOTA_TIMEZONE, day: 'numeric', month: 'short' })
  return `${formatter.format(days[0])} - ${formatter.format(days[6])}`
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-CO', { timeZone: BOGOTA_TIMEZONE, hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-CO', {
    timeZone: BOGOTA_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminSchedule({ classes, weekStart, initialView }: { classes: OperationalClass[]; weekStart: string; initialView: View }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<View>(initialView)
  const weekDays = getWeekDays(weekStart)

  function navigate(nextWeek: string, nextView = view, replace = false) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('week', nextWeek)
    params.set('view', nextView)
    const href = `${pathname}?${params.toString()}`
    if (replace) router.replace(href)
    else router.push(href)
  }

  function changeView(nextView: View) {
    setView(nextView)
    navigate(weekStart, nextView, true)
  }

  return (
    <section className="panel teacher-schedule-panel" aria-label="Agenda operativa semanal">
      <div className="schedule-heading">
        <div className="card-header">
          <p className="eyebrow">Agenda</p>
          <h2>Clases de la semana</h2>
        </div>
        <div className="teacher-schedule-controls">
          <div className="week-navigator" aria-label="Navegación semanal">
            <button type="button" className="week-nav-button" aria-label="Semana anterior" title="Semana anterior" onClick={() => navigate(moveWeek(weekStart, -1))}>←</button>
            <strong>{formatWeekRange(weekDays)}</strong>
            <button type="button" className="week-nav-button" aria-label="Semana siguiente" title="Semana siguiente" onClick={() => navigate(moveWeek(weekStart, 1))}>→</button>
            <button type="button" className="week-today-button" onClick={() => navigate(todayValue())}>Volver a hoy</button>
          </div>
          <div className="schedule-view-toggle" aria-label="Vista de agenda">
            <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => changeView('list')}>Lista</button>
            <button type="button" className={view === 'calendar' ? 'is-active' : ''} onClick={() => changeView('calendar')}>Calendario</button>
          </div>
        </div>
      </div>

      {view === 'list' ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Clase</th>
                <th>Profesor</th>
                <th>Alumnos</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {classes.length ? classes.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.startAt)}</td>
                  <td><strong>{item.title}</strong><small className="block-muted">{item.meetReady ? 'Meet listo' : 'Sin Meet'}</small></td>
                  <td>Prof. {item.teacherName}</td>
                  <td>{item.students.join(', ') || 'Sin alumnos confirmados'}</td>
                  <td><span className="status-pill">{classStatusLabels[item.status] || item.status}</span></td>
                  <td><Link href={`/admin/classes/${item.id}`} className="text-link">Ver detalle</Link></td>
                </tr>
              )) : <tr><td colSpan={6} className="muted">No hay clases para estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="teacher-calendar-board">
          {weekDays.map((day) => {
            const key = dateKey(day)
            const isToday = key === dateKey(new Date())
            const dayClasses = classes.filter((item) => dateKey(item.startAt) === key)
            return (
              <section key={key} className={`teacher-calendar-day${isToday ? ' is-today' : ''}`}>
                <header>
                  <p>{day.toLocaleDateString('es-CO', { timeZone: BOGOTA_TIMEZONE, weekday: 'long' })}</p>
                  <strong>{isToday ? `Hoy · ${day.toLocaleDateString('es-CO', { timeZone: BOGOTA_TIMEZONE, day: 'numeric', month: 'long' })}` : day.toLocaleDateString('es-CO', { timeZone: BOGOTA_TIMEZONE, day: '2-digit', month: 'short' })}</strong>
                </header>
                <div className="teacher-calendar-events">
                  {dayClasses.length ? dayClasses.map((item) => (
                    <article key={item.id} className={`teacher-calendar-event teacher-calendar-event-${item.status.toLowerCase()}`}>
                      <span>{formatTime(item.startAt)} - {formatTime(item.endAt)}</span>
                      <strong>{item.title}</strong>
                      <small>Prof. {item.teacherName}</small>
                      <small>{item.students.join(', ') || 'Sin alumnos confirmados'}</small>
                      <small>{item.meetReady ? 'Meet listo' : 'Sin Meet'}{item.hasCancellation ? ' · Con cancelación' : ''}</small>
                      <Link href={`/admin/classes/${item.id}`}>Ver detalle</Link>
                    </article>
                  )) : <p className="teacher-calendar-empty">Sin clases</p>}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
