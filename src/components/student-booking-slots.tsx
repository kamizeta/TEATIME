'use client'

import { useMemo, useState } from 'react'
import { bookSlotAction } from '@/lib/actions/booking'

type BookableSlot = {
  token: string
  startsAtIso: string
  durationMinutes: number
  classType: 'ONE_ON_ONE' | 'GROUP'
  availableSeats: number
}

const BOGOTA_TIMEZONE = 'America/Bogota'

function dateKey(value: string | Date) {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: BOGOTA_TIMEZONE })
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-CO', {
    timeZone: BOGOTA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSlot(slot: BookableSlot) {
  return `${formatTime(slot.startsAtIso)} · ${slot.classType === 'ONE_ON_ONE' ? '1:1' : `Grupal (${slot.availableSeats})`} · ${slot.durationMinutes} min`
}

function getWeekDays(slots: BookableSlot[]) {
  const anchor = slots[0]
  if (!anchor) return []

  const anchorDate = new Date(`${dateKey(anchor.startsAtIso)}T12:00:00-05:00`)
  const mondayOffset = (anchorDate.getUTCDay() + 6) % 7
  anchorDate.setUTCDate(anchorDate.getUTCDate() - mondayOffset)

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(anchorDate)
    day.setUTCDate(anchorDate.getUTCDate() + index)
    return day
  })
}

function SlotButton({ slot }: { slot: BookableSlot }) {
  return (
    <form action={bookSlotAction}>
      <input type="hidden" name="slotToken" value={slot.token} />
      <button type="submit" className="student-booking-slot">{formatSlot(slot)}</button>
    </form>
  )
}

export function StudentBookingSlots({ slots }: { slots: BookableSlot[] }) {
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const groupedSlots = useMemo(() => slots.reduce<Record<string, BookableSlot[]>>((acc, slot) => {
    const day = new Date(slot.startsAtIso).toLocaleDateString('es-CO', {
      timeZone: BOGOTA_TIMEZONE,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    acc[day] ||= []
    acc[day].push(slot)
    return acc
  }, {}), [slots])
  const weekDays = useMemo(() => getWeekDays(slots), [slots])

  if (!slots.length) {
    return <div className="empty-state">No hay espacios reservables con la configuración actual. Revisa las reglas de reserva o la disponibilidad del profesor.</div>
  }

  return (
    <div className="student-booking-slots">
      <div className="schedule-heading">
        <div className="card-header">
          <p className="eyebrow">Disponibilidad</p>
          <h3>Elige tu próximo espacio</h3>
        </div>
        <div className="schedule-view-toggle" aria-label="Vista de disponibilidad">
          <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>Lista</button>
          <button type="button" className={view === 'calendar' ? 'is-active' : ''} onClick={() => setView('calendar')}>Calendario</button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="student-booking-list">
          {Object.entries(groupedSlots).map(([day, daySlots]) => (
            <section key={day} className="student-booking-day">
              <div className="card-header"><p className="eyebrow">Disponibilidad</p><h3>{day}</h3></div>
              <div className="toolbar">{daySlots.map((slot) => <SlotButton key={slot.token} slot={slot} />)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="student-booking-calendar-board">
          {weekDays.map((day) => {
            const daySlots = slots.filter((slot) => dateKey(slot.startsAtIso) === dateKey(day))
            return (
              <section key={dateKey(day)} className="student-booking-calendar-day">
                <header>
                  <p>{day.toLocaleDateString('es-CO', { timeZone: BOGOTA_TIMEZONE, weekday: 'long' })}</p>
                  <strong>{day.toLocaleDateString('es-CO', { timeZone: BOGOTA_TIMEZONE, day: '2-digit', month: 'short' })}</strong>
                </header>
                <div className="student-booking-calendar-events">
                  {daySlots.length ? daySlots.map((slot) => <SlotButton key={slot.token} slot={slot} />) : <p className="student-booking-calendar-empty">Sin espacios</p>}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
