export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildGoogleCalendarConnectUrl, isGoogleCalendarConfiguredInEnv } from '@/lib/google-calendar'

export async function GET() {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3002'

  try {
    await requireRole(['ADMIN'])
    if (!isGoogleCalendarConfiguredInEnv()) {
      return NextResponse.redirect(new URL('/admin/settings?google=missing_env', baseUrl))
    }

    return NextResponse.redirect(buildGoogleCalendarConnectUrl())
  } catch {
    return NextResponse.redirect(new URL('/login', baseUrl))
  }
}
