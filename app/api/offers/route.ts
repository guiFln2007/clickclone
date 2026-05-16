import { NextRequest, NextResponse } from 'next/server'
import { dbGetMinedOffers } from '@/lib/db'

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('search') || ''
  const nicho = req.nextUrl.searchParams.get('nicho') || ''
  const sortBy = (req.nextUrl.searchParams.get('sort') || 'ad_count') as 'ad_count' | 'dias_rodando' | 'last_seen'
  const limit = Number(req.nextUrl.searchParams.get('limit')) || 48
  const offset = Number(req.nextUrl.searchParams.get('offset')) || 0

  try {
    const result = await dbGetMinedOffers({ search, nicho: nicho || undefined, limit, offset, sortBy })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
