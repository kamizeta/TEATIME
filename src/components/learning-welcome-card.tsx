import Link from 'next/link'
import { dismissLearningWelcomeAction } from '@/lib/actions/learning'

type Props = {
  guideHref: string
  tourHref: string
  guideTitle: string
}

export function LearningWelcomeCard({ guideHref, tourHref, guideTitle }: Props) {
  return (
    <section className="learning-welcome" aria-label="Introducción al aprendizaje">
      <div>
        <p className="eyebrow">APRENDIZAJE</p>
        <h2>Conoce TEATIME Ops a tu ritmo</h2>
        <p>Tu guía de {guideTitle} explica los flujos que más vas a usar y se guarda a medida que avanzas.</p>
      </div>
      <div className="learning-welcome-actions">
        <Link href={tourHref} className="button-primary">Conocer la plataforma</Link>
        <Link href={guideHref} className="button-ghost">Ver mi guía</Link>
        <form action={dismissLearningWelcomeAction}>
          <button type="submit" className="button-text">Ahora no</button>
        </form>
      </div>
    </section>
  )
}
