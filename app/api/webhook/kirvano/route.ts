import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbActivateUser, dbRenewUser, dbDeactivateUser, dbAddCreditos } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/mailer'

function extractCustomer(body: Record<string, unknown>) {
  const customer = (body.customer || body.buyer || {}) as Record<string, unknown>
  const email = ((customer.email || body.email || '') as string).toLowerCase().trim()
  const name = (customer.name || customer.full_name || body.name || '') as string
  const kirvano_id = String(body.id || body.order_id || body.transaction_id || '')
  return { email, name, kirvano_id }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Valida secret header (configurado no painel Kirvano)
    const secret = req.headers.get('x-kirvano-secret')
    if (process.env.KIRVANO_SECRET && secret !== process.env.KIRVANO_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const event = (body.event || body.type || '') as string
    const normalizedEvent = event.toUpperCase().replace('.', '_')

    // ── COMPRA APROVADA ───────────────────────────────────────────────────────
    if (normalizedEvent === 'PURCHASE_APPROVED') {
      const { email, name, kirvano_id } = extractCustomer(body)
      if (!email) return Response.json({ error: 'Email ausente no payload' }, { status: 400 })

      // Gera senha temporária, salva hasheada
      const tempPassword = Math.random().toString(36).slice(2, 10)
      const hash = await bcrypt.hash(tempPassword, 10)

      const user = await dbActivateUser(kirvano_id, email, name, hash)

      sendWelcomeEmail(email, name, tempPassword).catch(console.error)
      console.log(`[kirvano] PURCHASE_APPROVED: ${email} (id=${user?.id})`)
      return Response.json({ ok: true, user_id: user?.id })
    }

    // ── RENOVAÇÃO DE ASSINATURA ───────────────────────────────────────────────
    if (normalizedEvent === 'SUBSCRIPTION_RENEWED' || normalizedEvent === 'SUBSCRIPTION_REACTIVATED') {
      const { email } = extractCustomer(body)
      if (!email) return Response.json({ error: 'Email ausente no payload' }, { status: 400 })

      await dbRenewUser(email)
      console.log(`[kirvano] SUBSCRIPTION_RENEWED: ${email}`)
      return Response.json({ ok: true })
    }

    // ── CANCELAMENTO / FALHA DE COBRANÇA ──────────────────────────────────────
    if (
      normalizedEvent === 'SUBSCRIPTION_CANCELED' ||
      normalizedEvent === 'CHARGE_FAILED' ||
      normalizedEvent === 'SUBSCRIPTION_EXPIRED'
    ) {
      const { email } = extractCustomer(body)
      if (!email) return Response.json({ error: 'Email ausente no payload' }, { status: 400 })

      await dbDeactivateUser(email)
      console.log(`[kirvano] ${normalizedEvent}: ${email} — conta desativada`)
      return Response.json({ ok: true })
    }

    // ── COMPRA DE CRÉDITOS ────────────────────────────────────────────────────
    if (normalizedEvent === 'CREDITS_PURCHASE' || normalizedEvent === 'PURCHASE_APPROVED_CREDITS') {
      const { email } = extractCustomer(body)
      if (!email) return Response.json({ error: 'Email ausente no payload' }, { status: 400 })

      const creditsToAdd = Number(body.credits || body.quantity || 50)
      await dbAddCreditos(email, creditsToAdd)
      console.log(`[kirvano] CREDITS_PURCHASE: ${email} +${creditsToAdd} créditos`)
      return Response.json({ ok: true, credits_added: creditsToAdd })
    }

    // Evento não reconhecido — OK para não quebrar o webhook
    return Response.json({ ok: true, skipped: true, event })

  } catch (err) {
    console.error('[kirvano webhook]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
