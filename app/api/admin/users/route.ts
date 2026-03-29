import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbAdminGetUsers, dbAdminCountUsers, dbCreateUser, dbGetUserById } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/mailer'

export async function GET(req: NextRequest) {
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
  const { email, name, analises, creditos } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email obrigatório' }, { status: 400 })

  const tempPassword = Math.random().toString(36).slice(2, 10)
  const hash = await bcrypt.hash(tempPassword, 10)

  const user = await dbCreateUser({ email, name, hash })

  // Override defaults if provided
  if (analises !== undefined || creditos !== undefined) {
    const { default: db } = await import('@/lib/db')
    await db.execute({
      sql: 'UPDATE users SET analises = ?, creditos = ? WHERE id = ?',
      args: [analises ?? 10, creditos ?? 100, user.id],
    })
  }

  const final = await dbGetUserById(user.id)
  await sendWelcomeEmail(email, name || '', tempPassword)

  const { hash: _h, ...safeUser } = final!
  return NextResponse.json({ user: safeUser, tempPassword })
}
