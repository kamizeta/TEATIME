export const dynamic = 'force-dynamic'

import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'
import { createUserAction, updateStaffPermissionAction, updateUserAction } from '@/lib/actions'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Admin',
  STAFF: 'Staff',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
}

function getMessage(code: string) {
  const messages: Record<string, string> = {
    MISSING_USER_FIELDS: 'Faltan nombre, email o contraseña válida.',
    EMAIL_ALREADY_EXISTS: 'Ya existe un usuario con ese email.',
    USER_NOT_FOUND: 'El usuario no existe.',
    MISSING_USER_ID: 'Falta el usuario.',
  }
  return messages[code] || 'No se pudo completar la acción.'
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN' && session.role !== 'STAFF') redirect('/')

  const canEdit = session.role === 'ADMIN'
  const result = typeof searchParams?.user === 'string' ? searchParams.user : ''
  const code = typeof searchParams?.code === 'string' ? searchParams.code : ''

  const users = await prisma.user.findMany({
    include: {
      teacherProfile: true,
      studentProfile: true,
      staffPermission: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">Usuarios y permisos</p>
        <h1 className="page-title">Accesos de TEATIME Ops</h1>
        <p className="page-lead">
          Admin crea profesores, staff y alumnos. Staff puede revisar, pero solo admin cambia permisos.
        </p>
      </section>

      {result === 'created' ? <p className="status-success">Usuario creado.</p> : null}
      {result === 'updated' ? <p className="status-success">Usuario actualizado.</p> : null}
      {result === 'permissions' ? <p className="status-success">Permisos actualizados.</p> : null}
      {result === 'error' ? <p className="status-warning">{getMessage(code)}</p> : null}
      {!canEdit ? <p className="status-warning">Entraste como staff. Puedes revisar usuarios, pero no editarlos.</p> : null}

      {canEdit ? (
        <section className="panel">
          <div className="card-header">
            <p className="eyebrow">Nuevo acceso</p>
            <h2>Crear usuario</h2>
          </div>
          <form action={createUserAction} className="ops-form">
            <input type="hidden" name="redirectPath" value="/admin/users" />
            <div className="stack-xs">
              <label htmlFor="name">Nombre</label>
              <input id="name" name="name" className="input" required />
            </div>
            <div className="stack-xs">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="input" required />
            </div>
            <div className="stack-xs">
              <label htmlFor="phoneE164">Teléfono</label>
              <input id="phoneE164" name="phoneE164" className="input" placeholder="+57..." />
            </div>
            <div className="stack-xs">
              <label htmlFor="role">Rol</label>
              <select id="role" name="role" className="select" defaultValue="STUDENT">
                {Object.values(UserRole).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
              </select>
            </div>
            <div className="stack-xs ops-span-2">
              <label htmlFor="temporaryPassword">Contraseña temporal</label>
              <input id="temporaryPassword" name="temporaryPassword" className="input" defaultValue="teatime123" />
              <p className="hint">MVP local: contraseña temporal. Producción necesita invitación/reset seguro.</p>
            </div>
            <button type="submit" className="button-primary ops-span-2">Crear usuario</button>
          </form>
        </section>
      ) : null}

      <section className="panel table-panel">
        <div className="card-header">
          <p className="eyebrow">Directorio</p>
          <h2>Usuarios actuales</h2>
        </div>
        <table>
          <thead>
            <tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Editar</th><th>Permisos staff</th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>
                  <small className="block-muted">{user.email} · {user.phoneE164 || 'sin teléfono'}</small>
                  {user.studentProfile ? <small className="block-muted">{user.studentProfile.studentCode}</small> : null}
                </td>
                <td>{roleLabels[user.role]}</td>
                <td>{user.isActive ? 'Activo' : 'Inactivo'}</td>
                <td>
                  {canEdit ? (
                    <form action={updateUserAction} className="inline-form">
                      <input type="hidden" name="redirectPath" value="/admin/users" />
                      <input type="hidden" name="userId" value={user.id} />
                      <input name="name" className="input compact-input" defaultValue={user.name} />
                      <input name="phoneE164" className="input compact-input" defaultValue={user.phoneE164 || ''} />
                      <label className="check-row"><input type="checkbox" name="isActive" defaultChecked={user.isActive} /> Activo</label>
                      <button type="submit" className="button-ghost compact-button">Guardar</button>
                    </form>
                  ) : 'Solo lectura'}
                </td>
                <td>
                  {user.role === 'STAFF' && canEdit ? (
                    <form action={updateStaffPermissionAction} className="permission-grid">
                      <input type="hidden" name="redirectPath" value="/admin/users" />
                      <input type="hidden" name="userId" value={user.id} />
                      <label><input type="checkbox" name="canManageUsers" defaultChecked={user.staffPermission?.canManageUsers || false} /> Usuarios</label>
                      <label><input type="checkbox" name="canManageRules" defaultChecked={user.staffPermission?.canManageRules || false} /> Reglas</label>
                      <label><input type="checkbox" name="canCloseWeeks" defaultChecked={user.staffPermission?.canCloseWeeks ?? true} /> Cierres</label>
                      <label><input type="checkbox" name="canResolveIncidents" defaultChecked={user.staffPermission?.canResolveIncidents ?? true} /> Incidencias</label>
                      <button className="button-ghost compact-button" type="submit">Permisos</button>
                    </form>
                  ) : user.role === 'STAFF' ? 'Staff' : 'No aplica'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
