import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbGetUserByEmail, dbActivateUser, dbSetSwipeExpiry } from '@/lib/db'
import { sendCursoTrialEmail } from '@/lib/mailer'

const WEBHOOK_SECRET = process.env.CURSO_WEBHOOK_SECRET || 'lta-webhook-secret'

export async function POST(req: NextRequest) {
  // Auth via header secret
  const secret = req.headers.get('x-webhook-secret') || ''
  if (secret !== WEBHOOK_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    // Aceita formato Kirvano (customer.email) ou direto (email)
    const email = (body?.customer?.email || body?.email || '').toLowerCase().trim()

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Email invalido' }, { status: 400 })
    }

    // Ignora eventos que nao sao compra
    const event = body?.event || ''
    if (event && !event.includes('APPROVED') && !event.includes('SALE') && !event.includes('PURCHASE')) {
      return Response.json({ ok: true, message: 'Evento ignorado: ' + event })
    }

    const existing = await dbGetUserByEmail(email)
    if (existing && existing.ativo && !['trial', 'curso', 'inativo'].includes(existing.plano)) {
      return Response.json({ ok: true, message: 'Ja tem plano superior' })
    }

    const tempPassword = Math.random().toString(36).slice(2, 10)
    const hash = await bcrypt.hash(tempPassword, 10)

    const user = await dbActivateUser('curso', email, '', hash, 'curso')
    const swipeExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    await dbSetSwipeExpiry(user.id, swipeExpiry)

    sendCursoTrialEmail(email, tempPassword).catch(console.error)

    console.log(`[webhook/curso-lta] Trial criado: ${email}`)
    return Response.json({ ok: true, email, message: 'Trial curso criado' })
  } catch (err) {
    console.error('[webhook/curso-lta]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
