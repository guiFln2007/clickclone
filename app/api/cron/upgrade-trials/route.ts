import { NextRequest, NextResponse } from 'next/server'
import { dbGetTrialUsersForNurture, dbAdminUpdateUser } from '@/lib/db'
import { sendTrialUpgradeEmail } from '@/lib/mailer'

// One-time migration: upgrade trial users from 1/1/1 to 3/3/3
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await dbGetTrialUsersForNurture()
  const updated: string[] = []

  for (const user of users) {
    // Only upgrade users who were on old 1/1/1 plan (max_analises = 1)
    if (user.max_analises > 3) continue

    // Calculate how many they used on the old plan
    const usedAnalises = Math.max(0, user.max_analises - user.analises)
    const usedMineracoes = Math.max(0, user.max_mineracoes - user.mineracoes)

    // Give them 3 minus what they already used
    const newAnalises = Math.max(0, 3 - usedAnalises)
    const newMineracoes = Math.max(0, 3 - usedMineracoes)

    await dbAdminUpdateUser(user.id, {
      analises: newAnalises,
      mineracoes: newMineracoes,
      max_analises: 3,
      max_mineracoes: 3,
      max_slots_radar: 3,
    })

    try {
      await sendTrialUpgradeEmail(user.email)
    } catch (err) {
      console.error(`[upgrade-trials] Erro email ${user.email}:`, err)
    }

    updated.push(`${user.email} (analises=${newAnalises}, mineracoes=${newMineracoes})`)
  }

  console.log(`[upgrade-trials] ${updated.length} users atualizados:`, updated)
  return NextResponse.json({ ok: true, updated: updated.length, details: updated })
}
