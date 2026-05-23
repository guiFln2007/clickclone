import { NextRequest, NextResponse } from 'next/server'
import { dbGetMinedOffers, dbUpdateMinedOfferStatus } from '@/lib/db'

const SECRET = process.env.SCRAPER_SECRET || ''
const SCRAPER_URL = process.env.SCRAPER_URL || 'https://scraper.forbuy.shop'

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token || token !== SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Buscar ofertas sem IG handle
  const { offers } = await dbGetMinedOffers({ limit: 500 })
  const noIg = offers.filter(o => !o.ig_handle && o.landing_url)

  if (noIg.length === 0) return NextResponse.json({ message: 'All offers have IG data', total: offers.length })

  // Enviar em batches de 50 pro scraper
  let enrichedTotal = 0
  for (let i = 0; i < noIg.length; i += 50) {
    const batch = noIg.slice(i, i + 50).map(o => ({
      page_id: o.page_id,
      page_name: o.page_name,
      landing_url: o.landing_url,
    }))

    try {
      const res = await fetch(`${SCRAPER_URL}/enrich-ig`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET}` },
        body: JSON.stringify({ offers: batch }),
        signal: AbortSignal.timeout(120000),
      })
      if (!res.ok) continue
      const { enriched } = await res.json()
      if (!enriched?.length) continue

      // Atualizar DB
      for (const e of enriched) {
        await dbUpdateMinedOfferStatus(e.page_id, 'ativa', undefined, {
          ig_handle: e.ig_handle,
          ig_followers: e.ig_followers,
        })
      }
      enrichedTotal += enriched.length
    } catch (err) {
      console.log(`[enrich-ig] Batch ${i} failed:`, (err as Error).message)
    }
  }

  return NextResponse.json({
    total: offers.length,
    without_ig: noIg.length,
    enriched: enrichedTotal,
  })
}
