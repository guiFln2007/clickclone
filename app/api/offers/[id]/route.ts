import { NextRequest, NextResponse } from 'next/server'
import { dbGetMinedOfferByPageId, dbUpdateMinedOfferStatus } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const offer = await dbGetMinedOfferByPageId(id)
  if (!offer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(offer)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  if (body.status === 'descartada') {
    await dbUpdateMinedOfferStatus(id, 'descartada')
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
}
