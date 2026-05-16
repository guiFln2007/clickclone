import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db'
import { createClient } from '@libsql/client'

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''
const CRON_SECRET = process.env.CRON_SECRET || ''

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export const maxDuration = 300

interface AdResult {
  page_id: string
  page_name: string
  start_date: number
  start_date_formatted: string
  snapshot: { link_url: string | null; images?: Array<{ original_image_url?: string; resized_image_url?: string }>; videos?: Array<{ video_hd_url?: string; video_sd_url?: string; video_preview_image_url?: string }> }
}

async function scrapeAdsForPage(pageId: string): Promise<AdResult[]> {
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}`
  try {
    const res = await fetch(`${SCRAPER_URL}/scrape-ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
      body: JSON.stringify({ url, maxAds: 80 }),
      signal: AbortSignal.timeout(180000),
    })
    if (!res.ok) return []
    const data = await res.json() as { ads: AdResult[] }
    return data.ads || []
  } catch (e) {
    console.error(`[Enrich] Scrape ads failed for ${pageId}:`, (e as Error).message)
    return []
  }
}

async function scrapeLandingScreenshot(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${SCRAPER_URL}/scrape-landing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const data = await res.json() as { images?: string[] }
    // Return first image (usually OG image or hero)
    return data.images?.[0] || null
  } catch {
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

  await initDb()

  // Get offers that are approved but not enriched yet
  const offersRes = await db.execute({
    sql: `SELECT * FROM auto_mined_offers WHERE status = 'ouro' AND enriched = 0 ORDER BY ad_count DESC LIMIT 2`,
    args: [],
  })

  if (offersRes.rows.length === 0) {
    return NextResponse.json({ ok: true, enriched: 0, message: 'Nenhuma oferta pra enriquecer' })
  }

  const results: { name: string; creatives: number; screenshot: boolean }[] = []

  for (const row of offersRes.rows) {
    const pageId = row.page_id as string
    const pageName = row.page_name as string
    const landingUrl = row.landing_url as string | null

    console.log(`[Enrich] Processing: ${pageName} (${pageId})`)

    // 1. Scrape ads to get creative URLs and ad copies
    const ads = await scrapeAdsForPage(pageId)
    const creativeUrls: string[] = []
    const adCopies: { text: string; format: string; date: string }[] = []

    for (const ad of ads.slice(0, 60)) {
      const snap = ad.snapshot as Record<string, unknown>
      // Images from snapshot
      const snapImages = snap.images as Array<Record<string, string>> | undefined
      if (Array.isArray(snapImages)) {
        for (const img of snapImages) {
          const url = img.original_image_url || img.resized_image_url || img.url
          if (url?.startsWith('http')) creativeUrls.push(url)
        }
      }
      // Videos from snapshot (skip preview thumbnails — they expire and aren't real creatives)
      const snapVideos = snap.videos as Array<Record<string, string>> | undefined
      if (Array.isArray(snapVideos)) {
        for (const vid of snapVideos) {
          const url = vid.video_hd_url || vid.video_sd_url
          if (url?.startsWith('http')) creativeUrls.push(url)
        }
      }
      // Cards (carousel)
      const snapCards = snap.cards as Array<Record<string, unknown>> | undefined
      if (Array.isArray(snapCards)) {
        for (const card of snapCards) {
          const imgUrl = (card.original_image_url || card.resized_image_url) as string
          if (imgUrl?.startsWith('http')) creativeUrls.push(imgUrl)
        }
      }
      // Ad copy — try multiple sources, fallback to card titles for catalog ads
      const bodyText = (snap.body_text as string) || ''
      const adTitle = (snap.title as string) || ''
      const ctaText = (snap.cta_text as string) || ''
      const adBodies = (ad as unknown as Record<string, unknown>).ad_creative_bodies as string[] | undefined
      let text = bodyText || adBodies?.[0] || ''
      // If body is a Mustache template (catalog ads), use card titles as fallback
      if (!text || text.includes('{{')) {
        const cardTitles = snapCards?.map(c => (c.title as string)).filter(Boolean) || []
        if (cardTitles.length > 0) text = cardTitles.join(' | ')
      }
      const hasVideo = Array.isArray(snapVideos) && snapVideos.length > 0
      const format = hasVideo ? 'video' : 'image'
      if (text) {
        const fullText = [text, adTitle && !adTitle.includes('{{') ? `Título: ${adTitle}` : '', ctaText ? `CTA: ${ctaText}` : ''].filter(Boolean).join('\n')
        adCopies.push({ text: fullText, format, date: ad.start_date_formatted || '' })
      }
    }

    // 2. Get landing page screenshot/OG image
    let landingScreenshot: string | null = null
    if (landingUrl) {
      landingScreenshot = await scrapeLandingScreenshot(landingUrl)
    }

    // 3. Save to database
    const uniqueCreatives = [...new Set(creativeUrls)].slice(0, 80)

    await db.execute({
      sql: `UPDATE auto_mined_offers SET
        creative_urls = ?,
        ad_copies = ?,
        landing_screenshot = ?,
        enriched = 1
        WHERE page_id = ?`,
      args: [
        JSON.stringify(uniqueCreatives),
        JSON.stringify(adCopies.slice(0, 40)),
        landingScreenshot,
        pageId,
      ],
    })

    console.log(`[Enrich] ${pageName}: ${uniqueCreatives.length} creatives, ${adCopies.length} copies, screenshot: ${!!landingScreenshot}`)
    results.push({ name: pageName, creatives: uniqueCreatives.length, screenshot: !!landingScreenshot })
  }

  return NextResponse.json({ ok: true, enriched: results.length, results })
}
