import { NextRequest, NextResponse } from 'next/server'
import { dbGetMinedOfferByPageId } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const offer = await dbGetMinedOfferByPageId(id)
  if (!offer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(offer)
}
