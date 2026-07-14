export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { completeLearningLessonAction, resetLearningGuideAction } from '@/lib/actions/learning'
import { requireRole } from '@/lib/auth'
import { getDefaultRouteForRole } from '@/lib/navigation'
import { getLearningGuideKeyForRole, getLearningGuidePath, learningGuides, type LearningGuideKey } from '@/lib/learning'
import { prisma } from '@/lib/prisma'
import { PrintGuideButton } from '@/components/print-guide-button'

function parseGuideKey(raw: string): LearningGuideKey | null {
  return raw === 'operacion' || raw === 'profesor' || raw === 'alumno' ? raw : null
}

export default async function LearningGuidePage({ params, searchParams }: { params: Promise<{ guide: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { guide: rawGuide } = await params
  const guideKey = parseGuideKey(rawGuide)
  if (!guideKey) notFound()

  const session = await requireRole(['ADMIN', 'STAFF', 'TEACHER', 'STUDENT'])
  if (getLearningGuideKeyForRole(session.role) !== guideKey) redirect(getDefaultRouteForRole(session.role))

  const guide = learningGuides[guideKey]
  const progress = await prisma.learningProgress.findMany({ where: { userId: session.userId, guideKey } })
  const completed = new Set(progress.filter((item) => item.completedAt).map((item) => item.lessonKey))
  const completedLessons = guide.lessons.filter((lesson) => completed.has(lesson.key)).length
  const percentage = Math.round((completedLessons / guide.lessons.length) * 100)
  const query = searchParams ? await searchParams : {}

  return (
    <div className="page-stack learning-guide" data-tour="page-content">
      <section className="hero learning-guide-hero">
        <div>
          <p className="eyebrow">{guide.eyebrow}</p>
          <h1 className="page-title">{guide.title}</h1>
          <p className="page-lead">{guide.description}</p>
        </div>
        <div className="learning-guide-actions">
          <Link href={`${getDefaultRouteForRole(session.role)}?tour=intro`} className="button-primary">Iniciar recorrido</Link>
          <PrintGuideButton />
        </div>
      </section>

      {query?.reiniciada === '1' ? <p className="status-success">La guía se reinició. Puedes completar los módulos de nuevo.</p> : null}
      {query?.leccion === 'lista' ? <p className="status-success">Módulo marcado como completado.</p> : null}

      <section className="learning-progress-card">
        <div>
          <p className="eyebrow">TU PROGRESO</p>
          <h2>{completedLessons} de {guide.lessons.length} módulos completados</h2>
          <p>{percentage === 100 ? 'Guía completada. Puedes reiniciar el aprendizaje cuando quieras.' : 'Completa cada módulo a medida que practicas en la plataforma.'}</p>
        </div>
        <div className="learning-progress-meter" aria-label={`${percentage}% completado`}>
          <span style={{ width: `${percentage}%` }} />
          <strong>{percentage}%</strong>
        </div>
        <form action={resetLearningGuideAction}>
          <input type="hidden" name="guideKey" value={guideKey} />
          <button type="submit" className="button-text">Reiniciar guía</button>
        </form>
      </section>

      <section className="panel learning-first-steps">
        <p className="eyebrow">QUÉ HACER PRIMERO</p>
        <h2>Tu primer día con TEATIME Ops</h2>
        <ol>
          {guide.firstSteps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <section className="learning-lesson-list" aria-label="Módulos de aprendizaje">
        {guide.lessons.map((lesson, index) => {
          const isDone = completed.has(lesson.key)
          return (
            <article key={lesson.key} className={isDone ? 'learning-lesson learning-lesson-complete' : 'learning-lesson'}>
              <div className="learning-lesson-number">{isDone ? '✓' : index + 1}</div>
              <div className="learning-lesson-content">
                <h2>{lesson.title}</h2>
                <p>{lesson.summary}</p>
                <ol>
                  {lesson.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </div>
              <div className="learning-lesson-actions">
                <Link href={lesson.href} className="button-ghost">Abrir pantalla</Link>
                {isDone ? <span className="status-pill">Completado</span> : (
                  <form action={completeLearningLessonAction}>
                    <input type="hidden" name="guideKey" value={guideKey} />
                    <input type="hidden" name="lessonKey" value={lesson.key} />
                    <button type="submit" className="button-primary">Marcar completado</button>
                  </form>
                )}
              </div>
            </article>
          )
        })}
      </section>

      <section className="panel learning-faq">
        <p className="eyebrow">PREGUNTAS FRECUENTES</p>
        <h2>Reglas importantes</h2>
        {guide.faqs.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </section>

      <section className="learning-guide-footer panel">
        <div>
          <p className="eyebrow">APRENDIZAJE CONTINUO</p>
          <h2>¿Necesitas volver a revisar un flujo?</h2>
          <p>Esta guía queda disponible desde Ayuda y aprendizaje en cualquier momento.</p>
        </div>
        <Link href={getLearningGuidePath(guideKey)} className="button-ghost">Volver al inicio de la guía</Link>
      </section>
    </div>
  )
}
