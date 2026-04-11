import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import {
  dbAdminAddAnalises,
  dbAdminAddCreditos,
  dbAdminSetAtivo,
  dbAdminDeleteUser,
  dbGetUserById,
  dbSetHash,
} from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/mailer'
import { verifyAdminToken } from '@/lib/admin-jwt'

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  try { await verifyAdminToken(token); return true } catch { return false }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 })
  const { id: idStr } = await context.params
  const id = Number(idStr)
  const body = await req.json()

  if (body.addAnalises) await dbAdminAddAnalises(id, Number(body.addAnalises))
  if (body.addMineracoes) {
    const { default: db } = await import('@/lib/db')
    await db.execute({ sql: 'UPDATE users SET mineracoes = mineracoes + ? WHERE id = ?', args: [Number(body.addMineracoes), id] })
  }
  if (body.addCreditos) await dbAdminAddCreditos(id, Number(body.addCreditos))
  if (body.ativo !== undefined) await dbAdminSetAtivo(id, body.ativo ? 1 : 0)

  if (body.resetPassword) {
    const user = await dbGetUserById(id)
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    const tempPassword = Math.random().toString(36).slice(2, 10)
    const hash = await bcrypt.hash(tempPassword, 10)
    await dbSetHash(user.email, hash)
    await sendWelcomeEmail(user.email, user.name || '', tempPassword)
    const { hash: _h, ...safeUser } = (await dbGetUserById(id))!
    return NextResponse.json({ user: safeUser, tempPassword })
  }

  const user = await dbGetUserById(id)
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  const { hash: _h, ...safeUser } = user
  return NextResponse.json({ user: safeUser })
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 })
  const { id: idStr } = await context.params
  await dbAdminDeleteUser(Number(idStr))
  return NextResponse.json({ ok: true })
}
