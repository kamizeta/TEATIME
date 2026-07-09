import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()

  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      ok: true,
      service: 'teatime-ops',
      database: 'ok',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: 'teatime-ops',
        database: 'error',
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
