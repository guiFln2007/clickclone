import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbGetUserByEmail, dbActivateUser, dbSetSwipeExpiry } from '@/lib/db'
import { sendCursoTrialEmail } from '@/lib/mailer'

const CURSO_CODE = process.env.CURSO_TRIAL_CODE || 'AUTOLOW'

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json()

    if (!code || code.toUpperCase() !== CURSO_CODE.toUpperCase()) {
      return Response.json({ error: 'Codigo de ativacao invalido.' }, { status: 403 })
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return Response.json({ error: 'Email invalido.' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const existing = await dbGetUserByEmail(normalizedEmail)
    if (existing) {
      if (existing.ativo && existing.plano !== 'trial') {
        return Response.json({ error: 'Esse email ja tem uma conta ativa com plano superior.' }, { status: 409 })
      }
    }

    const tempPassword = Math.random().toString(36).slice(2, 10)
    const hash = await bcrypt.hash(tempPassword, 10)

    const user = await dbActivateUser('curso', normalizedEmail, '', hash, 'curso')

    // Swipe de ofertas expira em 72h
    const swipeExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    await dbSetSwipeExpiry(user.id, swipeExpiry)

    sendCursoTrialEmail(normalizedEmail, tempPassword).catch(console.error)

    console.log(`[trial/curso] Novo trial curso criado: ${normalizedEmail}`)
    return Response.json({ ok: true, message: 'Conta criada! Verifique seu email.' })
  } catch (err) {
    console.error('[trial/curso]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
