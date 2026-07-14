'use client'

import { useState } from 'react'
import { updateUserAction } from '@/lib/actions'
import { UserAccessActions } from '@/components/user-access-actions'
import { ActionIconButton, ActionIconLink } from '@/components/action-icon-button'

type TeacherDirectoryRowProps = {
  teacher: {
    id: string
    userId: string
    name: string
    email: string
    phoneE164: string | null
    isActive: boolean
    studentNames: string[]
    availabilityCount: number
    completedClasses: number
    programmedClasses: number
    nextClass: {
      title: string
      startsAt: string
    } | null
  }
}

export function TeacherDirectoryRow({ teacher }: TeacherDirectoryRowProps) {
  const [name, setName] = useState(teacher.name)
  const [email, setEmail] = useState(teacher.email)
  const [phoneE164, setPhoneE164] = useState(teacher.phoneE164 || '')
  const [isActive, setIsActive] = useState(teacher.isActive)
  const formId = `teacher-update-${teacher.id}`
  const hasChanges =
    name.trim() !== teacher.name ||
    email.trim().toLowerCase() !== teacher.email ||
    phoneE164 !== (teacher.phoneE164 || '') ||
    isActive !== teacher.isActive

  return (
    <tr>
      <td>
        <form id={formId} action={updateUserAction}>
          <input type="hidden" name="redirectPath" value="/admin/teachers" />
          <input type="hidden" name="userId" value={teacher.userId} />
        </form>
        <input
          form={formId}
          name="name"
          className="input compact-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label={`Nombre y apellido de ${teacher.name}`}
          required
        />
      </td>
      <td>
        <input
          form={formId}
          name="email"
          type="email"
          className="input compact-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-label={`Correo electrónico de ${teacher.name}`}
          required
        />
      </td>
      <td>
        <input
          form={formId}
          name="phoneE164"
          type="tel"
          inputMode="tel"
          pattern="[+0-9]*"
          className="input compact-input"
          value={phoneE164}
          onChange={(event) => {
            const value = event.target.value.trim()
            const digits = value.replace(/\D/g, '')
            setPhoneE164(value.startsWith('+') ? `+${digits}` : digits)
          }}
          aria-label={`WhatsApp de ${teacher.name}`}
        />
      </td>
      <td>
        <label className="check-row user-active-toggle">
          <input
            form={formId}
            type="checkbox"
            name="isActive"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Activo
        </label>
      </td>
      <td>
        <strong>{teacher.studentNames.length}</strong>
        <small className="block-muted teacher-row-summary">
          {teacher.studentNames.join(', ') || 'Sin alumnos asignados'}
        </small>
      </td>
      <td>
        <strong>{teacher.availabilityCount}</strong>
        <small className="block-muted">bloques activos</small>
      </td>
      <td>
        <strong>{teacher.completedClasses} / {teacher.programmedClasses}</strong>
        <small className="block-muted">realizadas / programadas</small>
        {teacher.nextClass ? (
          <>
            <strong className="teacher-next-class">{new Date(teacher.nextClass.startsAt).toLocaleString('es-CO')}</strong>
            <small className="block-muted teacher-row-summary">{teacher.nextClass.title}</small>
          </>
        ) : (
          <span className="block-muted">Sin próximas clases</span>
        )}
      </td>
      <td className="teacher-directory-actions">
        <div className="action-icon-group">
          <ActionIconLink href={`/admin/teachers/${teacher.id}`} icon="detail" label="Ver detalle del profesor" tone="primary" />
          <ActionIconButton
            form={formId}
            type="submit"
            disabled={!hasChanges}
            icon="save"
            label="Guardar cambios del profesor"
            tone={hasChanges ? 'primary' : 'default'}
          />
          <UserAccessActions userId={teacher.userId} role="TEACHER" />
        </div>
      </td>
    </tr>
  )
}
