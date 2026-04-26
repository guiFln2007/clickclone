import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbGetUserByEmail, dbActivateUser } from '@/lib/db'
import { sendTrialEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return Response.json({ error: 'Email inválido' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user already exists
    const existing = await dbGetUserByEmail(normalizedEmail)
    if (existing) {
      if (existing.ativo) {
        return Response.json({ error: 'Esse email já tem uma conta ativa. Faça login.' }, { status: 409 })
      }
      // Reactivate as trial
    }

    const tempPassword = Math.random().toString(36).slice(2, 10)
    const hash = await bcrypt.hash(tempPassword, 10)

    await dbActivateUser('trial', normalizedEmail, '', hash, 'trial')

    sendTrialEmail(normalizedEmail, tempPassword).catch(console.error)

    console.log(`[trial] Novo trial criado: ${normalizedEmail}`)
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[trial]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
