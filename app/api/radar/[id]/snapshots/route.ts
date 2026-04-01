import { NextRequest, NextResponse } from 'next/server'
import { dbGetSnapshots } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const snapshots = await dbGetSnapshots(id)
  return NextResponse.json({ snapshots })
}
