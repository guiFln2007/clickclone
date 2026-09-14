import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbGetUserByEmail, dbActivateUser, dbSetSwipeExpiry } from '@/lib/db'
import { sendCursoTrialEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Aceita shape Kirvano (customer na raiz) e Cakto (tudo dentro de data)
    const data = (body?.data || body || {}) as Record<string, unknown>
    const customer = (data?.customer || data?.buyer || {}) as Record<string, unknown>
    const email = ((customer?.email || data?.email || '') as string).toLowerCase().trim()
    const name = ((customer?.name || data?.name || '') as string).trim()
    // Nome do curso pro email (LTM manda course: 'ltm')
    const courseName = body?.course === 'ltm' ? 'Low Ticket Mapeado' : 'Curso Low Ticket Automatizado'

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Email invalido' }, { status: 400 })
    }

    // Ignora eventos que nao sao compra
    const event = String(body?.event || '').toUpperCase()
    if (event && !event.includes('APPROVED') && !event.includes('SALE') && !event.includes('PURCHASE')) {
      return Response.json({ ok: true, message: 'Evento ignorado: ' + event })
    }

    const existing = await dbGetUserByEmail(email)
    if (existing && existing.ativo && !['trial', 'curso', 'inativo'].includes(existing.plano)) {
      return Response.json({ ok: true, message: 'Ja tem plano superior' })
    }

    // Idempotência: se já é curso ativo com hash, não regenera senha
    if (existing && existing.ativo && existing.hash && existing.kirvano_id === 'curso') {
      console.log(`[webhook/curso-lta] Duplicado: ${email} — ignorando`)
      return Response.json({ ok: true, message: 'Ja processado', deduplicated: true })
    }

    const tempPassword = Math.random().toString(36).slice(2, 10)
    const hash = await bcrypt.hash(tempPassword, 10)

    const user = await dbActivateUser('curso', email, name, hash, 'curso')
    const swipeExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    await dbSetSwipeExpiry(user.id, swipeExpiry)

    sendCursoTrialEmail(email, tempPassword, courseName).catch(console.error)

    console.log(`[webhook/curso-lta] Trial criado: ${email}`)
    return Response.json({ ok: true, email, message: 'Trial curso criado' })
  } catch (err) {
    console.error('[webhook/curso-lta]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
