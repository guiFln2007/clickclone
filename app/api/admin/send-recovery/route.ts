import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-jwt'
import { sendRecoveryBlastEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('cc_admin')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { await verifyAdminToken(token) } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  try {
    await sendRecoveryBlastEmail(email)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(`[send-recovery] Erro ao enviar para ${email}:`, err)
    return NextResponse.json({ error: 'Falha ao enviar' }, { status: 500 })
  }
}
