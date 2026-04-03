import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById, dbUpdateTrackedOffer, dbCreateSnapshot, dbGetLastSnapshot, dbGetTrackedOffers } from '@/lib/db'

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''

async function countAdsFromScraper(pageName: string): Promise<number> {
  if (!SCRAPER_URL) throw new Error('SCRAPER_URL não configurado')
  const res = await fetch(`${SCRAPER_URL}/count-ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
    body: JSON.stringify({ pageName }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error('Scraper error')
  const data = await res.json() as { count: number }
  return data.count
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
    const adsCount = await countAdsFromScraper(offer.pagina_nome)

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
