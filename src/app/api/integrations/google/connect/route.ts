export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireRole } from '@/lib/auth'
import { buildGoogleCalendarConnectUrl, createGoogleOAuthState, GOOGLE_OAUTH_STATE_COOKIE, isGoogleCalendarConfiguredInEnv } from '@/lib/google-calendar'

export async function GET() {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3002'

  try {
    await requireRole(['ADMIN'])
    if (!isGoogleCalendarConfiguredInEnv()) {
      return NextResponse.redirect(new URL('/admin/settings?google=missing_env', baseUrl))
    }

    const state = createGoogleOAuthState()
    cookies().set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
    })
    return NextResponse.redirect(buildGoogleCalendarConnectUrl(state))
  } catch {
    return NextResponse.redirect(new URL('/login', baseUrl))
  }
}
