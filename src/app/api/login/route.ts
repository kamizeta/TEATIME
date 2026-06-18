import { NextResponse } from 'next/server'
import { loginAction } from '@/lib/actions/session'

export async function POST(req: Request) {
  const form = await req.formData()
  const result = await loginAction(form)
  return NextResponse.json(result)
}
