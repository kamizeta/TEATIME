'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { LEARNING_CONTENT_VERSION, getLearningGuideKeyForRole, learningGuides, type LearningGuideKey } from '@/lib/learning'
import { prisma } from '@/lib/prisma'

const GUIDE_STATE_LESSON = '__guide__'
const WELCOME_STATE_LESSON = '__welcome__'
const TOUR_STATE_LESSON = '__intro__'

function parseGuideKey(raw: string): LearningGuideKey | null {
  return raw === 'operacion' || raw === 'profesor' || raw === 'alumno' ? raw : null
}

async function sessionForGuide(guideKey: LearningGuideKey) {
  const session = await requireRole(['ADMIN', 'STAFF', 'TEACHER', 'STUDENT'])
  if (getLearningGuideKeyForRole(session.role) !== guideKey) throw new Error('UNAUTHORIZED')
  return session
}

export async function dismissLearningWelcomeAction() {
  const session = await requireRole(['ADMIN', 'STAFF', 'TEACHER', 'STUDENT'])
  const guideKey = getLearningGuideKeyForRole(session.role)
  await prisma.learningProgress.upsert({
    where: { userId_guideKey_lessonKey: { userId: session.userId, guideKey, lessonKey: WELCOME_STATE_LESSON } },
    update: { dismissedAt: new Date(), contentVersion: LEARNING_CONTENT_VERSION },
    create: { userId: session.userId, guideKey, lessonKey: WELCOME_STATE_LESSON, contentVersion: LEARNING_CONTENT_VERSION, dismissedAt: new Date() },
  })
  revalidatePath('/', 'layout')
}

export async function completeLearningLessonAction(formData: FormData) {
  const guideKey = parseGuideKey(String(formData.get('guideKey') || ''))
  const lessonKey = String(formData.get('lessonKey') || '')
  if (!guideKey || !lessonKey || !learningGuides[guideKey].lessons.some((lesson) => lesson.key === lessonKey)) {
    throw new Error('INVALID_LEARNING_LESSON')
  }

  const session = await sessionForGuide(guideKey)
  await prisma.learningProgress.upsert({
    where: { userId_guideKey_lessonKey: { userId: session.userId, guideKey, lessonKey } },
    update: { completedAt: new Date(), dismissedAt: null, contentVersion: LEARNING_CONTENT_VERSION },
    create: { userId: session.userId, guideKey, lessonKey, contentVersion: LEARNING_CONTENT_VERSION, completedAt: new Date() },
  })

  const completedCount = await prisma.learningProgress.count({
    where: { userId: session.userId, guideKey, lessonKey: { notIn: [GUIDE_STATE_LESSON, WELCOME_STATE_LESSON, TOUR_STATE_LESSON] }, completedAt: { not: null } },
  })
  if (completedCount >= learningGuides[guideKey].lessons.length) {
    await prisma.learningProgress.upsert({
      where: { userId_guideKey_lessonKey: { userId: session.userId, guideKey, lessonKey: GUIDE_STATE_LESSON } },
      update: { completedAt: new Date(), contentVersion: LEARNING_CONTENT_VERSION },
      create: { userId: session.userId, guideKey, lessonKey: GUIDE_STATE_LESSON, contentVersion: LEARNING_CONTENT_VERSION, completedAt: new Date() },
    })
  }

  revalidatePath(`/ayuda/${guideKey}`)
  redirect(`/ayuda/${guideKey}?leccion=lista`)
}

export async function resetLearningGuideAction(formData: FormData) {
  const guideKey = parseGuideKey(String(formData.get('guideKey') || ''))
  if (!guideKey) throw new Error('INVALID_LEARNING_GUIDE')
  const session = await sessionForGuide(guideKey)
  await prisma.learningProgress.deleteMany({ where: { userId: session.userId, guideKey } })
  revalidatePath('/', 'layout')
  revalidatePath(`/ayuda/${guideKey}`)
  redirect(`/ayuda/${guideKey}?reiniciada=1`)
}

export async function completeLearningTourAction(guideKey: LearningGuideKey) {
  const session = await sessionForGuide(guideKey)
  await prisma.learningProgress.upsert({
    where: { userId_guideKey_lessonKey: { userId: session.userId, guideKey, lessonKey: TOUR_STATE_LESSON } },
    update: { completedAt: new Date(), contentVersion: LEARNING_CONTENT_VERSION },
    create: { userId: session.userId, guideKey, lessonKey: TOUR_STATE_LESSON, contentVersion: LEARNING_CONTENT_VERSION, completedAt: new Date() },
  })
  revalidatePath(`/ayuda/${guideKey}`)
}
