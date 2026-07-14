export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireRole } from '@/lib/auth'
import { completeGoogleCalendarConnection, GOOGLE_OAUTH_STATE_COOKIE, isGoogleOAuthStateValid } from '@/lib/google-calendar'

export async function GET(req: Request) {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3002'

  try {
    await requireRole(['ADMIN'])
    const { searchParams } = new URL(req.url)
    const error = searchParams.get('error')
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const cookieStore = await cookies()

    if (!isGoogleOAuthStateValid(cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value, state)) {
      return NextResponse.redirect(new URL('/admin/settings?google_error=invalid_oauth_state', baseUrl))
    }
    cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE)

    if (error) {
      return NextResponse.redirect(new URL('/admin/settings?google_error=authorization_denied', baseUrl))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/admin/settings?google_error=no_code', baseUrl))
    }

    await completeGoogleCalendarConnection(code)
    return NextResponse.redirect(new URL('/admin/settings?google=connected', baseUrl))
  } catch {
    return NextResponse.redirect(new URL('/admin/settings?google_error=callback_failed', baseUrl))
  }
}
