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

    if (!isGoogleOAuthStateValid(cookies().get(GOOGLE_OAUTH_STATE_COOKIE)?.value, state)) {
      return NextResponse.redirect(new URL('/admin/settings?google_error=invalid_oauth_state', baseUrl))
    }
    cookies().delete(GOOGLE_OAUTH_STATE_COOKIE)

    if (error) {
      return NextResponse.redirect(new URL(`/admin/settings?google_error=${encodeURIComponent(error)}`, baseUrl))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/admin/settings?google_error=no_code', baseUrl))
    }

    await completeGoogleCalendarConnection(code)
    return NextResponse.redirect(new URL('/admin/settings?google=connected', baseUrl))
  } catch (error: any) {
    return NextResponse.redirect(
      new URL(`/admin/settings?google_error=${encodeURIComponent(error.message || 'callback_failed')}`, baseUrl)
    )
  }
}
