import { NextRequest, NextResponse } from 'next/server'

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''

// Endpoint leve pra landing page demo — pega count + dias sem rodar Claude
// Custo: R$0 (usa scraper local do Mac)
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url?.trim()) return NextResponse.json({ error: 'URL obrigat\u00f3ria' }, { status: 400 })

    // Extrai page_id da URL
    const pageIdMatch = url.match(/view_all_page_id=(\d+)/)
    const pageId = pageIdMatch?.[1]

    if (!pageId) {
      return NextResponse.json({ error: 'URL inv\u00e1lida. Use uma URL da Biblioteca de An\u00fancios com view_all_page_id.' }, { status: 400 })
    }

    // Tenta scraper local primeiro (gratis)
    if (SCRAPER_URL) {
      try {
        const res = await fetch(`${SCRAPER_URL}/count-ads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
          body: JSON.stringify({ pageName: '', pageId }),
          signal: AbortSignal.timeout(30000),
        })
        if (res.ok) {
          const data = await res.json() as { count: number }
          return NextResponse.json({ count: data.count, pageId })
        }
      } catch { /* fallback abaixo */ }
    }

    // Se scraper offline, retorna erro (nao gasta Apify pra demo gratuito)
    return NextResponse.json({ error: 'Scraper temporariamente offline' }, { status: 503 })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
