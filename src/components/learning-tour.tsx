'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { AppRole } from '@/lib/navigation'
import { completeLearningTourAction } from '@/lib/actions/learning'
import { getLearningGuideKeyForRole } from '@/lib/learning'

type TourStep = { target: string; title: string; description: string }
type Rect = { top: number; left: number; width: number; height: number }

function stepsForRole(role: AppRole): TourStep[] {
  const roleLabel = role === 'TEACHER' ? 'profesor' : role === 'STUDENT' ? 'alumno' : 'operación'
  return [
    { target: '[data-tour="topbar-help"]', title: 'Tu guía siempre está disponible', description: 'Abre Ayuda y aprendizaje cuando necesites repetir un flujo, revisar una regla o retomar tu progreso.' },
    { target: '[data-tour="sidebar"]', title: 'Navega según tu rol', description: `Este menú muestra únicamente las áreas disponibles para tu perfil de ${roleLabel}.` },
    { target: '[data-tour="page-content"]', title: 'Trabaja desde esta pantalla', description: 'Aquí verás la información y acciones del flujo actual. La guía te enlaza directamente a cada paso crítico.' },
  ]
}

export function LearningTour({ role }: { role: AppRole }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const active = searchParams.get('tour') === 'intro'
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [, startTransition] = useTransition()
  const steps = stepsForRole(role)

  function closeTour(completed = false) {
    if (completed) startTransition(() => { void completeLearningTourAction(getLearningGuideKeyForRole(role)) })
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tour')
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname)
  }

  useEffect(() => {
    if (!active) return
    setStepIndex(0)
  }, [active, pathname])

  useEffect(() => {
    if (!active) return
    const update = () => {
      const target = document.querySelector(steps[stepIndex]?.target)
      if (!target) {
        if (stepIndex < steps.length - 1) setStepIndex((current) => current + 1)
        else closeTour(false)
        return
      }
      const box = target.getBoundingClientRect()
      setRect({ top: Math.max(8, box.top - 8), left: Math.max(8, box.left - 8), width: box.width + 16, height: box.height + 16 })
      panelRef.current?.focus()
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTour(false)
      if (event.key === 'ArrowRight') setStepIndex((current) => Math.min(current + 1, steps.length - 1))
      if (event.key === 'ArrowLeft') setStepIndex((current) => Math.max(current - 1, 0))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [active, stepIndex, steps.length])

  if (!active || !rect) return null
  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  return (
    <div className="learning-tour-layer" aria-live="polite">
      <div className="learning-tour-spotlight" style={rect} aria-hidden="true" />
      <div className="learning-tour-card" role="dialog" aria-modal="true" aria-label={`Recorrido: ${step.title}`} tabIndex={-1} ref={panelRef}>
        <p className="eyebrow">RECORRIDO {stepIndex + 1} DE {steps.length}</p>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        <div className="learning-tour-actions">
          <button type="button" className="button-text" onClick={() => closeTour(false)}>Cerrar</button>
          <span className="learning-tour-spacer" />
          <button type="button" className="button-ghost" onClick={() => setStepIndex((current) => Math.max(current - 1, 0))} disabled={stepIndex === 0}>Atrás</button>
          <button type="button" className="button-primary" onClick={() => (isLast ? closeTour(true) : setStepIndex((current) => current + 1))}>{isLast ? 'Finalizar' : 'Siguiente'}</button>
        </div>
      </div>
    </div>
  )
}
