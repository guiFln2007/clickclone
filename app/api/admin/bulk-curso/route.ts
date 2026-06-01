import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { verifyAdminToken } from '@/lib/admin-jwt'
import { dbGetUserByEmail, dbActivateUser, dbSetSwipeExpiry } from '@/lib/db'
import { sendCursoTrialEmail } from '@/lib/mailer'

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('cc_admin')?.value
  if (!token) return false
  try { await verifyAdminToken(token); return true } catch { return false }
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const { emails } = await req.json()
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'Envie um array de emails' }, { status: 400 })
  }

  const results: { email: string; status: string }[] = []
  const swipeExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  for (const raw of emails) {
    const email = String(raw).toLowerCase().trim()
    if (!email.includes('@')) {
      results.push({ email, status: 'email_invalido' })
      continue
    }

    try {
      const existing = await dbGetUserByEmail(email)
      if (existing && existing.ativo && !['trial', 'curso', 'inativo'].includes(existing.plano)) {
        results.push({ email, status: 'plano_superior_ativo' })
        continue
      }

      const tempPassword = Math.random().toString(36).slice(2, 10)
      const hash = await bcrypt.hash(tempPassword, 10)

      const user = await dbActivateUser('curso', email, '', hash, 'curso')
      await dbSetSwipeExpiry(user.id, swipeExpiry)

      sendCursoTrialEmail(email, tempPassword).catch(console.error)

      results.push({ email, status: 'criado' })
    } catch (err) {
      results.push({ email, status: 'erro: ' + (err instanceof Error ? err.message : 'desconhecido') })
    }
  }

  const criados = results.filter(r => r.status === 'criado').length
  console.log(`[bulk-curso] ${criados}/${emails.length} trials criados`)

  return NextResponse.json({ total: emails.length, criados, results })
}
