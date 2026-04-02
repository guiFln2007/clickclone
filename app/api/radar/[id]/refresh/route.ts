import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById, dbUpdateTrackedOffer, dbCreateSnapshot, dbGetLastSnapshot, dbGetTrackedOffers } from '@/lib/db'

const APIFY_TOKEN = process.env.APIFY_TOKEN

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function countAdsFromLibrary(adLibraryUrl: string): Promise<number> {
  if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN not configured')

  const cleanUrl = (() => {
    try {
      const u = new URL(adLibraryUrl)
      const clean = new URL('https://www.facebook.com/ads/library/')
      for (const k of ['active_status', 'ad_type', 'country', 'search_type', 'view_all_page_id', 'media_type']) {
        const v = u.searchParams.get(k)
        if (v) clean.searchParams.set(k, v)
      }
      return clean.toString()
    } catch { return adLibraryUrl }
  })()

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: [{ url: cleanUrl }], maxAds: 200 }) }
  )
  const runData = await runRes.json() as Record<string, unknown>
  const runId = (runData?.data as Record<string, unknown>)?.id as string
  if (!runId) throw new Error('Apify run failed')

  let status = 'RUNNING'
  let attempts = 0
  while (['RUNNING', 'READY'].includes(status) && attempts < 30) {
    await sleep(2000)
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    const sd = await s.json() as Record<string, unknown>
    status = ((sd?.data as Record<string, unknown>)?.status as string) ?? 'FAILED'
    attempts++
  }

  const itemsRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=999`)
  const items = await itemsRes.json() as unknown[]
  return Array.isArray(items) ? items.length : 0
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const user = await dbGetUserById(userId)
  if (!user || !user.ativo) return NextResponse.json({ error: 'Conta inativa' }, { status: 403 })

  const { id } = await params

  // Find the offer
  const offers = await dbGetTrackedOffers(userId)
  const offer = offers.find(o => o.id === id)
  if (!offer) return NextResponse.json({ error: 'Oferta não encontrada' }, { status: 404 })

  try {
    const adsCount = await countAdsFromLibrary(offer.ad_library_url)

    // Get last snapshot to calc variation
    const lastSnap = await dbGetLastSnapshot(id)
    const prevCount = lastSnap?.ads_count ?? offer.primeiro_snapshot_ads ?? 0
    const variacao = adsCount - prevCount
    const variacaoPct = prevCount > 0 ? (variacao / prevCount) * 100 : 0

    // Create new snapshot
    await dbCreateSnapshot({
      id: crypto.randomUUID(),
      tracked_offer_id: id,
      ads_count: adsCount,
      variacao,
      variacao_percent: Math.round(variacaoPct * 100) / 100,
    })

    // Update offer — any positive = escalando, any negative = caindo
    const newStatus = adsCount === 0 && prevCount > 0 ? 'morta'
      : variacao > 0 ? 'escalando'
      : variacao < 0 ? 'caindo'
      : 'ativa'

    await dbUpdateTrackedOffer(id, {
      ultimo_snapshot_ads: adsCount,
      status: newStatus,
    })

    return NextResponse.json({
      ads_count: adsCount,
      variacao,
      variacao_percent: Math.round(variacaoPct * 100) / 100,
      status: newStatus,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
