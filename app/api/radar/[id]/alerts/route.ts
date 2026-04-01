import { NextRequest, NextResponse } from 'next/server'
import { dbGetOfferAlerts } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const alerts = await dbGetOfferAlerts(id)
  return NextResponse.json({ alerts })
}
