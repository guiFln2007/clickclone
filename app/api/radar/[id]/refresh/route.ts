import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById, dbUpdateTrackedOffer, dbCreateSnapshot, dbGetLastSnapshot, dbGetTrackedOffers } from '@/lib/db'

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''

async function countAdsFromScraper(pageName: string, pageId: string | null, adLibraryUrl: string): Promise<{ count: number; resolvedPageId?: string }> {
  if (!SCRAPER_URL) throw new Error('SCRAPER_URL não configurado')
  // Prefer saved page_id, fallback to extracting from URL
  let resolvedPageId = pageId || undefined
  if (!resolvedPageId) {
    const m = adLibraryUrl.match(/view_all_page_id=(\d+)/)
    if (m) resolvedPageId = m[1]
  }
  const res = await fetch(`${SCRAPER_URL}/count-ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
    body: JSON.stringify({ pageName, pageId: resolvedPageId }),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) throw new Error('Scraper error')
  const data = await res.json() as { count: number; pageId?: string }
  return { count: data.count, resolvedPageId: data.pageId || resolvedPageId }
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
