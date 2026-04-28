import { dbGetTrialUsersForNurture, dbMarkTrialEmail } from '@/lib/db'
import { sendTrialDiscountEmail, sendTrialEngageEmail } from '@/lib/mailer'

let lastRun = 0
const INTERVAL = 12 * 60 * 60 * 1000 // 12h

export function maybeRunNurture() {
  const now = Date.now()
  if (now - lastRun < INTERVAL) return
  lastRun = now

  // Fire and forget — don't block the request
  runNurture().catch(err => console.error('[auto-nurture] erro:', err))
}

async function runNurture() {
  const users = await dbGetTrialUsersForNurture()
  let sent = 0

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
      if (naoUsouNada && horasDesdeCriacao >= 24 && !alreadySent.includes('engage')) {
        await sendTrialEngageEmail(user.email)
        await dbMarkTrialEmail(user.id, 'engage')
        sent++; continue
      }
      if (algumaCotaZerada && !alreadySent.includes('quota')) {
        await sendTrialDiscountEmail(user.email, 'quota')
        await dbMarkTrialEmail(user.id, 'quota')
        sent++; continue
      }
      if (diasRestantes <= 3 && diasRestantes > 0 && !alreadySent.includes('expiring')) {
        await sendTrialDiscountEmail(user.email, 'expiring')
        await dbMarkTrialEmail(user.id, 'expiring')
        sent++; continue
      }
      if (diasRestantes === 0 && !alreadySent.includes('expired')) {
        await sendTrialDiscountEmail(user.email, 'expired')
        await dbMarkTrialEmail(user.id, 'expired')
        sent++; continue
      }
    } catch (err) {
      console.error(`[auto-nurture] erro ${user.email}:`, err)
    }
  }

  if (sent > 0) console.log(`[auto-nurture] ${sent} emails enviados`)
}
