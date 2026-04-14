import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbAdminGetUsers, dbAdminCountUsers, dbCreateUser, dbGetUserById } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/mailer'
import { verifyAdminToken } from '@/lib/admin-jwt'

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('cc_admin')?.value
  if (!token) return false
  try { await verifyAdminToken(token); return true } catch { return false }
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 })
  const { searchParams } = req.nextUrl
  const search = searchParams.get('search') || ''
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const limit = Number(searchParams.get('limit') || 20)
  const offset = (page - 1) * limit

  const [users, total] = await Promise.all([
    dbAdminGetUsers(search, offset, limit),
    dbAdminCountUsers(search),
  ])

  // Remove hash before sending to client
  const safeUsers = users.map(({ hash: _h, ...u }) => u)
  return NextResponse.json({ users: safeUsers, total, page, limit })
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 })
  const { email, name, plano } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email obrigat\u00f3rio' }, { status: 400 })

  const tempPassword = Math.random().toString(36).slice(2, 10)
  const hash = await bcrypt.hash(tempPassword, 10)

  const { dbActivateUser } = await import('@/lib/db')
  const user = await dbActivateUser('admin-created', email, name || '', hash, plano || 'starter')

  sendWelcomeEmail(email, name || '', tempPassword).catch(console.error)

  const { hash: _h, ...safeUser } = user!
  return NextResponse.json({ user: safeUser, tempPassword })
}
