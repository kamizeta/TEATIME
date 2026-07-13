'use client'

import { useState } from 'react'
import { updateStaffPermissionAction, updateUserAction } from '@/lib/actions'
import { UserAccessActions } from '@/components/user-access-actions'

type StaffPermission = {
  canManageUsers?: boolean
  canManageRules?: boolean
  canCloseWeeks?: boolean
  canResolveIncidents?: boolean
} | null

type UserDirectoryRowProps = {
  user: {
    id: string
    name: string
    email: string
    phoneE164: string | null
    isActive: boolean
    role: string
    studentCode?: string | null
    staffPermission?: StaffPermission
  }
  roleLabel: string
}

export function UserDirectoryRow({ user, roleLabel }: UserDirectoryRowProps) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [phoneE164, setPhoneE164] = useState(user.phoneE164 || '')
  const [isActive, setIsActive] = useState(user.isActive)
  const [permissions, setPermissions] = useState({
    canManageUsers: user.staffPermission?.canManageUsers || false,
    canManageRules: user.staffPermission?.canManageRules || false,
    canCloseWeeks: user.staffPermission?.canCloseWeeks ?? true,
    canResolveIncidents: user.staffPermission?.canResolveIncidents ?? true,
  })

  const userFormId = `user-update-${user.id}`
  const permissionFormId = `staff-permissions-${user.id}`
  const hasUserChanges = name.trim() !== user.name || email.trim().toLowerCase() !== user.email || phoneE164 !== (user.phoneE164 || '') || isActive !== user.isActive
  const hasPermissionChanges = user.role === 'STAFF' && (
    permissions.canManageUsers !== (user.staffPermission?.canManageUsers || false) ||
    permissions.canManageRules !== (user.staffPermission?.canManageRules || false) ||
    permissions.canCloseWeeks !== (user.staffPermission?.canCloseWeeks ?? true) ||
    permissions.canResolveIncidents !== (user.staffPermission?.canResolveIncidents ?? true)
  )

  return (
    <tr>
      <td>
        <form id={userFormId} action={updateUserAction}>
          <input type="hidden" name="redirectPath" value="/admin/users" />
          <input type="hidden" name="userId" value={user.id} />
        </form>
        <input
          form={userFormId}
          name="name"
          className="input compact-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label={`Nombre y apellido de ${user.name}`}
        />
        {user.studentCode ? <small className="block-muted">{user.studentCode}</small> : null}
      </td>
      <td>{roleLabel}</td>
      <td>
        <input
          form={userFormId}
          name="email"
          type="email"
          className="input compact-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-label={`Correo electrónico de ${user.name}`}
          required
        />
      </td>
      <td>
        <input
          form={userFormId}
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
          aria-label={`WhatsApp de ${user.name}`}
        />
      </td>
      <td>
        <label className="check-row user-active-toggle">
          <input
            form={userFormId}
            type="checkbox"
            name="isActive"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Activo
        </label>
      </td>
      <td>
        {user.role === 'STAFF' ? (
          <div className="user-permission-controls">
            <form id={permissionFormId} action={updateStaffPermissionAction}>
              <input type="hidden" name="redirectPath" value="/admin/users" />
              <input type="hidden" name="userId" value={user.id} />
            </form>
            {([
              ['canManageUsers', 'Usuarios'],
              ['canManageRules', 'Reglas'],
              ['canCloseWeeks', 'Cierres'],
              ['canResolveIncidents', 'Incidencias'],
            ] as const).map(([key, label]) => (
              <label key={key} className="check-row">
                <input
                  form={permissionFormId}
                  type="checkbox"
                  name={key}
                  checked={permissions[key]}
                  onChange={(event) => setPermissions((current) => ({ ...current, [key]: event.target.checked }))}
                />
                {label}
              </label>
            ))}
            <button
              form={permissionFormId}
              type="submit"
              disabled={!hasPermissionChanges}
              className={`compact-button ${hasPermissionChanges ? 'button-primary' : 'button-ghost'}`}
            >
              Guardar permisos
            </button>
          </div>
        ) : <span className="block-muted">No aplica</span>}
      </td>
      <td className="user-directory-action">
        <button
          form={userFormId}
          type="submit"
          disabled={!hasUserChanges}
          className={`compact-button ${hasUserChanges ? 'button-primary' : 'button-ghost'}`}
        >
          Guardar
        </button>
        <UserAccessActions userId={user.id} role={user.role} />
      </td>
    </tr>
  )
}
