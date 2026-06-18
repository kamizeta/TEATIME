'use client'

import { FormEvent, useState } from 'react'

export default function AttendancePage({ params }: { params: { id: string } }) {
  const [studentId, setStudentId] = useState('')
  const [status, setStatus] = useState('attended')
  const [msg, setMsg] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const resp = await fetch(`/api/classes/${params.id}/attendance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, status }),
      credentials: 'include',
    })

    const json = await resp.json()
    if (json.ok) {
      setMsg('Guardado')
      setStudentId('')
    } else {
      setMsg(json.error || 'Error')
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h1>Marcar asistencia</h1>
      <p>ID de matrícula del alumno</p>
      <input value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="attended">Asistió</option>
        <option value="absent">Ausente</option>
        <option value="late">Tardanza</option>
        <option value="no_show">No_show</option>
      </select>
      <button>Guardar</button>
      <p>{msg}</p>
    </form>
  )
}
