import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById, dbLogActivity, dbGetUserActivity } from '@/lib/db'

// POST — Log frontend events (checkout click, etc.)
export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const user = await dbGetUserById(userId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { action, details } = await req.json()
  if (!action) return NextResponse.json({ error: 'action obrigatorio' }, { status: 400 })

  const allowed = ['checkout_click', 'page_view', 'upgrade_prompt']
  if (!allowed.includes(action)) return NextResponse.json({ error: 'action invalido' }, { status: 400 })

  await dbLogActivity(userId, action, details || {})
  return NextResponse.json({ ok: true })
}

// GET — Admin: get activity for a user
export async function GET(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret')
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const userIdParam = req.nextUrl.searchParams.get('userId')
  if (!userIdParam) return NextResponse.json({ error: 'userId obrigatorio' }, { status: 400 })

  const activity = await dbGetUserActivity(Number(userIdParam), 100)
  return NextResponse.json({ activity })
}
