import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-jwt'
import { dbGetInactiveTrials } from '@/lib/db'
import { sendRecoveryBlastEmail } from '@/lib/mailer'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const token = req.cookies.get('cc_admin')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { await verifyAdminToken(token) } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const users = await dbGetInactiveTrials()
  const sent: string[] = []
  const failed: string[] = []

  for (const user of users) {
    try {
      await sendRecoveryBlastEmail(user.email)
      sent.push(user.email)
    } catch (err) {
      console.error(`[blast-recovery] Erro ao enviar para ${user.email}:`, err)
      failed.push(user.email)
    }
  }

  console.log(`[blast-recovery] ${sent.length} enviados, ${failed.length} falharam`)
  return NextResponse.json({ ok: true, sent: sent.length, failed: failed.length, emails: sent })
}
