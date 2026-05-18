import express from 'express'
import puppeteer from 'puppeteer-core'
import { randomUUID } from 'crypto'

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const SECRET = process.env.SCRAPER_SECRET || ''
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser'
const PROXY_URL = process.env.PROXY_URL || '' // ex: http://user:pass@host:port

// Parse proxy URL into components for Chrome
let proxyServer = ''
let proxyAuth = null
if (PROXY_URL) {
  try {
    const u = new URL(PROXY_URL)
    proxyServer = `${u.protocol}//${u.hostname}:${u.port}`
    if (u.username) proxyAuth = { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) }
  } catch { proxyServer = PROXY_URL }
}

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
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--single-process',
    '--no-zygote',
    '--lang=pt-BR',
  ]
  if (proxyServer) launchArgs.push(`--proxy-server=${proxyServer}`)
  browserInstance = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: launchArgs,
  })
  return browserInstance
}

// Handle Facebook cookie consent and country selection
async function handleFacebookDialogs(page) {
  await sleep(2000)
  // Accept cookies
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, [role="button"]')]
    const accept = btns.find(b => {
      const t = (b.textContent || '').toLowerCase()
      return t.includes('allow') || t.includes('aceitar') || t.includes('accept') || t.includes('permitir') || t.includes('consent')
    })
    if (accept) accept.click()
  })
  await sleep(1000)
  // Close any popup/modal
  await page.evaluate(() => {
    const close = document.querySelector('[aria-label="Close"], [aria-label="Fechar"]')
    if (close) close.click()
  })
  await sleep(500)
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

async function setupPage(page) {
  if (proxyAuth) await page.authenticate(proxyAuth)
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' })
  await page.setCookie(
    { name: 'datr', value: 'scraper_' + Date.now(), domain: '.facebook.com' },
    { name: 'locale', value: 'pt_BR', domain: '.facebook.com' },
  )

  // Block heavy resources — saves ~80% bandwidth, speeds up page loads
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const type = req.resourceType()
    const url = req.url()
    // Block images, CSS, fonts, media, websockets
    if (['image', 'stylesheet', 'font', 'media', 'texttrack', 'eventsource', 'websocket', 'manifest'].includes(type)) {
      return req.abort()
    }
    // Block Facebook CDN assets (videos, images, static resources)
    if (url.includes('fbcdn.net/v/') || url.includes('scontent') || url.includes('video.')) {
      return req.abort()
    }
    // Block tracking/analytics
    if (url.includes('/tr?') || url.includes('/impression.php') || url.includes('connect.facebook.net/signals') || url.includes('analytics') || url.includes('pixel')) {
      return req.abort()
    }
    // Block non-essential JS (tracking, signals, ads SDK) but ALLOW main React bundle for pagination
    if (type === 'script' && (url.includes('connect.facebook.net') || url.includes('/signals/') || url.includes('/logging/') || url.includes('analytics'))) {
      return req.abort()
    }
    req.continue()
  })
}

async function scrapePageAbout(pageId) {
  // HTTP-only: fetch SSR HTML directly, extract page info from embedded JSON — saves ~10MB per call
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}`
  const result = { page_name: '', fb_followers: null, ig_handle: null, ig_followers: null, category: null, created_date: null }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    })
    const html = await res.text()

    // Extract page name from SSR
    const nameMatch = html.match(/"page_name"\s*:\s*"([^"]+)"/) || html.match(/page_name["\s:]+([^"<,]+)/)
    if (nameMatch) result.page_name = nameMatch[1].replace(/\\u[\dA-Fa-f]{4}/g, m => String.fromCharCode(parseInt(m.slice(2), 16)))

    // Extract IG handle from SSR — look for instagram.com links or @handle patterns
    const igMatch = html.match(/instagram\.com\/([a-zA-Z0-9_.]+)/) || html.match(/"ig_handle"\s*:\s*"([^"]+)"/)
    if (igMatch) result.ig_handle = '@' + igMatch[1]

    // Extract followers from SSR JSON — look for "page_like_count" or "followers_count"
    const likesMatch = html.match(/"page_like_count"\s*:\s*(\d+)/) || html.match(/"likes"\s*:\s*(\d+)/)
    if (likesMatch) result.fb_followers = parseInt(likesMatch[1])

    const igFollowMatch = html.match(/"ig_followers"\s*:\s*(\d+)/) || html.match(/"edge_followed_by.+?count"\s*:\s*(\d+)/)
    if (igFollowMatch) result.ig_followers = parseInt(igFollowMatch[1])

    // Extract category
    const catMatch = html.match(/"page_category"\s*:\s*"([^"]+)"/) || html.match(/"category_name"\s*:\s*"([^"]+)"/)
    if (catMatch) result.category = catMatch[1]

    console.log(`[PageAbout] ${result.page_name || pageId}: FB=${result.fb_followers}, IG=${result.ig_followers} ${result.ig_handle || ''}`)
    return result
  } catch (e) {
    console.log(`[PageAbout] ${pageId}: failed (${e.message})`)
    return result
  }
}

// Extract ads from SSR HTML (Facebook embeds data in script tags)
function extractAdsFromHTML(html) {
  const ads = []
  const seenIds = new Set()

  // Find all JSON blocks in script tags
  const scriptRegex = /\{["\u005c][^<]{500,}?\}/g
  const jsonCandidates = html.match(scriptRegex) || []

  // Also try to find ad_archive_id blocks directly
  const archiveRegex = /"ad_archive_id"\s*:\s*"(\d+)"/g
  let match
  while ((match = archiveRegex.exec(html)) !== null) {
    const id = match[1]
    if (seenIds.has(id)) continue
    seenIds.add(id)

    // Extract surrounding context (up to 5000 chars around the match)
    const start = Math.max(0, match.index - 2000)
    const end = Math.min(html.length, match.index + 3000)
    const context = html.slice(start, end)

    const get = (key) => {
      const m = context.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, 's'))
      return m ? m[1].replace(/\\u[\dA-Fa-f]{4}/g, c => String.fromCharCode(parseInt(c.slice(2), 16))) : ''
    }
    const getNum = (key) => {
      const m = context.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`))
      return m ? parseInt(m[1]) : null
    }

    const pageId = get('page_id') || ''
    const pageName = get('page_name') || ''
    const bodyText = get('body_text') || get('body') || ''
    const title = get('title') || ''
    const ctaText = get('cta_text') || ''
    const linkUrl = get('link_url') || get('cta_link') || ''
    const startDate = getNum('start_date')

    // Extract image URLs
    const images = []
    const imgRegex = /original_image_url"\s*:\s*"(https?:[^"]+)"/g
    let imgMatch
    while ((imgMatch = imgRegex.exec(context)) !== null) {
      images.push({ original_image_url: imgMatch[1].replace(/\\\//g, '/'), resized_image_url: '' })
    }
    const resizedRegex = /resized_image_url"\s*:\s*"(https?:[^"]+)"/g
    while ((imgMatch = resizedRegex.exec(context)) !== null) {
      if (images.length === 0) images.push({ original_image_url: '', resized_image_url: imgMatch[1].replace(/\\\//g, '/') })
    }

    // Extract video URLs
    const videos = []
    const vidHdRegex = /video_hd_url"\s*:\s*"(https?:[^"]+)"/g
    let vidMatch
    while ((vidMatch = vidHdRegex.exec(context)) !== null) {
      videos.push({ video_hd_url: vidMatch[1].replace(/\\\//g, '/'), video_sd_url: '', video_preview_image_url: '' })
    }
    const vidSdRegex = /video_sd_url"\s*:\s*"(https?:[^"]+)"/g
    while ((vidMatch = vidSdRegex.exec(context)) !== null) {
      if (videos.length === 0) videos.push({ video_hd_url: '', video_sd_url: vidMatch[1].replace(/\\\//g, '/'), video_preview_image_url: '' })
    }

    ads.push({
      page_id: pageId,
      page_name: pageName,
      start_date: startDate,
      start_date_formatted: startDate ? new Date(startDate * 1000).toISOString().slice(0, 19).replace('T', ' ') : '',
      snapshot: { body_text: bodyText, title, cta_text: ctaText, link_url: linkUrl, images, videos, cards: [] },
    })
  }

  return ads
}

async function scrapeAds(url, maxAds) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  await setupPage(page)

  const ads = []
  const seenIds = new Set()

  try {
    // Intercept GraphQL responses (still useful for scroll-loaded data)
    page.on('response', async (response) => {
      try {
        const reqUrl = response.url()
        if (!reqUrl.includes('/api/graphql') && !reqUrl.includes('ads_library')) return
        if (response.status() !== 200) return
        const text = await response.text().catch(() => '')
        if (!text || text.length < 500) return
        const newAds = extractAdsFromHTML(text)
        for (const ad of newAds) {
          if (!seenIds.has(ad.page_id + ad.start_date)) {
            seenIds.add(ad.page_id + ad.start_date)
            ads.push(ad)
          }
        }
      } catch { /* ignore */ }
    })

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    await handleFacebookDialogs(page)
    await sleep(3000)

    // Extract from initial SSR HTML
    const html = await page.evaluate(() => document.documentElement?.innerHTML || '')
    const ssrAds = extractAdsFromHTML(html)
    for (const ad of ssrAds) {
      const key = (ad.snapshot?.body_text || '').slice(0, 50) + ad.start_date
      if (!seenIds.has(key)) {
        seenIds.add(key)
        ads.push(ad)
      }
    }
    console.log(`[scrape-ads] SSR: ${ssrAds.length} ads`)

    // Scroll to load more ads
    let lastCount = ads.length
    let staleScrolls = 0
    const maxScrolls = Math.ceil(maxAds / 10) + 5

    for (let i = 0; i < maxScrolls && ads.length < maxAds; i++) {
      await page.evaluate(() => { if (document.body) window.scrollTo(0, document.body.scrollHeight) })
      await sleep(2500)

      // Extract from updated DOM
      const newHtml = await page.evaluate(() => document.documentElement?.innerHTML || '')
      const newAds = extractAdsFromHTML(newHtml)
      for (const ad of newAds) {
        const key = (ad.snapshot?.body_text || '').slice(0, 50) + ad.start_date
        if (!seenIds.has(key)) {
          seenIds.add(key)
          ads.push(ad)
        }
      }

      // Click "Ver mais"
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

    console.log(`[scrape-ads] Total: ${ads.length} ads from ${url.slice(0, 80)}`)
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
  // HTTP-only: fetch SSR HTML directly, no Chromium — saves ~10MB per call
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    })
    const html = await res.text()
    // Try count from text like "Aproximadamente X anúncios"
    const countMatch = html.match(/(?:aproximadamente|approximately|exibindo|~)\s*(\d[\d.,]*)\s*(?:an[uú]ncios|ads|resultados)/i)
    if (countMatch) {
      const count = parseInt(countMatch[1].replace(/[.,]/g, ''))
      console.log(`[count-ads] ${pageId}: ${count}`)
      return count
    }
    // Fallback: count ads from SSR HTML
    const ads = extractAdsFromHTML(html)
    console.log(`[count-ads] ${pageId}: ${ads.length} (SSR)`)
    return ads.length
  } catch (e) {
    console.log(`[count-ads] ${pageId}: failed (${e.message})`)
    return null
  }
}

async function scrapeLanding(url) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  await setupPage(page)

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

  // Chromium with domcontentloaded (skip waiting for JS framework to finish) + resource blocking
  // Loads ~15-20MB instead of ~100MB. No scroll, no enrich — just SSR extraction.
  const browser = await getBrowser()
  const page = await browser.newPage()
  await setupPage(page)

  const pages = new Map() // pageId → { name, count, earliestDate, landing }

  try {
    // Also capture GraphQL responses that arrive during initial load
    page.on('response', async (response) => {
      try {
        const reqUrl = response.url()
        if (!reqUrl.includes('/api/graphql') && !reqUrl.includes('ads_library')) return
        if (response.status() !== 200) return
        const text = await response.text().catch(() => '')
        if (!text || text.length < 500) return
        const ads = extractAdsFromHTML(text)
        for (const ad of ads) {
          if (!ad.page_id) continue
          const existing = pages.get(ad.page_id) || { name: ad.page_name || '?', count: 0, earliestDate: null, landing: null }
          existing.count++
          if (ad.start_date) {
            const ts = ad.start_date * 1000
            if (!existing.earliestDate || ts < existing.earliestDate) existing.earliestDate = ts
          }
          if (!existing.landing && ad.snapshot?.link_url) existing.landing = ad.snapshot.link_url
          pages.set(ad.page_id, existing)
        }
      } catch { /* ignore */ }
    })

    // Capture the initial HTML response directly — avoid waiting for JS framework
    let capturedHtml = ''
    page.on('response', async (resp) => {
      try {
        if (resp.url().includes('/ads/library') && resp.request().resourceType() === 'document') {
          capturedHtml = await resp.text().catch(() => '')
        }
      } catch { /* ignore */ }
    })

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 })
    await handleFacebookDialogs(page)
    await sleep(2000)

    // Use captured HTML (raw SSR, no JS eval needed) or fallback to DOM
    const html = capturedHtml || await page.evaluate(() => document.documentElement?.innerHTML || '')
    const ssrAds = extractAdsFromHTML(html)
    for (const ad of ssrAds) {
      if (!ad.page_id) continue
      const existing = pages.get(ad.page_id) || { name: ad.page_name || '?', count: 0, earliestDate: null, landing: null }
      existing.count++
      if (ad.start_date) {
        const ts = ad.start_date * 1000
        if (!existing.earliestDate || ts < existing.earliestDate) existing.earliestDate = ts
      }
      if (!existing.landing && ad.snapshot?.link_url) existing.landing = ad.snapshot.link_url
      pages.set(ad.page_id, existing)
    }
    console.log(`[mine] SSR: ${ssrAds.length} ads, ${pages.size} pages`)

    // Scroll to load more — JS is blocked so each scroll just triggers GraphQL JSON (~50-100KB)
    let lastSize = pages.size
    let staleScrolls = 0
    for (let i = 0; i < 15 && pages.size < count; i++) {
      await page.evaluate(() => { if (document.body) window.scrollTo(0, document.body.scrollHeight) }).catch(() => {})
      await sleep(2000)
      if (pages.size === lastSize) {
        staleScrolls++
        if (staleScrolls >= 3) break
      } else {
        staleScrolls = 0
        lastSize = pages.size
      }
    }
    if (pages.size > ssrAds.length) console.log(`[mine] After scroll: ${pages.size} pages (was ${ssrAds.length} from SSR)`)

    // Convert to preliminary results
    const now = Date.now()
    const preliminary = Array.from(pages.entries())
      .filter(([id]) => /^\d+$/.test(id)) // only numeric page IDs (real pages)
      .map(([pageId, info]) => ({
        pagina_nome: info.name,
        page_id: pageId,
        total_anuncios: info.count,
        dias_rodando: info.earliestDate ? Math.floor((now - info.earliestDate) / 86400000) : null,
        landing_url: info.landing,
      }))

    console.log(`[mine] "${keyword}": ${preliminary.length} pages found (no enrich — using scroll data directly)`)

    // Skip enrich — ad counts from scroll are accurate enough, saves ~300MB bandwidth per mine
    // Followers will be checked later by the filter-followers cron (uses Chromium only for ouro candidates)
    const results = preliminary.slice(0, 60).map(p => ({
      ...p,
      fb_followers: null,
      ig_followers: null,
      ig_handle: null,
    }))

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
  console.log(`[Scraper] Proxy: ${PROXY_URL ? PROXY_URL.replace(/\/\/.*@/, '//***@') : 'NONE'}`)
})
