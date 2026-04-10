import { NextRequest, NextResponse } from 'next/server'

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''

// Endpoint leve pra landing page demo — pega count + dias REAIS sem rodar Claude
// Usa /count-ads pra total e /scrape-ads com maxAds=5 pra pegar start_date mais antiga
// Custo: R$0 (scraper local do Mac)
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url?.trim()) return NextResponse.json({ error: 'URL obrigat\u00f3ria' }, { status: 400 })

    const pageIdMatch = url.match(/view_all_page_id=(\d+)/)
    const pageId = pageIdMatch?.[1]

    if (!pageId) {
      return NextResponse.json({ error: 'URL inv\u00e1lida. Use uma URL da Biblioteca de An\u00fancios com view_all_page_id.' }, { status: 400 })
    }

    if (!SCRAPER_URL) {
      return NextResponse.json({ error: 'Scraper temporariamente offline' }, { status: 503 })
    }

    // 1. Count real de ads
    let count = 0
    try {
      const countRes = await fetch(`${SCRAPER_URL}/count-ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
        body: JSON.stringify({ pageName: '', pageId }),
        signal: AbortSignal.timeout(30000),
      })
      if (countRes.ok) {
        const d = await countRes.json() as { count: number }
        count = d.count
      }
    } catch { /* continua com count=0 */ }

    // 2. Scrape poucos ads pra pegar start_date mais antiga (tempo de veiculacao real)
    let diasRodando: number | null = null
    try {
      const cleanUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}`
      const scrapeRes = await fetch(`${SCRAPER_URL}/scrape-ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
        body: JSON.stringify({ url: cleanUrl, maxAds: 10 }),
        signal: AbortSignal.timeout(60000),
      })
      if (scrapeRes.ok) {
        const d = await scrapeRes.json() as { ads?: Array<{ start_date?: number; start_date_formatted?: string }> }
        const ads = d.ads || []
        // Acha a start_date mais antiga
        let oldest = Infinity
        for (const ad of ads) {
          const ts = ad.start_date ? ad.start_date * 1000 : 0
          if (ts > 0 && ts < oldest) oldest = ts
        }
        if (oldest < Infinity) {
          diasRodando = Math.floor((Date.now() - oldest) / 86400000)
        }
      }
    } catch { /* ok, diasRodando fica null */ }

    return NextResponse.json({ count, pageId, diasRodando })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
