import { NextRequest, NextResponse } from 'next/server'
import { dbUpdateMinedOfferStatus } from '@/lib/db'
import { createClient } from '@libsql/client'

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''
const CRON_SECRET = process.env.CRON_SECRET || ''

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!SCRAPER_URL) {
    return NextResponse.json({ error: 'SCRAPER_URL not configured' }, { status: 500 })
  }

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
  })

  // Get offers with NULL ig_followers that are still active
  const batchSize = Number(req.nextUrl.searchParams.get('batch') || '5')
  const res = await db.execute({
    sql: `SELECT page_id, page_name, nicho FROM auto_mined_offers
          WHERE status IN ('ouro', 'ativa') AND ig_followers IS NULL AND page_id GLOB '[0-9]*'
          ORDER BY ad_count DESC LIMIT ?`,
    args: [batchSize],
  })

  if (res.rows.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, message: 'All offers already have IG data' })
  }

  const results: { name: string; ig: number | null; ig_handle: string | null; status: string }[] = []

  for (const row of res.rows) {
    const pageId = row.page_id as string
    const pageName = row.page_name as string
    const nicho = (row.nicho as string) || undefined

    try {
      const aboutRes = await fetch(`${SCRAPER_URL}/page-about`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
        body: JSON.stringify({ pageId }),
        signal: AbortSignal.timeout(45000),
      })

      if (!aboutRes.ok) {
        results.push({ name: pageName, ig: null, ig_handle: null, status: 'scraper error' })
        continue
      }

      const about = await aboutRes.json()

      if (about.ig_followers !== null && about.ig_followers >= 10000) {
        await dbUpdateMinedOfferStatus(pageId, 'descartada', nicho, {
          ig_handle: about.ig_handle,
          ig_followers: about.ig_followers,
          fb_followers: about.fb_followers,
        })
        results.push({ name: pageName, ig: about.ig_followers, ig_handle: about.ig_handle, status: `descartada (IG ${about.ig_followers})` })
      } else if (about.ig_handle) {
        await dbUpdateMinedOfferStatus(pageId, 'ouro', nicho, {
          ig_handle: about.ig_handle,
          ig_followers: about.ig_followers,
          fb_followers: about.fb_followers,
        })
        results.push({ name: pageName, ig: about.ig_followers, ig_handle: about.ig_handle, status: 'enriched' })
      } else {
        // No IG found — mark as enriched with NULL ig so we don't retry forever
        await db.execute({
          sql: `UPDATE auto_mined_offers SET ig_followers = 0, enriched = 1 WHERE page_id = ?`,
          args: [pageId],
        })
        results.push({ name: pageName, ig: null, ig_handle: null, status: 'no IG found' })
      }
    } catch (e) {
      results.push({ name: pageName, ig: null, ig_handle: null, status: `error: ${(e as Error).message}` })
    }
  }

  // Count remaining
  const remaining = await db.execute({
    sql: `SELECT COUNT(*) as n FROM auto_mined_offers WHERE status IN ('ouro', 'ativa') AND ig_followers IS NULL`,
    args: [],
  })

  return NextResponse.json({
    ok: true,
    checked: results.length,
    remaining: Number(remaining.rows[0]?.n ?? 0),
    results,
  })
}
