import { NextRequest, NextResponse } from 'next/server'
import { dbGetUnclassifiedOffers, dbUpdateMinedOfferStatus } from '@/lib/db'

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''
const CRON_SECRET = process.env.CRON_SECRET || ''
const MAX_IG_FOLLOWERS = 10000

export const maxDuration = 300

interface PageAboutResult {
  page_name: string
  fb_followers: number | null
  ig_handle: string | null
  ig_followers: number | null
  category: string | null
  created_date: string | null
}

async function getPageAbout(pageId: string): Promise<PageAboutResult | null> {
  try {
    const res = await fetch(`${SCRAPER_URL}/page-about`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
      body: JSON.stringify({ pageId }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    return await res.json() as PageAboutResult
  } catch (e) {
    console.error(`[FilterFollowers] Error fetching ${pageId}:`, (e as Error).message)
    return null
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!SCRAPER_URL) {
    return NextResponse.json({ error: 'SCRAPER_URL not configured' }, { status: 500 })
  }

  const offers = await dbGetUnclassifiedOffers(5)
  if (offers.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, message: 'Nenhuma oferta pra filtrar' })
  }

  const results: { name: string; fb: number | null; ig: number | null; ig_handle: string | null; status: string }[] = []

  for (const offer of offers) {
    if (!/^\d+$/.test(offer.page_id)) {
      await dbUpdateMinedOfferStatus(offer.page_id, 'ouro')
      results.push({ name: offer.page_name, fb: null, ig: null, ig_handle: null, status: 'ouro (sem page_id)' })
      continue
    }

    const about = await getPageAbout(offer.page_id)

    if (!about) {
      // Scraper falhou — mantém como ativa pra tentar depois
      results.push({ name: offer.page_name, fb: null, ig: null, ig_handle: null, status: 'mantida (scraper falhou)' })
      continue
    }

    console.log(`[FilterFollowers] ${offer.page_name}: FB=${about.fb_followers}, IG=${about.ig_followers} ${about.ig_handle || ''}`)

    const extra = { ig_handle: about.ig_handle, ig_followers: about.ig_followers, fb_followers: about.fb_followers }
    if (about.ig_followers !== null && about.ig_followers >= MAX_IG_FOLLOWERS) {
      await dbUpdateMinedOfferStatus(offer.page_id, 'descartada', offer.nicho || undefined, extra)
      results.push({ name: offer.page_name, fb: about.fb_followers, ig: about.ig_followers, ig_handle: about.ig_handle, status: `descartada (IG ${about.ig_followers})` })
    } else {
      await dbUpdateMinedOfferStatus(offer.page_id, 'ouro', offer.nicho || undefined, extra)
      results.push({ name: offer.page_name, fb: about.fb_followers, ig: about.ig_followers, ig_handle: about.ig_handle, status: 'ouro' })
    }
  }

  return NextResponse.json({ ok: true, checked: results.length, results })
}
