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
  // Log full body pra debug (sempre)
  console.log(`[kirvano] detectPlan body: ${JSON.stringify(body).slice(0, 800)}`)

  // Busca valor em todos os lugares possíveis do payload Kirvano
  const purchase = (body.purchase || body.subscription || body.charge || body.order || {}) as Record<string, unknown>
  const product = (body.product || body.offer || {}) as Record<string, unknown>
  const candidates = [
    body.amount, body.total, body.price, body.value,
    purchase.amount, purchase.total, purchase.price, purchase.value,
    product.price, product.amount,
    (body.charge as Record<string, unknown>)?.amount,
  ].filter(Boolean)

  for (const raw of candidates) {
    const num = Number(raw)
    if (isNaN(num) || num <= 0) continue
    const value = num > 1000 ? num / 100 : num
    console.log(`[kirvano] detectPlan: found value ${num} -> R$${value.toFixed(2)}`)
    if (value >= 100) return 'premium'
    return 'starter'
  }

  // Fallback SEGURO: só checa product_name/offer_name (NÃO body inteiro)
  const productName = String(body.product_name || body.offer_name || body.plan_name || product.name || '').toLowerCase()
  console.log(`[kirvano] detectPlan: no amount, checking product name: "${productName}"`)
  if (productName.includes('premium') || productName.includes('trimestral')) return 'premium'

  // Default = starter (mais seguro — nunca dar premium sem certeza)
  console.log(`[kirvano] detectPlan: defaulting to starter. Keys: ${Object.keys(body).join(',')}`)
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

    // Kirvano nao envia token — valida pela estrutura: precisa ter event + customer/buyer/email
    const hasValidShape = !!(body.event || body.type) && !!((body.customer as Record<string,unknown>)?.email || (body.buyer as Record<string,unknown>)?.email || body.email)
    if (!hasValidShape) {
      console.warn('[kirvano] payload invalido (sem event ou email)')
      return Response.json({ error: 'Invalid payload' }, { status: 400 })
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
