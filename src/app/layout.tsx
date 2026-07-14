import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/app-sidebar'
import { LearningTour } from '@/components/learning-tour'
import { LearningWelcomeCard } from '@/components/learning-welcome-card'
import { getSession } from '@/lib/auth'
import { logoutAction } from '@/lib/actions/session'
import { getDefaultRouteForRole, getNavigationForRole } from '@/lib/navigation'
import { getLearningGuideKeyForRole, getLearningGuidePath, learningGuides } from '@/lib/learning'
import { prisma } from '@/lib/prisma'
import { roleLabels } from '@/lib/display-labels'
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
  const learningGuideKey = session ? getLearningGuideKeyForRole(session.role) : null
  const learningProgress = session && learningGuideKey
    ? await prisma.learningProgress.findUnique({
        where: { userId_guideKey_lessonKey: { userId: session.userId, guideKey: learningGuideKey, lessonKey: '__welcome__' } },
      })
    : null
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
              <span className="brand-subtitle">Consola de operación académica</span>
            </div>

            {session ? (
              <div className="topbar-actions">
                {signedInProfile ? (
                  <div className="signed-in-profile" aria-label="Usuario autenticado">
                    <strong>{signedInProfile.name}</strong>
                    <span>{signedInProfile.email}</span>
                  </div>
                ) : null}
                <Link href={getLearningGuidePath(learningGuideKey!)} className="button-ghost button-help" data-tour="topbar-help">
                  ? Ayuda y aprendizaje
                </Link>
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

            <main className="content" data-tour="page-content">
              {session && learningGuideKey && !learningProgress?.dismissedAt && !learningProgress?.completedAt ? (
                <LearningWelcomeCard
                  guideHref={getLearningGuidePath(learningGuideKey)}
                  tourHref={`${getDefaultRouteForRole(session.role)}?tour=intro`}
                  guideTitle={learningGuides[learningGuideKey].audience}
                />
              ) : null}
              {children}
            </main>
          </div>
        </div>
        {session ? <LearningTour role={session.role} /> : null}
      </body>
    </html>
  )
}
