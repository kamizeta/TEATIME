export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { logoutAction } from '@/lib/actions/session'

export async function POST() {
  await logoutAction()
  return NextResponse.json({ ok: true })
}
