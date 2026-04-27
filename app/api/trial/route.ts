import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbGetUserByEmail, dbActivateUser, dbCheckTrialIp, dbSetTrialIp } from '@/lib/db'
import { sendTrialEmail, sendBustedEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'

    // Block if IP already has a trial
    if (ip !== 'unknown' && await dbCheckTrialIp(ip)) {
      console.warn(`[trial] IP bloqueado (já tem trial): ${ip}`)
      // Try to get the email to send the cheeky message
      const { email: attemptEmail } = await req.clone().json().catch(() => ({ email: '' }))
      if (attemptEmail && typeof attemptEmail === 'string' && attemptEmail.includes('@')) {
        sendBustedEmail(attemptEmail.toLowerCase().trim()).catch(console.error)
      }
      return Response.json({ error: 'Já existe um teste gratuito neste dispositivo. Faça login na sua conta.' }, { status: 409 })
    }

    const { email } = await req.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return Response.json({ error: 'Email inválido' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const existing = await dbGetUserByEmail(normalizedEmail)
    if (existing) {
      if (existing.ativo) {
        return Response.json({ error: 'Esse email já tem uma conta ativa. Faça login.' }, { status: 409 })
      }
    }

    const tempPassword = Math.random().toString(36).slice(2, 10)
    const hash = await bcrypt.hash(tempPassword, 10)

    await dbActivateUser('trial', normalizedEmail, '', hash, 'trial')
    await dbSetTrialIp(normalizedEmail, ip)

    sendTrialEmail(normalizedEmail, tempPassword).catch(console.error)

    console.log(`[trial] Novo trial criado: ${normalizedEmail} (ip: ${ip})`)
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[trial]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
