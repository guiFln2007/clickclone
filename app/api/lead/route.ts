import { NextRequest } from 'next/server'
import { dbSaveLead } from '@/lib/db'
import { sendCouponEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return Response.json({ error: 'Email invalido' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const saved = await dbSaveLead(normalizedEmail)

    if (saved) {
      sendCouponEmail(normalizedEmail).catch(console.error)
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[lead]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
