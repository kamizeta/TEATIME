'use client'

import { useState, useTransition } from 'react'
import { ActionIconButton } from '@/components/action-icon-button'

type AttendanceRow = {
  studentId: string
  studentName: string
  status: string
}

export default function AttendanceClient({
  classId,
  title,
  rows,
}: {
  classId: string
  title: string
  rows: AttendanceRow[]
}) {
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const [statusByStudent, setStatusByStudent] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((row) => [row.studentId, row.status === 'pending' ? 'attended' : row.status]))
  )
  const initialStatusByStudent = Object.fromEntries(
    rows.map((row) => [row.studentId, row.status === 'pending' ? 'attended' : row.status]),
  )

  const saveRow = (studentId: string) => {
    startTransition(async () => {
      setMessage('')
      const response = await fetch(`/api/classes/${classId}/attendance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          studentId,
          status: statusByStudent[studentId],
        }),
      })

      const json = await response.json()
      setMessage(json.ok ? 'Asistencia guardada.' : json.error || 'No se pudo guardar la asistencia.')
    })
  }

  return (
    <section className="panel table-panel">
      <div className="card-header">
        <p className="eyebrow">Clase</p>
        <h2>{title}</h2>
      </div>

      <table>
        <thead>
          <tr>
            <th>Alumno</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studentId}>
              <td>{row.studentName}</td>
              <td>
                <select
                  className="input"
                  value={statusByStudent[row.studentId]}
                  onChange={(event) =>
                    setStatusByStudent((current) => ({
                      ...current,
                      [row.studentId]: event.target.value,
                    }))
                  }
                >
                  <option value="attended">Asistió</option>
                  <option value="late">Tardanza</option>
                  <option value="absent">No asistió</option>
                  <option value="no_show">No asistió</option>
                </select>
              </td>
              <td>
                <ActionIconButton
                  type="button"
                  onClick={() => saveRow(row.studentId)}
                  disabled={isPending || statusByStudent[row.studentId] === initialStatusByStudent[row.studentId]}
                  icon="save"
                  label="Guardar asistencia"
                  tone={statusByStudent[row.studentId] !== initialStatusByStudent[row.studentId] ? 'primary' : 'default'}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {message ? <p className="muted">{message}</p> : null}
    </section>
  )
}
