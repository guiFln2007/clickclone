import { NextRequest } from 'next/server'
import { dbActivateUser } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/mailer'

// Kirvano sends POST on purchase approved
// Docs: https://kirvano.com/docs/webhook
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate secret header (set in Kirvano dashboard)
    const secret = req.headers.get('x-kirvano-secret')
    if (process.env.KIRVANO_SECRET && secret !== process.env.KIRVANO_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Kirvano payload structure (adjust field names if different)
    const event = body.event || body.type
    if (event !== 'PURCHASE_APPROVED' && event !== 'purchase.approved') {
      return Response.json({ ok: true, skipped: true })
    }

    const customer = body.customer || body.buyer || {}
    const email = (customer.email || body.email || '').toLowerCase().trim()
    const name = customer.name || customer.full_name || body.name || ''
    const kirvano_id = String(body.id || body.order_id || body.transaction_id || '')

    if (!email) {
      return Response.json({ error: 'Email ausente no payload' }, { status: 400 })
    }

    const user = await dbActivateUser(kirvano_id, email, name)

    // Send welcome email async (don't block response)
    sendWelcomeEmail(email, name).catch(console.error)

    console.log(`[kirvano] Usuário ativado: ${email} (id=${user?.id})`)

    return Response.json({ ok: true, user_id: user?.id })
  } catch (err) {
    console.error('[kirvano webhook]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
