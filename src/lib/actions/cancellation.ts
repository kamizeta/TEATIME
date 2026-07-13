'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { requestCancellation } from '@/lib/cancellations'

function withQuery(path: string, entries: Record<string, string>) {
  const [pathname, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  for (const [key, value] of Object.entries(entries)) params.set(key, value)
  return `${pathname}?${params.toString()}`
}

export async function submitCancellationAction(formData: FormData) {
  const session = await requireRole(['ADMIN', 'STAFF', 'TEACHER', 'STUDENT'])
  const classId = String(formData.get('classId') || '')
  const scope = String(formData.get('scope') || 'CLASS') as 'SELF' | 'CLASS'
  const reason = String(formData.get('reason') || '').trim()
  const redirectPath = String(formData.get('redirectPath') || '/')

  if (!classId) throw new Error('MISSING_CLASS_ID')
  if (!reason) throw new Error('MISSING_REASON')

  const result = await requestCancellation({
    classId,
    userId: session.userId,
    role: session.role,
    reason,
    scope,
  })

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/calendar')
  revalidatePath('/admin/packages')
  revalidatePath('/student/home')
  revalidatePath('/teacher/today')
  revalidatePath(`/admin/classes/${classId}`)

  if (!result.ok) {
    redirect(
      withQuery(redirectPath, {
        cancel: 'denied',
        hours: String(result.minimumNoticeHours),
      })
    )
  }

  redirect(
    withQuery(redirectPath, {
      cancel: result.alreadyCanceled ? 'already' : 'ok',
      scope,
      override: result.overrideUsed ? '1' : '0',
    })
  )
}
