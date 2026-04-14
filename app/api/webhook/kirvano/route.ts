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

// Mapeia o valor pago pro plano correto
// Starter: R$57,90 | Premium: R$147,90 (trimestral)
function detectPlan(body: Record<string, unknown>): 'starter' | 'premium' {
  const amount = Number(body.amount || body.total || body.price || (body.charge as Record<string, unknown>)?.amount || 0)
  // Valor em centavos ou reais — normaliza
  const value = amount > 1000 ? amount / 100 : amount
  // Premium = acima de R$100
  if (value >= 100) return 'premium'
  // Checa product name/id como fallback
  const productName = String(body.product_name || body.offer_name || body.plan_name || '').toLowerCase()
  if (productName.includes('premium') || productName.includes('trimestral')) return 'premium'
  return 'starter'
}

// Debug: keep last 10 webhook hits in memory
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const webhookHits: { ts: string; headers: Record<string, string>; query: Record<string, string>; body: any; tokenMatch?: boolean }[] = []

export async function GET() {
  return Response.json({ count: webhookHits.length, hits: webhookHits })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const headers: Record<string, string> = {}
    req.headers.forEach((v, k) => { headers[k] = v })
    const query: Record<string, string> = {}
    req.nextUrl.searchParams.forEach((v, k) => { query[k] = v })

    const expectedToken = process.env.KIRVANO_SECRET || ''
    // Try every reasonable place the token might come in
    const candidates = [
      String(body.token || ''),
      req.headers.get('x-kirvano-secret') || '',
      req.headers.get('x-webhook-token') || '',
      req.headers.get('x-webhook-secret') || '',
      req.headers.get('x-secret') || '',
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '',
      req.nextUrl.searchParams.get('token') || '',
      req.nextUrl.searchParams.get('secret') || '',
    ]
    const incomingToken = candidates.find(c => c === expectedToken) || candidates.find(c => c.length > 0) || ''
    const tokenMatch = incomingToken === expectedToken && expectedToken.length > 0

    webhookHits.unshift({ ts: new Date().toISOString(), headers, query, body, tokenMatch })
    if (webhookHits.length > 10) webhookHits.length = 10

    // Valida token (obrigatorio — rejeita se KIRVANO_SECRET nao configurado)
    const kirvanoSecret = process.env.KIRVANO_SECRET
    if (!kirvanoSecret) {
      console.error('[kirvano] KIRVANO_SECRET nao configurado — rejeitando webhook')
      return Response.json({ error: 'Server misconfigured' }, { status: 500 })
    }
    const secret = String(body.token || '') || req.headers.get('x-kirvano-secret') || ''
    if (secret !== kirvanoSecret) {
      console.warn('[kirvano] 401 - token invalido')
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log(`[kirvano] Webhook recebido. Event: ${body.event || body.type || '?'}, email: ${(body.customer as Record<string,unknown>)?.email || body.email || '?'}`)

    const event = (body.event || body.type || '') as string
    const normalizedEvent = event.toUpperCase().replace('.', '_')

    // ── COMPRA APROVADA ───────────────────────────────────────────────────────
    if (normalizedEvent === 'PURCHASE_APPROVED' || normalizedEvent === 'SALE_APPROVED') {
      const { email, name, kirvano_id } = extractCustomer(body)
      if (!email) return Response.json({ error: 'Email ausente no payload' }, { status: 400 })

      const plano = detectPlan(body)
      const tempPassword = Math.random().toString(36).slice(2, 10)
      const hash = await bcrypt.hash(tempPassword, 10)

      const user = await dbActivateUser(kirvano_id, email, name, hash, plano)

      sendWelcomeEmail(email, name, tempPassword).catch(console.error)
      console.log(`[kirvano] PURCHASE_APPROVED: ${email} plano=${plano} (id=${user?.id})`)
      return Response.json({ ok: true, user_id: user?.id, plano })
    }

    // ── RENOVAÇÃO DE ASSINATURA ───────────────────────────────────────────────
    if (normalizedEvent === 'SUBSCRIPTION_RENEWED' || normalizedEvent === 'SUBSCRIPTION_REACTIVATED') {
      const { email } = extractCustomer(body)
      if (!email) return Response.json({ error: 'Email ausente no payload' }, { status: 400 })

      const plano = detectPlan(body)
      await dbRenewUser(email, plano)
      console.log(`[kirvano] SUBSCRIPTION_RENEWED: ${email} plano=${plano}`)
      return Response.json({ ok: true, plano })
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
