import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbActivateUser, dbRenewUser, dbDeactivateUser, dbAddCreditos, dbAddMineracoes, dbLookupMcPending, dbLookupMcPendingByIp, dbSetMcSlug, dbLogWebhook, dbGetWebhookLogs, dbGetUserByEmail } from '@/lib/db'
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
// Offer IDs fixos do Kirvano (source of truth)
const OFFER_PLAN_MAP: Record<string, 'starter' | 'premium'> = {
  '5def273b-7070-429d-bdc2-e0ebec1da6e9': 'starter', // RatoAds Starter R$57,90
  'de252cb4-0d77-43fb-83e4-fe13bea23c12': 'premium', // RatoAds Premium R$147,90
}

// Credit packs (minerações) — offer_id -> quantity
const MINERACAO_PACK_MAP: Record<string, number> = {
  '4bfbb0ae-7fb5-4eef-8f64-dce252b2676c': 5,   // +5 Minerações R$19,90
  'f2650b74-3d7d-4a1b-b478-e4cdc2c98a56': 10,  // +10 Minerações R$27,90
  '6ef1e7e8-3aad-40b2-9b6b-4fe054a9ee41': 20,  // +20 Minerações R$44,90
}

function detectMineracaoPack(body: Record<string, unknown>): number | null {
  const products = body.products as Record<string, unknown>[] | undefined
  if (products?.[0]) {
    const offerId = String(products[0].offer_id || '')
    if (MINERACAO_PACK_MAP[offerId]) return MINERACAO_PACK_MAP[offerId]
    const name = String(products[0].offer_name || products[0].name || '').toLowerCase()
    const match = name.match(/\+(\d+)\s*minera/i)
    if (match) {
      const qty = parseInt(match[1])
      if ([5, 10, 20].includes(qty)) return qty
    }
  }
  return null
}

function detectPlan(body: Record<string, unknown>): 'starter' | 'premium' {
  console.log(`[kirvano] detectPlan body: ${JSON.stringify(body).slice(0, 1200)}`)

  // 1. Offer ID — mais confiavel, nunca erra
  const products = body.products as Record<string, unknown>[] | undefined
  if (products?.[0]) {
    const offerId = String(products[0].offer_id || '')
    if (OFFER_PLAN_MAP[offerId]) {
      console.log(`[kirvano] detectPlan: matched offer_id ${offerId} -> ${OFFER_PLAN_MAP[offerId]}`)
      return OFFER_PLAN_MAP[offerId]
    }
  }

  // 2. Valor numerico — checa fiscal (onde Kirvano realmente manda o valor)
  const fiscal = (body.fiscal || {}) as Record<string, unknown>
  const purchase = (body.purchase || body.subscription || body.charge || body.order || {}) as Record<string, unknown>
  const product = (body.product || body.offer || products?.[0] || {}) as Record<string, unknown>
  const candidates = [
    fiscal.total_value, fiscal.original_value,
    body.amount, body.total, body.total_price, body.price, body.value,
    purchase.amount, purchase.total, purchase.price, purchase.value,
    product.price, product.amount,
  ].filter(Boolean)

  for (const raw of candidates) {
    // Parseia tanto numero (147.9) quanto string formatada ("R$ 147,90")
    const str = String(raw)
    let cleaned: string
    if (str.includes(',')) {
      // Formato BR: "R$ 1.234,56" — ponto é separador de milhar
      cleaned = str.replace(/[R$\s.]/g, '').replace(',', '.')
    } else {
      // Formato internacional/plain: "57.90" ou "5790" — ponto é decimal
      cleaned = str.replace(/[R$\s]/g, '')
    }
    const num = Number(cleaned)
    if (isNaN(num) || num <= 0) continue
    const value = num > 1000 ? num / 100 : num
    console.log(`[kirvano] detectPlan: found value ${raw} -> R$${value.toFixed(2)}`)
    if (value >= 100) return 'premium'
    return 'starter'
  }

  // 3. Nome do produto/oferta/plano
  const nameFields = [
    products?.[0]?.offer_name, products?.[0]?.name,
    body.product_name, body.offer_name,
    (body.plan as Record<string, unknown>)?.name, body.plan_name,
    product.name,
  ].filter(Boolean)
  const productName = nameFields.map(n => String(n).toLowerCase()).join(' ')
  console.log(`[kirvano] detectPlan: checking names: "${productName}"`)
  if (productName.includes('premium') || productName.includes('trimestral')) return 'premium'

  // Default = starter (mais seguro)
  console.log(`[kirvano] detectPlan: defaulting to starter. Keys: ${Object.keys(body).join(',')}`)
  return 'starter'
}


export async function GET() {
  const logs = await dbGetWebhookLogs(20)
  return Response.json({ count: logs.length, logs })
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

    // Kirvano nao envia token — valida pela estrutura: precisa ter event + customer/buyer/email
    const hasValidShape = !!(body.event || body.type) && !!((body.customer as Record<string,unknown>)?.email || (body.buyer as Record<string,unknown>)?.email || body.email)
    if (!hasValidShape) {
      console.warn('[kirvano] payload invalido (sem event ou email)')
      return Response.json({ error: 'Invalid payload' }, { status: 400 })
    }
    console.log(`[kirvano] Webhook recebido. Event: ${body.event || body.type || '?'}, email: ${(body.customer as Record<string,unknown>)?.email || body.email || '?'}`)
    console.log(`[kirvano] FULL PAYLOAD: ${JSON.stringify(body).slice(0, 3000)}`)

    const event = (body.event || body.type || '') as string
    const normalizedEvent = event.toUpperCase().replace('.', '_')
    const { email: logEmail } = extractCustomer(body)
    const products = body.products as Record<string, unknown>[] | undefined
    const logOfferId = String(products?.[0]?.offer_id || '')

    // Salvar TUDO no banco (persiste entre restarts)
    dbLogWebhook(normalizedEvent, logEmail, logOfferId, '', JSON.stringify(body)).catch(() => {})

    // ── RECARGA DE MINERAÇÕES ─────────────────────────────────────────────────
    if (normalizedEvent === 'PURCHASE_APPROVED' || normalizedEvent === 'SALE_APPROVED') {
      const mineracaoQty = detectMineracaoPack(body)
      if (mineracaoQty) {
        const { email } = extractCustomer(body)
        if (!email) return Response.json({ error: 'Email ausente no payload' }, { status: 400 })

        await dbAddMineracoes(email, mineracaoQty)
        dbLogWebhook(normalizedEvent, email, logOfferId, `mineracoes_+${mineracaoQty}`, JSON.stringify(body)).catch(() => {})
        console.log(`[kirvano] MINERACAO_PACK: ${email} +${mineracaoQty} mineracoes`)
        return Response.json({ ok: true, type: 'mineracoes', qty: mineracaoQty })
      }
    }

    // ── COMPRA APROVADA (plano) ─────────────────────────────────────────────
    if (normalizedEvent === 'PURCHASE_APPROVED' || normalizedEvent === 'SALE_APPROVED') {
      const { email, name, kirvano_id } = extractCustomer(body)
      if (!email) return Response.json({ error: 'Email ausente no payload' }, { status: 400 })

      // Idempotência: se já processou esse pedido, não regenera senha
      const existing = await dbGetUserByEmail(email)
      if (existing && existing.ativo && existing.hash && kirvano_id && existing.kirvano_id === kirvano_id) {
        console.log(`[kirvano] PURCHASE_APPROVED duplicado (mesmo kirvano_id): ${email} — ignorando`)
        return Response.json({ ok: true, user_id: existing.id, plano: existing.plano, deduplicated: true })
      }

      const plano = detectPlan(body)
      const tempPassword = Math.random().toString(36).slice(2, 10)
      const hash = await bcrypt.hash(tempPassword, 10)

      const user = await dbActivateUser(kirvano_id, email, name, hash, plano)

      // Atribuir mc_slug da tabela de pending (ManyChat tracking)
      if (user?.id) {
        let mcSlug = await dbLookupMcPending(email).catch(() => null)
        if (!mcSlug) {
          const buyerIp = ((body.customer || body.buyer || {}) as Record<string, unknown>).ip as string | undefined
          if (buyerIp) mcSlug = await dbLookupMcPendingByIp(buyerIp).catch(() => null)
        }
        if (mcSlug) {
          dbSetMcSlug(user.id, mcSlug).catch(() => {})
          console.log(`[kirvano] mc_slug atribuido: ${email} -> ${mcSlug}`)
        }
      }

      dbLogWebhook(normalizedEvent, email, logOfferId, plano, JSON.stringify(body)).catch(() => {})
      sendWelcomeEmail(email, name, tempPassword).catch(console.error)
      console.log(`[kirvano] PURCHASE_APPROVED: ${email} plano=${plano} senha=${tempPassword} (id=${user?.id})`)
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

    // ── REEMBOLSO ─────────────────────────────────────────────────────────────
    if (
      normalizedEvent === 'PURCHASE_REFUNDED' ||
      normalizedEvent === 'REFUND' ||
      normalizedEvent === 'REFUNDED' ||
      normalizedEvent === 'CHARGEBACK' ||
      normalizedEvent === 'PURCHASE_CHARGEBACK' ||
      normalizedEvent === 'DISPUTE' ||
      normalizedEvent === 'SALE_REFUNDED'
    ) {
      const { email } = extractCustomer(body)
      if (!email) return Response.json({ error: 'Email ausente no payload' }, { status: 400 })

      await dbDeactivateUser(email)
      console.log(`[kirvano] ${normalizedEvent}: ${email} — conta desativada por reembolso`)
      return Response.json({ ok: true, action: 'deactivated_refund' })
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
