export const dynamic = 'force-dynamic'

import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'
import { createUserAction } from '@/lib/actions'
import { UserDirectoryRow } from '@/components/user-directory-row'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { roleLabels } from '@/lib/display-labels'

function getMessage(code: string) {
  const messages: Record<string, string> = {
    MISSING_USER_FIELDS: 'Faltan nombre o email.',
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
          El administrador crea profesores, equipo operativo y alumnos. El equipo operativo puede revisar, pero solo el administrador cambia permisos.
        </p>
      </section>

      {result === 'created' ? <p className="status-success">Usuario creado.</p> : null}
      {result === 'updated' ? <p className="status-success">Usuario actualizado.</p> : null}
      {result === 'permissions' ? <p className="status-success">Permisos actualizados.</p> : null}
      {result === 'error' ? <p className="status-warning">{getMessage(code)}</p> : null}
      {!canEdit ? <p className="status-warning">Entraste como equipo operativo. Puedes revisar usuarios, pero no editarlos.</p> : null}

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
              <label htmlFor="email">Correo electrónico</label>
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
              <label htmlFor="accessMode">Acceso inicial</label>
              <select id="accessMode" name="accessMode" className="select" defaultValue="INVITATION">
                <option value="INVITATION">Enviar invitación por correo (72 h)</option>
                <option value="NO_PORTAL">Crear sin acceso al portal</option>
                <option value="TEST_GLOBAL">Acceso de pruebas: clave global</option>
              </select>
              <p className="hint">La clave global de pruebas solo aplica a alumnos y profesores: `teatime123`.</p>
            </div>
            <button type="submit" className="button-primary ops-span-2">Crear usuario</button>
          </form>
        </section>
      ) : null}

      <section className="panel table-panel users-table-panel">
        <div className="card-header">
          <p className="eyebrow">Directorio</p>
          <h2>Usuarios actuales</h2>
        </div>
        <table className="user-directory-table">
          <thead>
            <tr>
              <th>Nombre y apellido</th>
              <th>Rol</th>
              <th>Correo electrónico</th>
              <th>WhatsApp</th>
              <th>Estado</th>
              <th>Permisos del equipo</th>
              <th className="user-directory-action">Acción</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => canEdit ? (
              <UserDirectoryRow
                key={user.id}
                roleLabel={roleLabels[user.role]}
                user={{
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  phoneE164: user.phoneE164,
                  isActive: user.isActive,
                  role: user.role,
                  studentCode: user.studentProfile?.studentCode,
                  staffPermission: user.staffPermission,
                }}
              />
            ) : (
              <tr key={user.id}>
                <td><strong>{user.name}</strong><small className="block-muted">{user.studentProfile?.studentCode || ''}</small></td>
                <td>{roleLabels[user.role]}</td>
                <td>{user.email}</td>
                <td>{user.phoneE164 || 'sin teléfono'}</td>
                <td>{user.isActive ? 'Activo' : 'Inactivo'}</td>
                <td>{user.role === 'STAFF' ? 'Equipo operativo' : 'No aplica'}</td>
                <td className="user-directory-action">Solo lectura</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
