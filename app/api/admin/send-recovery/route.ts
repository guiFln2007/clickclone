import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sendRecoveryBlastEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  const ck = await cookies()
  if (ck.get('cc_admin')?.value !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
