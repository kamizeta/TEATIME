'use client'

import Link from 'next/link'
import { useState } from 'react'
import { submitCancellationAction } from '@/lib/actions'

type ScheduledClass = {
  id: string
  title: string
  startAt: string
  endAt: string
  durationMinutes: number
  meetUrl: string | null
  status: string
  students: string[]
}

const statusLabels: Record<string, string> = {
  SCHEDULED: 'Programada',
  RESERVED: 'Reservada',
  COMPLETED: 'Finalizada',
  CANCELED: 'Cancelada',
}

const BOGOTA_TIMEZONE = 'America/Bogota'

function dateKey(value: string | Date) {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: BOGOTA_TIMEZONE })
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

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-CO', {
    timeZone: BOGOTA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getWeekStart(classes: ScheduledClass[]) {
  const anchor = classes.find((item) => new Date(item.startAt) >= new Date()) || classes[0]
  const anchorDate = anchor
    ? new Date(`${dateKey(anchor.startAt)}T12:00:00-05:00`)
    : new Date(`${dateKey(new Date())}T12:00:00-05:00`)

  const mondayOffset = (anchorDate.getUTCDay() + 6) % 7
  anchorDate.setUTCDate(anchorDate.getUTCDate() - mondayOffset)
  return anchorDate
}

function getTodayWeekStart() {
  const today = new Date(`${dateKey(new Date())}T12:00:00-05:00`)
  const mondayOffset = (today.getUTCDay() + 6) % 7
  today.setUTCDate(today.getUTCDate() - mondayOffset)
  return today
}

function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart)
    day.setUTCDate(weekStart.getUTCDate() + index)
    return day
  })
}

function moveWeek(weekStart: Date, amount: number) {
  const nextWeek = new Date(weekStart)
  nextWeek.setUTCDate(nextWeek.getUTCDate() + amount * 7)
  return nextWeek
}

function formatWeekRange(weekDays: Date[]) {
  if (!weekDays.length) return ''
  const first = weekDays[0]
  const last = weekDays[6]
  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TIMEZONE,
    day: 'numeric',
    month: 'short',
  })
  return `${formatter.format(first)} - ${formatter.format(last)}`
}

function CancellationAction({ classId }: { classId: string }) {
  return (
    <form action={submitCancellationAction}>
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="scope" value="CLASS" />
      <input type="hidden" name="redirectPath" value="/teacher/today" />
      <input type="hidden" name="reason" value="Clase cancelada por el profesor desde su agenda operativa." />
      <button type="submit" className="button-ghost compact-button">Cancelar</button>
    </form>
  )
}

export function TeacherSchedule({ classes }: { classes: ScheduledClass[] }) {
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [weekStart, setWeekStart] = useState(() => getWeekStart(classes))
  const weekDays = getWeekDays(weekStart)

  return (
    <section className="panel teacher-schedule-panel">
      <div className="schedule-heading">
        <div className="card-header">
          <p className="eyebrow">Agenda</p>
          <h2>Clases asignadas</h2>
        </div>
        <div className="teacher-schedule-controls">
          {view === 'calendar' ? (
            <div className="week-navigator" aria-label="Navegación semanal">
              <button type="button" className="week-nav-button" aria-label="Semana anterior" onClick={() => setWeekStart((current) => moveWeek(current, -1))}>←</button>
              <strong>{formatWeekRange(weekDays)}</strong>
              <button type="button" className="week-nav-button" aria-label="Semana siguiente" onClick={() => setWeekStart((current) => moveWeek(current, 1))}>→</button>
              <button type="button" className="week-today-button" onClick={() => setWeekStart(getTodayWeekStart())}>Volver a hoy</button>
            </div>
          ) : null}
          <div className="schedule-view-toggle" aria-label="Vista de agenda">
            <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>Lista</button>
            <button type="button" className={view === 'calendar' ? 'is-active' : ''} onClick={() => setView('calendar')}>Calendario</button>
          </div>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="empty-state">Todavía no tienes clases cargadas en esta cuenta.</div>
      ) : view === 'list' ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Clase</th>
                <th>Alumnos</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.startAt)}</td>
                  <td><strong>{item.title}</strong><small className="block-muted">{item.durationMinutes} min</small></td>
                  <td>{item.students.join(', ') || 'Sin alumnos'}</td>
                  <td><span className="status-pill">{statusLabels[item.status] || item.status}</span></td>
                  <td>
                    <div className="inline-actions teacher-class-actions">
                      <Link href={`/teacher/classes/${item.id}`} className="button-link compact-button">Ver detalle</Link>
                      {item.meetUrl ? <a href={item.meetUrl} target="_blank" rel="noreferrer" className="button-ghost compact-button">Entrar a Meet</a> : null}
                      {item.status === 'CANCELED' || item.status === 'COMPLETED' ? null : <CancellationAction classId={item.id} />}
                    </div>
                  </td>
                </tr>
              ))}
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
                  <strong>
                    {isToday
                      ? `Hoy · ${day.toLocaleDateString('es-CO', { timeZone: BOGOTA_TIMEZONE, day: 'numeric', month: 'long' })}`
                      : day.toLocaleDateString('es-CO', { timeZone: BOGOTA_TIMEZONE, day: '2-digit', month: 'short' })}
                  </strong>
                </header>
                <div className="teacher-calendar-events">
                  {dayClasses.length ? dayClasses.map((item) => (
                    <article key={item.id} className={`teacher-calendar-event teacher-calendar-event-${item.status.toLowerCase()}`}>
                      <span>{formatTime(item.startAt)} - {formatTime(item.endAt)}</span>
                      <strong>{item.title}</strong>
                      <small>{item.students.join(', ') || 'Sin alumnos'}</small>
                      <Link href={`/teacher/classes/${item.id}`}>Ver detalle</Link>
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
