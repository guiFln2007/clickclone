import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { dbGetMinedOffers, dbGetUserById } from '@/lib/db'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ratoads-secret-change-in-prod'
)

export async function GET(req: NextRequest) {
  // Auth — identify user to check swipe expiry
  let userId: number | null = null
  const token = req.cookies.get('cc_token')?.value
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET)
      userId = Number(payload.sub)
    } catch { /* invalid */ }
  }

  // Block swipe for curso users past 72h
  if (userId) {
    const user = await dbGetUserById(userId)
    if (user && user.plano === 'curso' && user.swipe_expires_at) {
      if (new Date(user.swipe_expires_at) < new Date()) {
        return NextResponse.json({ error: 'swipe_expired', message: 'Seu acesso ao feed de ofertas expirou.' }, { status: 403 })
      }
    }
  }

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
