export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { completeGoogleCalendarConnection } from '@/lib/google-calendar'

export async function GET(req: Request) {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3002'

  try {
    await requireRole(['ADMIN'])
    const { searchParams } = new URL(req.url)
    const error = searchParams.get('error')
    const code = searchParams.get('code')

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
