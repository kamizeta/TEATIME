import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { getSession } from '@/lib/auth'
import { logoutAction } from '@/lib/actions/session'
import { getDefaultRouteForRole, getNavigationForRole } from '@/lib/navigation'
import { prisma } from '@/lib/prisma'
import './globals.css'

export const metadata: Metadata = {
  title: 'TEATIME Ops',
  description: 'Operación académica, asistencia y reservas',
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Admin',
  STAFF: 'Staff',
  TEACHER: 'Profesor',
  STUDENT: 'Alumno',
}

async function submitLogout() {
  'use server'
  await logoutAction()
  redirect('/login')
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const nav = session ? getNavigationForRole(session.role) : []
  const signedInProfile =
    session?.role === 'TEACHER' || session?.role === 'STUDENT'
      ? await prisma.user.findUnique({
          where: { id: session.userId },
          select: { name: true, email: true },
        })
      : null

  return (
    <html lang="es">
      <body>
        <div className="app-frame">
          <header className="topbar">
            <div className="brand-block">
              <Link href={session ? getDefaultRouteForRole(session.role) : '/login'} className="brand-mark">
                TEATIME Ops
              </Link>
              <span className="brand-subtitle">Academy Operations Console</span>
            </div>

            {session ? (
              <div className="topbar-actions">
                {signedInProfile ? (
                  <div className="signed-in-profile" aria-label="Usuario autenticado">
                    <strong>{signedInProfile.name}</strong>
                    <span>{signedInProfile.email}</span>
                  </div>
                ) : null}
                <span className="role-pill">{roleLabels[session.role] || session.role}</span>
                <form action={submitLogout}>
                  <button type="submit" className="button-ghost">
                    Cerrar sesión
                  </button>
                </form>
              </div>
            ) : null}
          </header>

          <div className={session ? 'shell-grid' : 'shell-grid shell-grid-full'}>
            {session ? (
              <AppSidebar nav={nav} role={session.role} />
            ) : null}

            <main className="content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
