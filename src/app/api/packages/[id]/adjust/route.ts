export const dynamic = "force-dynamic"

import { NextResponse } from 'next/server'
import { requireAdminOrStaffPermission } from '@/lib/staff-permissions'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminOrStaffPermission('canCloseWeeks')
    await params
    return NextResponse.json(
      { ok: false, error: 'Este endpoint no permite alterar saldos. Usa el ajuste auditado de paquetes.' },
      { status: 410 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: message === 'UNAUTHORIZED' ? 401 : 403 })
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminOrStaffPermission('canCloseWeeks')
    const { id } = await params
    const pack = await prisma.hourPackage.findUnique({ where: { id } })
    if (!pack) return NextResponse.json({ ok: false, error: 'No encontrado.' }, { status: 404 })
    return NextResponse.json({ ok: true, package: pack })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: message === 'UNAUTHORIZED' ? 401 : 403 })
  }
}
