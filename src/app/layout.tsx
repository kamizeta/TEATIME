import type { Metadata } from 'next'
import Link from 'next/link'
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
              <aside className="sidebar">
                <nav className="sidebar-nav">
                  {nav.map((item) => (
                    <Link key={item.href} href={item.href} className="sidebar-link">
                      <span>{item.label}</span>
                      <small>{item.description}</small>
                    </Link>
                  ))}
                </nav>
              </aside>
            ) : null}

            <main className="content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
