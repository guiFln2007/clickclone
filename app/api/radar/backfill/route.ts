import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById, dbGetTrackedOffers, dbUpdateTrackedOffer } from '@/lib/db'

export const maxDuration = 300

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''

// POST /api/radar/backfill — resolves missing page_id for old offers via scraper
// Body: { id?: string }  // if id passed, only that offer; otherwise all user's offers without page_id
export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const user = await dbGetUserById(userId)
  if (!user || !user.ativo) return NextResponse.json({ error: 'Conta inativa' }, { status: 403 })
  if (!SCRAPER_URL) return NextResponse.json({ error: 'SCRAPER_URL não configurado' }, { status: 500 })

  const body = await req.json().catch(() => ({})) as { id?: string }

  const allOffers = await dbGetTrackedOffers(userId)

  // Filter: only offers without a numeric page_id
  let candidates = allOffers.filter(o => !o.page_id || !/^\d+$/.test(o.page_id))

  // Try to extract from URL first (free)
  const extractedFromUrl: { id: string; pageId: string }[] = []
  candidates = candidates.filter(o => {
    const m = o.ad_library_url.match(/view_all_page_id=(\d+)/)
    if (m) {
      extractedFromUrl.push({ id: o.id, pageId: m[1] })
      return false
    }
    return true
  })

  // Update those that had page_id in URL (no scraper needed)
  for (const ex of extractedFromUrl) {
    await dbUpdateTrackedOffer(ex.id, { page_id: ex.pageId })
  }

  // If specific id requested, filter to just it
  if (body.id) {
    candidates = candidates.filter(o => o.id === body.id)
  }

  // For remaining, ask scraper to resolve page_id by name (uses count-ads as it returns pageId)
  let resolved = 0
  let failed = 0
  for (const offer of candidates.slice(0, 20)) { // hard cap to avoid runaway
    try {
      const res = await fetch(`${SCRAPER_URL}/count-ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
        body: JSON.stringify({ pageName: offer.pagina_nome }),
        signal: AbortSignal.timeout(60000),
      })
      if (!res.ok) { failed++; continue }
      const data = await res.json() as { count?: number; pageId?: string }
      if (data.pageId && /^\d+$/.test(data.pageId)) {
        await dbUpdateTrackedOffer(offer.id, { page_id: data.pageId })
        resolved++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return NextResponse.json({
    extractedFromUrl: extractedFromUrl.length,
    resolvedFromScraper: resolved,
    failed,
    remaining: candidates.length - resolved - failed,
  })
}
