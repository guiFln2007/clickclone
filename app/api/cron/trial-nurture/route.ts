import { NextRequest, NextResponse } from 'next/server'
import { dbGetTrialUsersForNurture, dbMarkTrialEmail } from '@/lib/db'
import { sendTrialDiscountEmail, sendTrialEngageEmail } from '@/lib/mailer'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Accept ADMIN_SECRET or CRON_SECRET for auth
  const secret = req.nextUrl.searchParams.get('secret')
  const validSecrets = [process.env.ADMIN_SECRET, process.env.CRON_SECRET].filter(Boolean)
  if (validSecrets.length > 0 && !validSecrets.includes(secret || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await dbGetTrialUsersForNurture()
  const sent: string[] = []

  for (const user of users) {
    const alreadySent = (user.trial_email_sent || '').split(',')
    const diasRestantes = user.renova_em
      ? Math.max(0, Math.ceil((new Date(user.renova_em).getTime() - Date.now()) / 86400000))
      : 30
    const horasDesdeCriacao = (Date.now() - new Date(user.created_at).getTime()) / 3600000

    const mineracaoZerada = user.mineracoes === 0
    const analiseZerada = user.analises === 0
    const algumaCotaZerada = mineracaoZerada || analiseZerada
    const naoUsouNada = user.analises === user.max_analises && user.mineracoes === user.max_mineracoes

    try {
      // 0. D1 — criou conta h\u00e1 24h+ e n\u00e3o usou NADA (nem minera\u00e7\u00e3o nem an\u00e1lise)
      if (naoUsouNada && horasDesdeCriacao >= 24 && !alreadySent.includes('engage')) {
        await sendTrialEngageEmail(user.email)
        await dbMarkTrialEmail(user.id, 'engage')
        sent.push(`${user.email}:engage`)
        continue
      }

      // 1. Qualquer cota zerada (minera\u00e7\u00e3o OU an\u00e1lise) — email de quota
      if (algumaCotaZerada && !alreadySent.includes('quota')) {
        await sendTrialDiscountEmail(user.email, 'quota')
        await dbMarkTrialEmail(user.id, 'quota')
        sent.push(`${user.email}:quota`)
        continue
      }

      // 2. Faltam 3 dias ou menos — email de urg\u00eancia
      if (diasRestantes <= 3 && diasRestantes > 0 && !alreadySent.includes('expiring')) {
        await sendTrialDiscountEmail(user.email, 'expiring')
        await dbMarkTrialEmail(user.id, 'expiring')
        sent.push(`${user.email}:expiring`)
        continue
      }

      // 3. Expirou — \u00faltima chance
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
