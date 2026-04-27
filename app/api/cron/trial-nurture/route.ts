import { NextRequest, NextResponse } from 'next/server'
import { dbGetTrialUsersForNurture, dbMarkTrialEmail } from '@/lib/db'
import { sendTrialDiscountEmail } from '@/lib/mailer'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Optional secret check for cron security
  const secret = req.nextUrl.searchParams.get('secret')
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await dbGetTrialUsersForNurture()
  const sent: string[] = []

  for (const user of users) {
    const alreadySent = (user.trial_email_sent || '').split(',')
    const diasRestantes = user.renova_em
      ? Math.max(0, Math.ceil((new Date(user.renova_em).getTime() - Date.now()) / 86400000))
      : 30

    const cotaZerada = user.analises === 0 && user.mineracoes === 0

    try {
      // 1. Cota zerada — manda email de quota (uma vez)
      if (cotaZerada && !alreadySent.includes('quota')) {
        await sendTrialDiscountEmail(user.email, 'quota')
        await dbMarkTrialEmail(user.id, 'quota')
        sent.push(`${user.email}:quota`)
        continue
      }

      // 2. Faltam 3 dias ou menos — manda email de expiring (uma vez)
      if (diasRestantes <= 3 && diasRestantes > 0 && !alreadySent.includes('expiring')) {
        await sendTrialDiscountEmail(user.email, 'expiring')
        await dbMarkTrialEmail(user.id, 'expiring')
        sent.push(`${user.email}:expiring`)
        continue
      }

      // 3. Expirou — manda email de expired (uma vez)
      if (diasRestantes === 0 && !alreadySent.includes('expired')) {
        await sendTrialDiscountEmail(user.email, 'expired')
        await dbMarkTrialEmail(user.id, 'expired')
        sent.push(`${user.email}:expired`)
        continue
      }
    } catch (err) {
      console.error(`[trial-nurture] Erro ao enviar para ${user.email}:`, err)
    }
  }

  console.log(`[trial-nurture] ${sent.length} emails enviados:`, sent)
  return NextResponse.json({ ok: true, sent: sent.length, details: sent })
}
