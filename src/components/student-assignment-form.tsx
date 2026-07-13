'use client'

import { useState } from 'react'
import { assignTeacherToStudentAction } from '@/lib/actions'

type TeacherOption = {
  id: string
  name: string
}

export function StudentAssignmentForm({
  studentId,
  currentTeacherId,
  teachers,
}: {
  studentId: string
  currentTeacherId: string
  teachers: TeacherOption[]
}) {
  const [teacherId, setTeacherId] = useState(currentTeacherId)
  const [note, setNote] = useState('')
  const hasNewAssignment = Boolean(teacherId) && (teacherId !== currentTeacherId || note.trim().length > 0)

  return (
    <form action={assignTeacherToStudentAction} className="inline-form">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="redirectPath" value="/admin/students" />
      <select name="teacherId" className="select" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
        <option value="">Seleccionar</option>
        {teachers.map((teacher) => (
          <option key={teacher.id} value={teacher.id}>
            {teacher.name}
          </option>
        ))}
      </select>
      <input name="notes" className="input" placeholder="Nota" value={note} onChange={(event) => setNote(event.target.value)} />
      <button type="submit" className={hasNewAssignment ? 'button-primary' : 'button-ghost'}>
        Asignar
      </button>
    </form>
  )
}
