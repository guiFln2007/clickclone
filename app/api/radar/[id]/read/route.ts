import { NextRequest, NextResponse } from 'next/server'
import { dbMarkAlertsRead } from '@/lib/db'

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await dbMarkAlertsRead(id)
  return NextResponse.json({ ok: true })
}
