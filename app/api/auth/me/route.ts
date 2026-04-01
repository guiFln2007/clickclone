import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { dbGetUserById } from '@/lib/db'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ratoads-secret-change-in-prod'
)

export async function GET(req: NextRequest) {
  // Try x-user-id header first (injected by middleware when route is protected)
  // then fall back to reading the cookie directly (when middleware doesn't run)
  let userId: number | null = null

  const headerUserId = req.headers.get('x-user-id')
  if (headerUserId) {
    userId = Number(headerUserId)
  } else {
    const token = req.cookies.get('cc_token')?.value
    if (token) {
      try {
        const { payload } = await jwtVerify(token, SECRET)
        userId = Number(payload.sub)
      } catch { /* invalid token */ }
    }
  }

  if (!userId) return NextResponse.json({ user: null })

  const user = await dbGetUserById(userId)
  if (!user) return NextResponse.json({ user: null })

  // Calcula data de expiração (renovação mensal a partir do created_at)
  let data_expiracao = ''
  try {
    const d = new Date(user.created_at)
    const next = new Date(d)
    next.setMonth(next.getMonth() + 1)
    data_expiracao = next.toISOString()
  } catch { /* ignore */ }

  return NextResponse.json({
    user: {
      id: user.id,
      nome: user.name,
      email: user.email,
      plano: user.plano,
      analises: user.analises,
      creditos: user.creditos,
      created_at: user.created_at,
      data_expiracao,
    }
  })
}
