import { createClient } from '@libsql/client'
import { execSync } from 'child_process'
import 'dotenv/config'

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
})

const SCRAPER = 'http://localhost:3099'
const SECRET = 'rato2026scraper'
const BATCH_SIZE = 5
const RESTART_EVERY = 3 // restart scraper every N batches

async function enrichOne(pageId, pageName) {
  try {
    const res = await fetch(`${SCRAPER}/page-about`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET}` },
      body: JSON.stringify({ pageId }),
      signal: AbortSignal.timeout(60000),
    })
    const a = await res.json()

    if (a.ig_followers !== null && a.ig_followers >= 10000) {
      await db.execute({ sql: `UPDATE auto_mined_offers SET status = 'descartada', ig_handle = ?, ig_followers = ?, fb_followers = COALESCE(?, fb_followers), enriched = 1 WHERE page_id = ?`, args: [a.ig_handle, a.ig_followers, a.fb_followers, pageId] })
      return `X ${pageName} | IG:${a.ig_followers}`
    }
    if (a.fb_followers !== null && a.fb_followers >= 10000) {
      await db.execute({ sql: `UPDATE auto_mined_offers SET status = 'descartada', ig_handle = ?, ig_followers = ?, fb_followers = ?, enriched = 1 WHERE page_id = ?`, args: [a.ig_handle, a.ig_followers || 0, a.fb_followers, pageId] })
      return `X ${pageName} | FB:${a.fb_followers}`
    }
    if (a.ig_handle) {
      await db.execute({ sql: `UPDATE auto_mined_offers SET ig_handle = ?, ig_followers = ?, fb_followers = COALESCE(?, fb_followers), enriched = 1 WHERE page_id = ?`, args: [a.ig_handle, a.ig_followers || 0, a.fb_followers, pageId] })
      return `OK ${pageName} | ${a.ig_handle} IG:${a.ig_followers || 0}`
    }
    await db.execute({ sql: `UPDATE auto_mined_offers SET ig_followers = 0, enriched = 1 WHERE page_id = ?`, args: [pageId] })
    return `- ${pageName} | sem IG`
  } catch (e) {
    return `! ${pageName} | ERRO: ${e.message}`
  }
}

function restartScraper() {
  try {
    execSync('pm2 restart ratoads-scraper-local', { timeout: 10000, stdio: 'pipe' })
    // Wait for scraper to be ready
    const start = Date.now()
    while (Date.now() - start < 10000) {
      try {
        const r = execSync(`curl -s http://localhost:3099/health -H "Authorization: Bearer ${SECRET}"`, { timeout: 5000, stdio: 'pipe' })
        if (r.toString().includes('"ok":true')) return true
      } catch {}
      execSync('sleep 2', { stdio: 'pipe' })
    }
  } catch {}
  return false
}

async function main() {
  let totalChecked = 0, totalDescartadas = 0, totalOk = 0, totalSemIg = 0
  let batchNum = 0

  while (true) {
    const r = await db.execute({
      sql: `SELECT page_id, page_name FROM auto_mined_offers WHERE status IN ('ouro','ativa') AND ig_followers IS NULL AND page_id GLOB '[0-9]*' ORDER BY ad_count DESC LIMIT ?`,
      args: [BATCH_SIZE],
    })
    if (r.rows.length === 0) break

    batchNum++
    // Restart scraper periodically to keep browser fresh
    if (batchNum % RESTART_EVERY === 1 && batchNum > 1) {
      console.log(`[restart] Reiniciando scraper (batch ${batchNum})...`)
      restartScraper()
    }

    for (const row of r.rows) {
      const result = await enrichOne(row.page_id, row.page_name)
      console.log(result)
      totalChecked++
      if (result.startsWith('X')) totalDescartadas++
      else if (result.startsWith('OK')) totalOk++
      else if (result.startsWith('-')) totalSemIg++
    }

    const rem = await db.execute(`SELECT COUNT(*) as n FROM auto_mined_offers WHERE status IN ('ouro','ativa') AND ig_followers IS NULL`)
    console.log(`[batch ${batchNum}] Restam: ${rem.rows[0].n} | Total: ${totalChecked} checadas, ${totalDescartadas} descartadas, ${totalOk} ok, ${totalSemIg} sem IG`)
  }

  const total = await db.execute(`SELECT COUNT(*) as n FROM auto_mined_offers WHERE status IN ('ouro','ativa')`)
  console.log(`\n=== CONCLUIDO ===`)
  console.log(`Checadas: ${totalChecked}`)
  console.log(`Descartadas: ${totalDescartadas}`)
  console.log(`OK (IG < 10k): ${totalOk}`)
  console.log(`Sem IG vinculado: ${totalSemIg}`)
  console.log(`Total ofertas ativas: ${total.rows[0].n}`)
}

main().catch(e => console.error('FATAL:', e))
