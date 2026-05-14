import express from 'express'
import puppeteer from 'puppeteer-core'
import { randomUUID } from 'crypto'

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const SECRET = process.env.SCRAPER_SECRET || ''
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser'

// Auth middleware
function auth(req, res, next) {
  if (!SECRET) return next()
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (token !== SECRET) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

app.use(auth)

// Browser pool — reuse browser instance
let browserInstance = null
async function getBrowser() {
  if (browserInstance && browserInstance.connected) return browserInstance
  browserInstance = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--single-process',
      '--no-zygote',
    ],
  })
  return browserInstance
}

// Concurrency queue — max 2 concurrent scrapes
const MAX_CONCURRENT = 2
let running = 0
const queue = []

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      running++
      try { resolve(await fn()) }
      catch (e) { reject(e) }
      finally {
        running--
        if (queue.length > 0) queue.shift()()
      }
    }
    if (running < MAX_CONCURRENT) run()
    else queue.push(run)
  })
}

// ── HEALTH ──
app.get('/health', (req, res) => {
  res.json({ ok: true, running, queued: queue.length })
})

// ── PAGE-ABOUT ──
app.post('/page-about', async (req, res) => {
  const { pageId } = req.body
  if (!pageId) return res.status(400).json({ error: 'pageId required' })

  try {
    const result = await enqueue(() => scrapePageAbout(pageId))
    res.json(result)
  } catch (e) {
    console.error('[page-about] Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── SCRAPE-ADS ──
app.post('/scrape-ads', async (req, res) => {
  const { url, maxAds = 80 } = req.body
  if (!url) return res.status(400).json({ error: 'url required' })

  try {
    const result = await enqueue(() => scrapeAds(url, maxAds))
    res.json(result)
  } catch (e) {
    console.error('[scrape-ads] Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── COUNT-ADS ──
app.post('/count-ads', async (req, res) => {
  const { pageId } = req.body
  if (!pageId) return res.status(400).json({ error: 'pageId required' })

  try {
    const count = await enqueue(() => countAds(pageId))
    res.json({ count })
  } catch (e) {
    console.error('[count-ads] Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── SCRAPE-LANDING ──
app.post('/scrape-landing', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'url required' })

  try {
    const result = await enqueue(() => scrapeLanding(url))
    res.json(result)
  } catch (e) {
    console.error('[scrape-landing] Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── MINE (async jobs) ──
const jobs = new Map()

app.post('/mine', async (req, res) => {
  const { keyword, count = 300 } = req.body
  if (!keyword) return res.status(400).json({ error: 'keyword required' })

  const jobId = randomUUID().slice(0, 8)
  jobs.set(jobId, { status: 'running', results: null, error: null })

  // Run in background
  runMineJob(jobId, keyword, count).catch(e => {
    console.error('[mine] Job failed:', e.message)
    const job = jobs.get(jobId)
    if (job) { job.status = 'failed'; job.error = e.message }
  })

  res.json({ jobId })
})

app.get('/mine', (req, res) => {
  const { jobId } = req.query
  if (!jobId) return res.status(400).json({ error: 'jobId required' })

  const job = jobs.get(jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  if (job.status === 'running') return res.json({ status: 'running' })
  if (job.status === 'failed') return res.json({ status: 'failed', error: job.error })

  // Clean up after delivering results
  const result = { status: 'done', results: job.results }
  setTimeout(() => jobs.delete(jobId), 60000)
  res.json(result)
})

// ════════════════════════════════════════
// SCRAPER FUNCTIONS
// ════════════════════════════════════════

function parseFollowers(text) {
  const m = text.match(/([\d.,]+)\s*(mil|milhão|milhões|mi)?/i)
  if (!m) return null
  let num = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  if (m[2]?.includes('mil')) num *= 1000
  if (m[2]?.match(/milh|mi/)) num *= 1000000
  return Math.round(num)
}

async function scrapePageAbout(pageId) {
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}`
  const browser = await getBrowser()
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  const result = { page_name: '', fb_followers: null, ig_handle: null, ig_followers: null, category: null, created_date: null }

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(3000)

    result.page_name = await page.evaluate(() => {
      const h = document.querySelector('h1, [role="heading"]')
      return h?.textContent?.trim() || ''
    })

    // Click "Sobre" tab
    const sobreClicked = await page.evaluate(() => {
      const els = [...document.querySelectorAll('a, span, div, button')]
      const sobre = els.find(el => {
        const t = el.textContent?.trim().toLowerCase() || ''
        return t === 'sobre' || t === 'about'
      })
      if (sobre) { sobre.click(); return true }
      return false
    })

    if (sobreClicked) await sleep(3000)

    const data = await page.evaluate(() => {
      const text = document.body.innerText || ''
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

      let fbFollowers = null, igHandle = null, igFollowers = null, category = null, createdDate = null

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.match(/^[\d.,]+\s*(mil|milhão|milhões|mi)?\s*seguidor/i) && !igHandle) fbFollowers = line
        if (line.startsWith('@') && !line.includes(' ')) {
          igHandle = line
          if (i + 1 < lines.length && lines[i + 1].match(/seguidor/i)) igFollowers = lines[i + 1]
        }
        if (fbFollowers && !category && line.includes('\u2022')) {
          const parts = line.split('\u2022')
          if (parts.length > 1) category = parts[parts.length - 1].trim()
        }
        if (line.match(/p.gina criada/i)) createdDate = line.replace(/p.gina criada\s*/i, '').trim()
      }
      return { fbFollowers, igHandle, igFollowers, category, createdDate }
    })

    if (data.fbFollowers) result.fb_followers = parseFollowers(data.fbFollowers)
    if (data.igHandle) result.ig_handle = data.igHandle
    if (data.igFollowers) result.ig_followers = parseFollowers(data.igFollowers)
    if (data.category) result.category = data.category
    if (data.createdDate) result.created_date = data.createdDate

    console.log(`[PageAbout] ${result.page_name}: FB=${result.fb_followers}, IG=${result.ig_followers} ${result.ig_handle || ''}`)
    return result
  } finally {
    await page.close()
  }
}

async function scrapeAds(url, maxAds) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  const ads = []
  const seenIds = new Set()

  try {
    // Intercept GraphQL responses
    page.on('response', async (response) => {
      try {
        const reqUrl = response.url()
        if (!reqUrl.includes('/api/graphql') && !reqUrl.includes('ads_library')) return
        if (response.status() !== 200) return

        const ct = response.headers()['content-type'] || ''
        if (!ct.includes('json') && !ct.includes('text')) return

        const text = await response.text().catch(() => '')
        if (!text) return

        // Facebook returns multiple JSON objects separated by newlines
        const jsonBlocks = text.split('\n').filter(l => l.trim().startsWith('{'))
        for (const block of jsonBlocks) {
          try {
            const json = JSON.parse(block)
            extractAdsFromGraphQL(json, ads, seenIds)
          } catch { /* skip invalid JSON */ }
        }
      } catch { /* ignore response errors */ }
    })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await sleep(4000)

    // Scroll to load more ads
    let lastCount = 0
    let staleScrolls = 0
    const maxScrolls = Math.ceil(maxAds / 10) + 5

    for (let i = 0; i < maxScrolls && ads.length < maxAds; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await sleep(2000)

      // Click "Ver mais" button if present
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, [role="button"], a')]
        const more = btns.find(b => {
          const t = (b.textContent || '').toLowerCase()
          return t.includes('ver mais') || t.includes('see more') || t.includes('mostrar mais')
        })
        if (more) more.click()
      })

      if (ads.length === lastCount) {
        staleScrolls++
        if (staleScrolls >= 4) break
      } else {
        staleScrolls = 0
        lastCount = ads.length
      }
    }

    console.log(`[scrape-ads] Got ${ads.length} ads from ${url.slice(0, 80)}`)
    return { ads: ads.slice(0, maxAds) }
  } finally {
    await page.close()
  }
}

function extractAdsFromGraphQL(json, ads, seenIds) {
  // Walk the JSON tree looking for ad data
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) { obj.forEach(walk); return }

    // Look for ad nodes with collated_results or similar
    if (obj.ad_archive_id || obj.adArchiveID) {
      const id = obj.ad_archive_id || obj.adArchiveID
      if (seenIds.has(id)) return
      seenIds.add(id)

      const snapshot = obj.snapshot || {}
      const bodyText = snapshot.body?.markup?.__html || snapshot.body?.text || obj.body_text || ''
      const title = snapshot.title || obj.title || ''
      const ctaText = snapshot.cta_text || obj.cta_text || ''
      const linkUrl = snapshot.link_url || snapshot.cta_link || obj.link_url || ''

      // Parse images
      const images = []
      if (snapshot.images && Array.isArray(snapshot.images)) {
        for (const img of snapshot.images) {
          if (img.original_image_url || img.resized_image_url || img.url) {
            images.push({
              original_image_url: img.original_image_url || '',
              resized_image_url: img.resized_image_url || img.url || '',
            })
          }
        }
      }

      // Parse videos
      const videos = []
      if (snapshot.videos && Array.isArray(snapshot.videos)) {
        for (const vid of snapshot.videos) {
          if (vid.video_hd_url || vid.video_sd_url || vid.video_preview_image_url) {
            videos.push({
              video_hd_url: vid.video_hd_url || '',
              video_sd_url: vid.video_sd_url || '',
              video_preview_image_url: vid.video_preview_image_url || '',
            })
          }
        }
      }

      // Parse cards (carousel)
      const cards = []
      if (snapshot.cards && Array.isArray(snapshot.cards)) {
        for (const card of snapshot.cards) {
          cards.push({
            title: card.title || '',
            link_url: card.link_url || '',
            original_image_url: card.original_image_url || '',
            resized_image_url: card.resized_image_url || '',
          })
        }
      }

      // Parse dates
      let startDate = null
      let startDateFormatted = ''
      if (obj.start_date) {
        startDate = typeof obj.start_date === 'number' ? obj.start_date : parseInt(obj.start_date)
        if (startDate) startDateFormatted = new Date(startDate * 1000).toISOString().slice(0, 19).replace('T', ' ')
      }

      const pageId = obj.page_id || snapshot.page_id || obj.pageID || ''
      const pageName = obj.page_name || snapshot.page_name || obj.pageName || ''

      ads.push({
        page_id: String(pageId),
        page_name: pageName,
        start_date: startDate,
        start_date_formatted: startDateFormatted,
        snapshot: {
          body_text: bodyText,
          title,
          cta_text: ctaText,
          link_url: linkUrl,
          images,
          videos,
          cards,
        },
      })
    }

    // Recurse
    for (const val of Object.values(obj)) walk(val)
  }

  walk(json)
}

async function countAds(pageId) {
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}`
  const browser = await getBrowser()
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(3000)

    const count = await page.evaluate(() => {
      const text = document.body.innerText || ''
      // "Exibindo resultados para aproximadamente 47 anúncios"
      // "Approximately 47 ads"
      const m = text.match(/(?:aproximadamente|approximately|exibindo)\s*(\d[\d.,]*)\s*(?:anúncios|ads|resultados)/i)
      if (m) return parseInt(m[1].replace(/[.,]/g, ''))
      // Fallback: count ad cards
      const cards = document.querySelectorAll('[class*="AdCard"], [class*="ad-card"], [data-testid*="ad"]')
      return cards.length || 0
    })

    console.log(`[count-ads] ${pageId}: ${count}`)
    return count
  } finally {
    await page.close()
  }
}

async function scrapeLanding(url) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await sleep(2000)

    const images = await page.evaluate(() => {
      const imgs = []
      // OG image
      const og = document.querySelector('meta[property="og:image"]')
      if (og?.content) imgs.push(og.content)
      // Hero images
      const heroImgs = document.querySelectorAll('img')
      for (const img of heroImgs) {
        if (img.src && img.naturalWidth > 200 && !img.src.includes('data:')) {
          imgs.push(img.src)
          if (imgs.length >= 5) break
        }
      }
      return [...new Set(imgs)]
    })

    return { images }
  } finally {
    await page.close()
  }
}

async function runMineJob(jobId, keyword, count) {
  const job = jobs.get(jobId)
  const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(keyword)}&search_type=keyword_unordered`

  const browser = await getBrowser()
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  const pages = new Map() // pageId → { name, count, earliestDate, landing }

  try {
    // Intercept GraphQL to collect page data
    page.on('response', async (response) => {
      try {
        const reqUrl = response.url()
        if (!reqUrl.includes('/api/graphql') && !reqUrl.includes('ads_library')) return
        if (response.status() !== 200) return

        const text = await response.text().catch(() => '')
        if (!text) return

        const jsonBlocks = text.split('\n').filter(l => l.trim().startsWith('{'))
        for (const block of jsonBlocks) {
          try {
            const json = JSON.parse(block)
            extractPagesFromGraphQL(json, pages)
          } catch { /* skip */ }
        }
      } catch { /* ignore */ }
    })

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await sleep(5000)

    // Scroll to collect pages
    let lastSize = 0
    let staleScrolls = 0
    const maxScrolls = Math.ceil(count / 10) + 10

    for (let i = 0; i < maxScrolls; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await sleep(2500)

      // Click "Ver mais"
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, [role="button"], a')]
        const more = btns.find(b => {
          const t = (b.textContent || '').toLowerCase()
          return t.includes('ver mais') || t.includes('see more') || t.includes('mostrar mais')
        })
        if (more) more.click()
      })

      const currentSize = pages.size
      if (currentSize === lastSize) {
        staleScrolls++
        if (staleScrolls >= 5) break
      } else {
        staleScrolls = 0
        lastSize = currentSize
      }

      if (currentSize >= count) break
    }

    // Convert to results
    const now = Date.now()
    const results = Array.from(pages.entries()).map(([pageId, info]) => ({
      pagina_nome: info.name,
      page_id: pageId,
      total_anuncios: info.count,
      dias_rodando: info.earliestDate ? Math.floor((now - info.earliestDate) / 86400000) : null,
      landing_url: info.landing,
    }))

    console.log(`[mine] "${keyword}": ${results.length} pages found`)
    job.status = 'done'
    job.results = results
  } catch (e) {
    job.status = 'failed'
    job.error = e.message
  } finally {
    await page.close()
  }
}

function extractPagesFromGraphQL(json, pages) {
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) { obj.forEach(walk); return }

    if (obj.ad_archive_id || obj.adArchiveID) {
      const pageId = String(obj.page_id || obj.pageID || '')
      if (!pageId) return

      const existing = pages.get(pageId) || { name: obj.page_name || obj.pageName || '?', count: 0, earliestDate: null, landing: null }
      existing.count++

      // Earliest date
      if (obj.start_date) {
        const ts = (typeof obj.start_date === 'number' ? obj.start_date : parseInt(obj.start_date)) * 1000
        if (ts && (!existing.earliestDate || ts < existing.earliestDate)) existing.earliestDate = ts
      }

      // Landing URL
      if (!existing.landing) {
        const snap = obj.snapshot || {}
        const link = snap.link_url || snap.cta_link || obj.link_url || ''
        if (link && link.startsWith('http')) existing.landing = link
      }

      pages.set(pageId, existing)
    }

    for (const val of Object.values(obj)) walk(val)
  }

  walk(json)
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ── START ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Scraper] Running on port ${PORT}`)
  console.log(`[Scraper] Chromium: ${CHROMIUM_PATH}`)
  console.log(`[Scraper] Auth: ${SECRET ? 'enabled' : 'DISABLED'}`)
})
