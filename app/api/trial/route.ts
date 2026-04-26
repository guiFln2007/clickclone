import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbGetUserByEmail, dbActivateUser } from '@/lib/db'
import { sendTrialEmail } from '@/lib/mailer'

// Rate limit: max 3 trials per IP per hour
const ipAttempts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    ipAttempts.set(ip, { count: 1, resetAt: now + 3600000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

// Cleanup stale entries every 10 min
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of ipAttempts) {
    if (now > entry.resetAt) ipAttempts.delete(ip)
  }
}, 600000)

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'

    if (!checkRateLimit(ip)) {
      console.warn(`[trial] Rate limit hit: ${ip}`)
      return Response.json({ error: 'Muitas tentativas. Tente novamente em 1 hora.' }, { status: 429 })
    }

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
