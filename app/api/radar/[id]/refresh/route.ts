import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById, dbUpdateTrackedOffer, dbCreateSnapshot, dbGetLastSnapshot, dbGetTrackedOffers } from '@/lib/db'

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''
const APIFY_TOKEN = process.env.APIFY_TOKEN || ''

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// Apify fallback when local scraper unavailable
async function countAdsFromApify(adLibraryUrl: string): Promise<number> {
  if (!APIFY_TOKEN) throw new Error('Nem scraper local nem APIFY_TOKEN disponíveis')
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

async function countAdsFromScraper(pageName: string, pageId: string | null, adLibraryUrl: string): Promise<{ count: number; resolvedPageId?: string }> {
  // Prefer saved page_id, fallback to extracting from URL
  let resolvedPageId = pageId || undefined
  if (!resolvedPageId) {
    const m = adLibraryUrl.match(/view_all_page_id=(\d+)/)
    if (m) resolvedPageId = m[1]
  }

  // Try local scraper first
  if (SCRAPER_URL) {
    try {
      const res = await fetch(`${SCRAPER_URL}/count-ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
        body: JSON.stringify({ pageName, pageId: resolvedPageId }),
        signal: AbortSignal.timeout(120000),
      })
      if (res.ok) {
        const data = await res.json() as { count: number; pageId?: string }
        return { count: data.count, resolvedPageId: data.pageId || resolvedPageId }
      }
      console.warn(`[Refresh] Scraper local HTTP ${res.status}, fallback pro Apify`)
    } catch (e) {
      console.warn(`[Refresh] Scraper local indisponível: ${(e as Error).message}, fallback pro Apify`)
    }
  }

  // Fallback to Apify
  console.log('[Refresh] Usando Apify como fallback')
  const count = await countAdsFromApify(adLibraryUrl)
  return { count, resolvedPageId }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const user = await dbGetUserById(userId)
  if (!user || !user.ativo) return NextResponse.json({ error: 'Conta inativa' }, { status: 403 })

  const { id } = await params

  const offers = await dbGetTrackedOffers(userId)
  const offer = offers.find(o => o.id === id)
  if (!offer) return NextResponse.json({ error: 'Oferta não encontrada' }, { status: 404 })

  try {
    const { count: adsCount, resolvedPageId } = await countAdsFromScraper(offer.pagina_nome, offer.page_id, offer.ad_library_url)

    const lastSnap = await dbGetLastSnapshot(id)
    const prevCount = lastSnap?.ads_count ?? offer.primeiro_snapshot_ads ?? 0
    const variacao = adsCount - prevCount
    const variacaoPct = prevCount > 0 ? (variacao / prevCount) * 100 : 0

    await dbCreateSnapshot({
      id: crypto.randomUUID(),
      tracked_offer_id: id,
      ads_count: adsCount,
      variacao,
      variacao_percent: Math.round(variacaoPct * 100) / 100,
    })

    const newStatus = adsCount === 0 && prevCount > 0 ? 'morta'
      : variacao > 0 ? 'escalando'
      : variacao < 0 ? 'caindo'
      : 'ativa'

    // Save resolved page_id if scraper found a new one (backfill on the fly)
    const updates: Parameters<typeof dbUpdateTrackedOffer>[1] = {
      ultimo_snapshot_ads: adsCount,
      status: newStatus,
    }
    if (resolvedPageId && resolvedPageId !== offer.page_id) {
      updates.page_id = resolvedPageId
    }
    await dbUpdateTrackedOffer(id, updates)

    return NextResponse.json({
      ads_count: adsCount,
      variacao,
      variacao_percent: Math.round(variacaoPct * 100) / 100,
      status: newStatus,
      page_id: resolvedPageId,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
