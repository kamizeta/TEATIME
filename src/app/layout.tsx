import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { getSession } from '@/lib/auth'
import { logoutAction } from '@/lib/actions/session'
import { getDefaultRouteForRole, getNavigationForRole } from '@/lib/navigation'
import './globals.css'

export const metadata: Metadata = {
  title: 'TEATIME Ops',
  description: 'Operación académica, asistencia y reservas',
}

async function submitLogout() {
  'use server'
  await logoutAction()
  redirect('/login')
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const nav = session ? getNavigationForRole(session.role) : []

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
                <span className="role-pill">{session.role}</span>
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
