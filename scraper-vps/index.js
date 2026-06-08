import 'dotenv/config'
import express from 'express'
import puppeteerExtra from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import puppeteerCore from 'puppeteer-core'
import { randomUUID } from 'crypto'

// Apply stealth plugin to puppeteer-extra, use puppeteer-core as base
puppeteerExtra.use(StealthPlugin())
const puppeteer = puppeteerExtra
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)

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

// Proxy agent for HTTP fetch (enrich) — usa undici que vem com Node 20
function getProxyAgent() {
  if (!PROXY_URL) return null
  return new ProxyAgent(PROXY_URL)
}

// Auth middleware
function auth(req, res, next) {
  if (!SECRET) return next()
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (token !== SECRET) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

app.use(auth)

// ── INSTAGRAM FOLLOWERS via curl (Node.js fetch gets login page) ──
async function fetchInstagramFollowers(handle) {
  const igUser = handle.replace('@', '')
  try {
    const { stdout } = await execFileAsync('curl', [
      '-s', '-L', '--compressed', '--max-time', '8',
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      '-H', 'Accept-Language: en-US,en;q=0.5',
      '-H', 'Accept-Encoding: gzip, deflate, br',
      '-H', 'Sec-Fetch-Dest: document',
      '-H', 'Sec-Fetch-Mode: navigate',
      '-H', 'Sec-Fetch-Site: none',
      '-H', 'Sec-Fetch-User: ?1',
      `https://www.instagram.com/${igUser}/`,
    ], { timeout: 12000, maxBuffer: 2 * 1024 * 1024, windowsHide: true })

    // Meta tag: "X Followers, Y Following, Z Posts"
    const metaMatch = stdout.match(/content="([\d.,]+[KkMm]?)\s*Followers/i)
    if (metaMatch) {
      let igNum = parseFloat(metaMatch[1].replace(/,/g, ''))
      if (/[Kk]/.test(metaMatch[1])) igNum *= 1000
      if (/[Mm]/.test(metaMatch[1])) igNum *= 1000000
      return Math.round(igNum)
    }
    // Fallback: JSON
    const fcMatch = stdout.match(/"follower_count"\s*:\s*(\d+)/)
    if (fcMatch) return parseInt(fcMatch[1])
  } catch {}
  return null
}

// Browser pool — reuse browser instance
let browserInstance = null
let useWarpProxy = false // Começa com IP residencial (melhor pro Facebook), WARP como fallback
const WARP_PROXY = 'socks5://localhost:40000'

async function getBrowser() {
  if (browserInstance && browserInstance.connected) return browserInstance
  const isWindows = process.platform === 'win32'
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-background-networking',
    '--lang=pt-BR',
    // Anti-detection: hide automation indicators
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1920,1080',
    // single-process e no-zygote só no Linux (VPS) — no Windows causa crash
    ...(isWindows ? [] : ['--single-process', '--no-zygote']),
  ]
  if (useWarpProxy) {
    launchArgs.push(`--proxy-server=${WARP_PROXY}`)
    console.log(`[browser] Launching with WARP proxy`)
  } else if (proxyServer) {
    launchArgs.push(`--proxy-server=${proxyServer}`)
  }
  browserInstance = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: 'new',
    args: launchArgs,
  })
  return browserInstance
}

// Browser com perfil persistente (pra manter login do Facebook)
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FB_PROFILE_DIR = path.join(__dirname, '.fb-profile')
let fbBrowserInstance = null

async function getFbBrowser(headless = true) {
  if (fbBrowserInstance && fbBrowserInstance.connected) return fbBrowserInstance
  const isWindows = process.platform === 'win32'
  fbBrowserInstance = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless,
    userDataDir: FB_PROFILE_DIR,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--lang=pt-BR',
      ...(isWindows ? [] : ['--single-process', '--no-zygote']),
    ],
  })
  return fbBrowserInstance
}

// Endpoint pra login manual no Facebook (abre browser visível)
app.get('/fb-login', async (req, res) => {
  try {
    // Fecha browser existente pra abrir visível
    if (fbBrowserInstance) { await fbBrowserInstance.close().catch(() => {}); fbBrowserInstance = null }
    const browser = await getFbBrowser(false) // headless=false = visível
    const page = await browser.newPage()
    await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded' })
    res.json({ ok: true, message: 'Chrome aberto! Faz login no Facebook e depois chama /fb-login-done' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/fb-login-done', async (req, res) => {
  try {
    // Fecha browser visível, vai reabrir headless na próxima vez
    if (fbBrowserInstance) { await fbBrowserInstance.close().catch(() => {}); fbBrowserInstance = null }
    res.json({ ok: true, message: 'Login salvo! Cookies persistidos em .fb-profile/' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

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
  // Close "Desativar bloqueador de anúncios" modal (clicks OK)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, [role="button"]')]
    const ok = btns.find(b => {
      const t = (b.textContent || '').trim()
      return t === 'OK' || t === 'Ok'
    })
    if (ok) ok.click()
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

// ── DEBUG: Test "Sobre" click ──
app.post('/debug-sobre', async (req, res) => {
  const { pageId } = req.body
  if (!pageId) return res.status(400).json({ error: 'pageId required' })
  try {
    const browser = await getFbBrowser() // usa browser com cookies do Facebook
    const page = await browser.newPage()
    await setupPage(page)
    const pageUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}`
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await sleep(3000)

    // Find clickable elements with "Sobre"
    const clickables = await page.evaluate(() => {
      const all = [...document.querySelectorAll('a, span, div[role="tab"], div[role="button"], div[role="link"]')]
      return all
        .filter(el => el.textContent?.trim().length < 20)
        .map(el => ({ tag: el.tagName, role: el.getAttribute('role'), text: el.textContent?.trim(), href: el.getAttribute('href') }))
        .filter(el => el.text && /sobre|about/i.test(el.text))
    })
    console.log('[debug] Sobre candidates:', JSON.stringify(clickables))

    // Try clicking
    const clicked = await page.evaluate(() => {
      const all = [...document.querySelectorAll('a, span, div[role="tab"], div[role="button"], div[role="link"]')]
      const sobre = all.find(el => /^Sobre$/i.test(el.textContent?.trim() || ''))
      if (sobre) { sobre.click(); return { tag: sobre.tagName, text: sobre.textContent?.trim() } }
      // Try "About"
      const about = all.find(el => /^About$/i.test(el.textContent?.trim() || ''))
      if (about) { about.click(); return { tag: about.tagName, text: about.textContent?.trim() } }
      return null
    })
    console.log('[debug] Clicked:', clicked)

    // Wait for transparency section to load
    for (let wait = 0; wait < 5; wait++) {
      await sleep(2000)
      const hasTransparency = await page.evaluate(() => {
        const text = document.body?.innerText || ''
        return text.includes('Transparência') || text.includes('Transparency') || text.includes('seguidores') || text.includes('followers')
      })
      if (hasTransparency) { console.log('[debug] Transparency loaded after', (wait+1)*2, 'sec'); break }
    }

    const html = await page.evaluate(() => document.documentElement?.innerHTML || '')
    const bodyText = await page.evaluate(() => document.body?.innerText || '')

    // Look for Instagram mentions in rendered text
    const igMentions = [...bodyText.matchAll(/@([a-zA-Z0-9_.]{2,30})/g)].map(m => m[1]).filter(h => h.length > 2)
    const seguidores = [...bodyText.matchAll(/([\d.,]+)\s*(?:mil|mi)?\s*seguidores/gi)].map(m => m[0])

    // Check for transparency section
    const hasTransp = bodyText.includes('Transparência') || bodyText.includes('Transparency')
    const hasPaginas = bodyText.includes('Páginas e contas') || bodyText.includes('Pages and accounts')

    // Extract the about section text (between "Sobre o anunciante" and "Ir para a Página")
    const aboutSection = bodyText.match(/(?:Sobre o anunciante|About this advertiser)[\s\S]{0,3000}(?:Ir para a Página|Go to Page)/i)

    // Try navigating to FB page directly for IG links
    let fbPageHandles = []
    let fbPageSeguidores = []
    try {
      await page.goto('https://www.facebook.com/' + pageId, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await sleep(4000)
      const fbHtml = await page.evaluate(() => document.documentElement?.innerHTML || '')
      const fbText = await page.evaluate(() => document.body?.innerText || '')
      const igBL = ['p','reel','reels','explore','stories','accounts','about','login','_n','_u','share','direct','developer','legal','help','tags']
      const fbIg = [...fbHtml.matchAll(/instagram\.com\/([a-zA-Z0-9_.]{2,30})/gi)]
      fbPageHandles = [...new Set(fbIg.map(m => m[1]).filter(h => !igBL.includes(h)))]
      fbPageSeguidores = [...fbText.matchAll(/([\d.,]+)\s*(?:mil|mi|k|m)?\s*(?:seguidores|followers)/gi)].map(m => m[0])
    } catch (e) {
      console.log('[debug] FB page error:', e.message)
    }

    await page.close().catch(() => {})
    res.json({
      clicked,
      hasTransp, hasPaginas,
      fbPageHandles,
      fbPageSeguidores,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── SCRAPE-ADS ──
app.post('/scrape-ads', async (req, res) => {
  const { url, maxAds = 80 } = req.body
  if (!url) return res.status(400).json({ error: 'url required' })

  try {
    const result = await scrapeAds(url, maxAds)
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

  // Run in background with auto-recovery on block
  runMineWithRecovery(jobId, keyword, count).catch(e => {
    console.error('[mine] Job failed:', e.message)
    const job = jobs.get(jobId)
    if (job) { job.status = 'failed'; job.error = e.message }
  })

  res.json({ jobId })
})

// Mine com auto-recovery: se retorna 0 resultados, tenta recuperar e re-minerar
async function runMineWithRecovery(jobId, keyword, count) {
  await runMineJob(jobId, keyword, count)
  const job = jobs.get(jobId)
  // Se retornou 0 resultados e job deu "done", pode ser bloqueio
  if (job && job.status === 'done' && job.results && job.results.length === 0) {
    console.log(`[mine] "${keyword}": 0 results — checking if blocked...`)
    const isBlocked = !(await testFacebookAccess())
    if (isBlocked) {
      console.log(`[mine] BLOCKED confirmed. Running auto-recovery...`)
      job.status = 'running' // volta pra running enquanto recupera
      const recovered = await autoRecover()
      if (recovered) {
        console.log(`[mine] Recovered! Re-mining "${keyword}"...`)
        await runMineJob(jobId, keyword, count)
      } else {
        console.log(`[mine] Recovery failed for "${keyword}"`)
        job.status = 'done'
        job.results = []
      }
    }
  }
}

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
  const m = text.match(/([\d.,]+)\s*(mil|milhão|milhões)?/i)
  if (!m) return null
  let num = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  if (m[2] && /milh/i.test(m[2])) num *= 1000000
  else if (m[2] && /mil/i.test(m[2])) num *= 1000
  return Math.round(num)
}

async function setupPage(page) {
  if (proxyAuth) await page.authenticate(proxyAuth)
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36')
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' })
  await page.setCookie(
    { name: 'locale', value: 'pt_BR', domain: '.facebook.com' },
  )

  // Anti-detection: override navigator.webdriver and other bot indicators
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] })
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
    // Chrome runtime
    window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} }
    // Permissions
    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
  })
  await page.setViewport({ width: 1920, height: 1080 })

  // Block heavy resources — saves ~80% bandwidth, speeds up page loads
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const type = req.resourceType()
    const url = req.url()
    // Minimal blocking — Facebook detects aggressive blocking as adblocker
    // Only block video/media files which are heavy and unnecessary for scraping
    if (['media', 'texttrack', 'eventsource', 'websocket', 'manifest'].includes(type)) {
      return req.abort()
    }
    // Block video CDN (huge files)
    if (url.includes('video.xx.fbcdn.net') || (type === 'media' && url.includes('fbcdn'))) {
      return req.abort()
    }
    req.continue()
  })
}

async function scrapePageAbout(pageId) {
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}`
  const result = { page_name: '', fb_followers: null, ig_handle: null, ig_followers: null, category: null, created_date: null }

  // Step 1: HTTP fetch for basic data (page_name, fb_followers, category)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    })
    const html = await res.text()

    const nameMatch = html.match(/"page_name"\s*:\s*"([^"]+)"/)
    if (nameMatch) result.page_name = nameMatch[1].replace(/\\u[\dA-Fa-f]{4}/g, m => String.fromCharCode(parseInt(m.slice(2), 16)))

    const likesMatch = html.match(/"page_like_count"\s*:\s*(\d+)/)
    if (likesMatch) result.fb_followers = parseInt(likesMatch[1])

    const catMatch = html.match(/"page_category"\s*:\s*"([^"]+)"/) || html.match(/"category_name"\s*:\s*"([^"]+)"/)
    if (catMatch) result.category = catMatch[1]

    // Try IG handle from SSR (sometimes present)
    const igMatch = html.match(/instagram\.com\/([a-zA-Z0-9_.]{2,30})/)
    if (igMatch) result.ig_handle = '@' + igMatch[1]
  } catch (e) {
    console.log(`[PageAbout] ${pageId}: HTTP failed (${e.message})`)
  }

  // Step 2: Browser + "Sobre" click to get IG handle + followers (the reliable way)
  // Always run browser if HTTP didn't get basic data OR if IG is still missing
  if (!result.ig_handle || !result.page_name) {
    try {
      const browser = await getFbBrowser()
      const page = await browser.newPage()
      await setupPage(page)
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
      await sleep(2000)

      // Get page name from browser HTML JSON (more reliable than heading element)
      if (!result.page_name) {
        const name = await page.evaluate(() => {
          const html = document.documentElement?.innerHTML || ''
          const m = html.match(/"page_name"\s*:\s*"([^"]+)"/)
          if (m) return m[1].replace(/\\u[\dA-Fa-f]{4}/g, c => String.fromCharCode(parseInt(c.slice(2), 16)))
          // Fallback: heading that's not generic
          const headings = [...document.querySelectorAll('h1, [role="heading"]')]
          for (const h of headings) {
            const t = h.textContent?.trim() || ''
            if (t && t.length > 2 && !t.includes('Selecionar') && !t.includes('Biblioteca')) return t
          }
          return ''
        }).catch(() => '')
        if (name) result.page_name = name
      }

      // Get FB followers + category from browser HTML if HTTP failed
      if (!result.fb_followers) {
        const html = await page.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')
        const likeM = html.match(/"page_like_count"\s*:\s*(\d+)/)
        if (likeM) result.fb_followers = parseInt(likeM[1])
        if (!result.category) {
          const catM = html.match(/"page_category"\s*:\s*"([^"]+)"/)
          if (catM) result.category = catM[1]
        }
      }

      // Click "Sobre" tab — Facebook uses div[role="link"] for this
      const sobreClicked = await page.evaluate(() => {
        const all = [...document.querySelectorAll('*')]
        const sobre = all.find(el => el.textContent?.trim() === 'Sobre' && el.childElementCount === 0)
          || all.find(el => el.textContent?.trim() === 'About' && el.childElementCount === 0)
        if (sobre) { sobre.click(); return true }
        return false
      })

      if (sobreClicked) {
        // Wait for transparency section to render
        for (let w = 0; w < 5; w++) {
          await sleep(1500)
          const ready = await page.evaluate(() => {
            const t = document.body?.innerText || ''
            return t.includes('seguidores') || t.includes('followers') || t.includes('Transparência')
          })
          if (ready) break
        }

        // Parse innerText — much more reliable than HTML regex
        // Facebook "Sobre" layout: FB icon → @fb_handle → "X seguidores · Categoria" → IG icon → @ig_handle → "X seguidores"
        // The SECOND @handle is always IG (first is FB)
        const data = await page.evaluate(() => {
          const text = document.body?.innerText || ''
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
          const handles = []

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (line.match(/^@[a-zA-Z0-9_.]{2,30}$/)) {
              let followers = null
              for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                if (lines[j].match(/seguidor|follower/i)) { followers = lines[j]; break }
              }
              handles.push({ handle: line, followers, lineIndex: i })
            }
          }

          // 2 handles: first = FB, second = IG
          // 1 handle: it's the IG (FB pages with only IG linked)
          // 0 handles: no social linked
          let igH = null, igF = null, fbH = null, fbF = null
          if (handles.length >= 2) {
            fbH = handles[0].handle; fbF = handles[0].followers
            igH = handles[1].handle; igF = handles[1].followers
          } else if (handles.length === 1) {
            // Single handle — treat as IG (most common: page only has IG linked)
            igH = handles[0].handle; igF = handles[0].followers
          }

          return {
            igHandle: igH,
            igFollowers: igF,
            fbHandle: fbH,
            fbFollowers: fbF,
            handleCount: handles.length,
          }
        })

        if (data.igHandle) {
          result.ig_handle = data.igHandle
          if (data.igFollowers) {
            result.ig_followers = parseFollowers(data.igFollowers)
          }
        }

        // FB followers from the first handle's followers line
        if (!result.fb_followers && data.fbFollowers) {
          result.fb_followers = parseFollowers(data.fbFollowers)
        }
      }

      await page.close().catch(() => {})
    } catch (e) {
      console.log(`[PageAbout] ${pageId}: browser failed (${e.message})`)
    }
  }

  console.log(`[PageAbout] ${result.page_name || pageId}: FB=${result.fb_followers}, IG=${result.ig_followers} ${result.ig_handle || ''}`)
  return result
}

// Extract ads from SSR HTML (Facebook embeds data in script tags)
function extractAdsFromHTML(html) {
  const ads = []
  const seenIds = new Set()

  // 1. Construir mapa page_id → page_name confiável
  //    Busca pares page_id/page_name que estão próximos (< 300 chars)
  const pageNameMap = new Map()
  const pidRegex = /"page_id"\s*:\s*"(\d+)"/g
  let pidMatch
  while ((pidMatch = pidRegex.exec(html)) !== null) {
    const pid = pidMatch[1]
    if (pageNameMap.has(pid)) continue
    // Busca page_name dentro de 300 chars depois do page_id
    const nearby = html.slice(pidMatch.index, pidMatch.index + 300)
    const nameM = nearby.match(/"page_name"\s*:\s*"([^"]+)"/)
    if (nameM) {
      const decoded = nameM[1].replace(/\\u[\dA-Fa-f]{4}/g, c => String.fromCharCode(parseInt(c.slice(2), 16)))
      pageNameMap.set(pid, decoded)
    }
  }

  // 2. Extrair ads
  const archiveRegex = /"ad_archive_id"\s*:\s*"(\d+)"/g
  let match
  while ((match = archiveRegex.exec(html)) !== null) {
    const id = match[1]
    if (seenIds.has(id)) continue
    seenIds.add(id)

    // Context: 500 chars antes + 4000 depois (body text pode ser longo)
    const start = Math.max(0, match.index - 500)
    const end = Math.min(html.length, match.index + 4000)
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
    // Usar o mapa confiável pra nome, fallback pro context
    const pageName = pageNameMap.get(pageId) || get('page_name') || ''
    // body vem em vários formatos: "body_text":"...", "body":"...", ou "body":{"markup":{"__html":"..."}}
    const bodyText = get('body_text') || get('body') || (() => {
      const htmlM = context.match(/"__html"\s*:\s*"([^"]*)"/)
      return htmlM ? htmlM[1].replace(/\\u[\dA-Fa-f]{4}/g, c => String.fromCharCode(parseInt(c.slice(2), 16))).replace(/<[^>]+>/g, '') : ''
    })()
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
  // Browser dedicado com perfil FB separado (não compete com auto-mine)
  const isWindows = process.platform === 'win32'
  const analyzeProfileDir = path.join(__dirname, '.fb-profile-analyze')
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: 'new',
    userDataDir: analyzeProfileDir,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--lang=pt-BR', '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      ...(isWindows ? [] : ['--single-process', '--no-zygote']),
    ],
  })
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

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await handleFacebookDialogs(page)
    await sleep(3000)

    // Handle challenge if needed
    let initHtml = await page.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')
    if (initHtml.includes('__rd_verify') || initHtml.includes('executeChallenge')) {
      console.log(`[scrape-ads] Challenge detected, waiting...`)
      try { await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }) } catch {}
      await sleep(3000)
    }

    // Wait for ads to render in DOM
    try {
      await page.waitForSelector('[class*="ad"], [data-ad], [aria-label*="anúncio"]', { timeout: 10000 })
    } catch {
      console.log('[scrape-ads] No ad elements found, continuing...')
    }
    await sleep(3000)

    // Count archive IDs to track scroll progress (don't extract yet — do it once at the end)
    function countArchiveIds(h) {
      const ids = new Set()
      const re = /"ad_archive_id"\s*:\s*"(\d+)"/g
      let m
      while ((m = re.exec(h)) !== null) ids.add(m[1])
      return ids.size
    }

    const initHtml2 = await page.evaluate(() => document.documentElement?.innerHTML || '')
    let currentCount = countArchiveIds(initHtml2)
    console.log(`[scrape-ads] Initial: ${currentCount} archive IDs`)

    // Scroll to load all ads
    let staleScrolls = 0
    const maxScrolls = Math.ceil(maxAds / 10) + 5

    for (let i = 0; i < maxScrolls && currentCount < maxAds; i++) {
      await page.evaluate(() => { if (document.body) window.scrollTo(0, document.body.scrollHeight) })
      await sleep(3000)

      const scrollHtml = await page.evaluate(() => document.documentElement?.innerHTML || '')
      const newCount = countArchiveIds(scrollHtml)

      if (newCount > currentCount) {
        console.log(`[scrape-ads] Scroll ${i+1}: ${currentCount} -> ${newCount} ads`)
        staleScrolls = 0
        currentCount = newCount
      } else {
        staleScrolls++
        if (staleScrolls >= 3) break
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
    }

    // Extract all ads from final DOM (after all scrolling)
    const finalHtml = await page.evaluate(() => document.documentElement?.innerHTML || '')
    const allExtracted = extractAdsFromHTML(finalHtml)
    for (const ad of allExtracted) ads.push(ad)
    // Also add any from GraphQL interceptor that weren't in HTML
    console.log(`[scrape-ads] Final extraction: ${allExtracted.length} from HTML, ${ads.length} total (incl GraphQL)`)

    // Enrich ads with body text and images from rendered DOM
    // Facebook hides these from SSR HTML — only available after JS renders
    const domAds = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="result"], [class*="_7jvw"], div[class*="x1lliihq"]')
      const results = []
      // Find ad containers — each contains body text, title, image/video
      const allDivs = [...document.querySelectorAll('div')]
      const adContainers = allDivs.filter(d => {
        const text = d.innerText || ''
        // Ad containers have "Active" or "Ativo" status and body text
        return (text.includes('Active') || text.includes('Ativo') || text.includes('Inativo')) &&
               text.length > 50 && text.length < 5000 &&
               d.querySelector('img')
      }).slice(0, 60)

      for (const container of adContainers) {
        // Body text: largest text block in the container
        const textNodes = [...container.querySelectorAll('div, span, p')]
          .map(n => ({ text: (n.innerText || '').trim(), len: (n.innerText || '').trim().length }))
          .filter(n => n.len > 30 && n.len < 2000)
          .sort((a, b) => b.len - a.len)
        const bodyText = textNodes[0]?.text || ''

        // Images
        const imgs = [...container.querySelectorAll('img')]
          .map(img => img.src)
          .filter(s => s && s.startsWith('http') && !s.includes('emoji') && !s.includes('profile') && s.includes('fbcdn'))
          .slice(0, 3)

        // Videos
        const vids = [...container.querySelectorAll('video, video source')]
          .map(v => v.src || '')
          .filter(Boolean)
          .slice(0, 1)

        if (bodyText || imgs.length > 0) {
          results.push({ bodyText, imgs, vids })
        }
      }
      return results
    }).catch(() => [])

    // Merge DOM-extracted data into ads
    if (domAds.length > 0) {
      console.log(`[scrape-ads] DOM enrichment: ${domAds.length} ad containers found`)
      for (let i = 0; i < Math.min(ads.length, domAds.length); i++) {
        const snap = ads[i].snapshot || {}
        // Fill body_text if empty
        if (!snap.body_text && domAds[i].bodyText) {
          snap.body_text = domAds[i].bodyText
        }
        // Fill images if empty
        if ((!snap.images || snap.images.length === 0) && domAds[i].imgs.length > 0) {
          snap.images = domAds[i].imgs.map(u => ({ original_image_url: u, resized_image_url: u }))
        }
        // Fill videos if empty
        if ((!snap.videos || snap.videos.length === 0) && domAds[i].vids.length > 0) {
          snap.videos = domAds[i].vids.map(u => ({ video_hd_url: u, video_sd_url: u, video_preview_image_url: '' }))
        }
        ads[i].snapshot = snap
      }
    }

    console.log(`[scrape-ads] Total: ${ads.length} ads from ${url.slice(0, 80)}`)
    return { ads: ads.slice(0, maxAds) }
  } finally {
    await page.close().catch(() => {})
    await browser.close().catch(() => {})
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
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
  const browser = await getFbBrowser()
  const page = await browser.newPage()
  await setupPage(page)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await sleep(2500)

    const data = await page.evaluate(() => {
      const title = document.title || ''
      const text = (document.body?.innerText || '').slice(0, 12000)
      const html = document.documentElement?.innerHTML || ''

      const images = [...document.querySelectorAll('img')].map(i => {
        const src = i.src || i.dataset?.src || ''
        if (!src.startsWith('http')) return null
        const alt = (i.alt || '').toLowerCase()
        const parents = []
        let el = i.parentElement
        for (let j = 0; j < 4; j++) {
          if (!el) break
          parents.push(((el.className || '') + ' ' + (el.id || '')).toLowerCase())
          el = el.parentElement
        }
        return { src, alt, ctx: parents.join(' ') }
      }).filter(Boolean).slice(0, 15)

      const videos = [...document.querySelectorAll('video, video source, source')]
        .map(v => v.src || v.dataset?.src || '').filter(Boolean).slice(0, 5)

      const headings = [...document.querySelectorAll('h1,h2,h3,h4')]
        .map(h => h.innerText?.trim()).filter(Boolean).slice(0, 20)

      const bullets = [...document.querySelectorAll('li')]
        .map(l => l.innerText?.trim()).filter(t => t && t.length > 10 && t.length < 200).slice(0, 20)

      const ctas = [...document.querySelectorAll('button,a')]
        .map(el => el.innerText?.trim()).filter(t => t && t.length > 2 && t.length < 60).slice(0, 10)

      const prices = (text.match(/R\$\s*[\d.,]+/g) || []).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6)

      const colors = (() => {
        const cols = new Set()
        document.querySelectorAll('[style]').forEach(el => {
          (el.getAttribute('style') || '').match(/#[0-9a-fA-F]{3,6}/g)?.forEach(c => cols.add(c))
        })
        try {
          ;[...document.styleSheets].forEach(ss => {
            try { [...ss.cssRules].forEach(r => { if (r.cssText) (r.cssText.match(/#[0-9a-fA-F]{3,6}/g) || []).forEach(c => cols.add(c)) }) } catch {}
          })
        } catch {}
        return [...cols].slice(0, 20)
      })()

      // OG/Twitter images
      const ogImage = document.querySelector('meta[property="og:image"]')?.content || ''
      const twitterImage = document.querySelector('meta[name="twitter:image"]')?.content || ''

      return { title, text, html: html.slice(0, 25000), images, videos, headings, bullets, ctas, prices, colors, ogImage, twitterImage }
    })

    return data
  } finally {
    await page.close()
  }
}

async function runMineJob(jobId, keyword, count) {
  const job = jobs.get(jobId)
  const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(keyword)}&search_type=keyword_unordered`

  // Usa browser com perfil FB pra evitar challenges
  const browser = await getFbBrowser()
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

    // Load page — use domcontentloaded to not wait for JS framework
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

    // Detect and handle Facebook challenge (POST + reload)
    let html = await page.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')
    if (html.includes('__rd_verify') || html.includes('executeChallenge')) {
      console.log(`[mine] Challenge detected, waiting for resolution...`)
      // Challenge does fetch POST then window.location.reload() — wait for the reload
      try {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 })
      } catch { /* timeout = challenge didn't reload */ }
      await sleep(2000)
      // Check for second challenge (Facebook sometimes chains them)
      html = await page.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')
      if (html.includes('__rd_verify') || html.includes('executeChallenge')) {
        console.log(`[mine] Second challenge, waiting again...`)
        try {
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 })
        } catch {}
        await sleep(2000)
      }
    }

    // Wait for React to render ads (Facebook Ad Library is a SPA now)
    await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {})
    await handleFacebookDialogs(page)
    // Wait for ad results to appear in DOM
    try {
      await page.waitForSelector('[class*="ad"], [data-ad], [aria-label*="anúncio"], [aria-label*="Ad "]', { timeout: 10000 })
      console.log(`[mine] Ad elements found in DOM`)
    } catch {
      console.log(`[mine] No ad elements found after 10s, continuing with SSR data...`)
    }
    await sleep(3000)

    // Extract from captured SSR HTML first
    let ssrAds = capturedHtml ? extractAdsFromHTML(capturedHtml) : []
    const ssrCount = ssrAds.length

    // Also extract from rendered DOM (catches JS-hydrated ads not in SSR)
    const domHtml = await page.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')
    if (domHtml) {
      const domAds = extractAdsFromHTML(domHtml)
      const seen = new Set(ssrAds.map(a => a.page_id + ':' + a.start_date))
      for (const ad of domAds) {
        const key = ad.page_id + ':' + ad.start_date
        if (!seen.has(key)) { ssrAds.push(ad); seen.add(key) }
      }
    }
    if (ssrAds.length > ssrCount) console.log(`[mine] DOM gave ${ssrAds.length - ssrCount} extra ads beyond SSR`)

    // Se ainda vazio, esperar mais e tentar de novo
    if (ssrAds.length === 0) {
      console.log(`[mine] No ads found, waiting 5s more...`)
      // Debug: checar o que o DOM tem
      const debugText = await page.evaluate(() => {
        const text = document.body?.innerText || ''
        return text.slice(0, 500)
      }).catch(() => '')
      const hasArchiveId = (domHtml || '').includes('ad_archive_id')
      const hasNoResults = debugText.includes('Nenhum an') || debugText.includes('No ads')
      console.log(`[mine] DEBUG: ad_archive_id in HTML: ${hasArchiveId}, noResults: ${hasNoResults}, bodyText: ${debugText.slice(0, 200)}`)
      await sleep(5000)
      html = await page.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')
      ssrAds = extractAdsFromHTML(html)
    }

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

    // Scroll to load more — extract from DOM each scroll (GraphQL listener alone misses ads)
    let lastSize = pages.size
    let staleScrolls = 0
    for (let i = 0; i < 30 && pages.size < count; i++) {
      await page.evaluate(() => { if (document.body) window.scrollTo(0, document.body.scrollHeight) }).catch(() => {})
      await sleep(3500)
      // Extract ads from updated DOM after scroll
      const scrollHtml = await page.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')
      if (scrollHtml) {
        const scrollAds = extractAdsFromHTML(scrollHtml)
        for (const ad of scrollAds) {
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
      }
      // Clicar "Ver mais" se existir
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, [role="button"], a')]
        const more = btns.find(b => {
          const t = (b.textContent || '').toLowerCase()
          return t.includes('ver mais') || t.includes('see more') || t.includes('mostrar mais')
        })
        if (more) more.click()
      }).catch(() => {})
      if (pages.size === lastSize) {
        staleScrolls++
        if (staleScrolls >= 5) break
      } else {
        staleScrolls = 0
        lastSize = pages.size
      }
    }
    if (pages.size > ssrCount) console.log(`[mine] After scroll: ${pages.size} pages (was ${ssrCount} from SSR)`)

    // Convert to preliminary results
    const now = Date.now()
    const preliminary = Array.from(pages.entries())
      .filter(([id]) => /^\d+$/.test(id)) // only numeric page IDs (real pages)
      .map(([pageId, info]) => {
        let dias = info.earliestDate ? Math.floor((now - info.earliestDate) / 86400000) : null
        // Bug fix: start_date em formato errado gera valores absurdos (ex: 20389 dias)
        if (dias !== null && (dias < 0 || dias > 3650)) dias = null
        return {
          pagina_nome: info.name,
          page_id: pageId,
          total_anuncios: info.count,
          keyword_hits: info.count, // quantas vezes apareceu na busca por keyword
          dias_rodando: dias,
          landing_url: info.landing,
        }
      })

    // Pegar contagem real via browser (navega, lê "~X resultados", fecha)
    const toCount = preliminary.filter(p => p.keyword_hits >= 1).slice(0, 30)
    console.log(`[mine] "${keyword}": ${preliminary.length} pages, ${toCount.length} with 1+ keyword hits, counting real ads...`)

    const countPage = await browser.newPage()
    await setupPage(countPage)
    for (const p of toCount) {
      try {
        const pageUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${p.page_id}`
        await countPage.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await sleep(3000)
        const html = await countPage.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')
        // Pegar "Aproximadamente X anúncios" ou contar ad_archive_ids
        const approxMatch = html.match(/(?:aproximadamente|approximately|exibindo|~)\s*(\d[\d.,]*)\s*(?:an[uú]ncios|ads|resultados)/i)
        let realCount = approxMatch ? parseInt(approxMatch[1].replace(/[.,]/g, '')) : 0
        if (!realCount) {
          const ids = new Set()
          const m = html.matchAll(/"ad_archive_id"\s*:\s*"(\d+)"/g)
          for (const x of m) ids.add(x[1])
          realCount = ids.size
        }
        // Corrigir page_name
        const nameMatch = html.match(/"page_name"\s*:\s*"([^"]+)"/)
        if (nameMatch) {
          const decoded = nameMatch[1].replace(/\\u[\dA-Fa-f]{4}/g, c => String.fromCharCode(parseInt(c.slice(2), 16)))
          if (decoded && decoded.length > 1) p.pagina_nome = decoded
        }
        // ── EXTRAIR SEGUIDORES ──
        // 1. FB followers: page_like_count do JSON no HTML (SSR ou browser)
        const fullHtml = await countPage.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')
        const likeM = (html + fullHtml).match(/"page_like_count"\s*:\s*(\d+)/)
        if (likeM) p.fb_followers = parseInt(likeM[1])

        // 2. IG handle + followers: clicar "Sobre" na Ad Library (mais confiável)
        try {
          const sobreClicked = await countPage.evaluate(() => {
            const links = [...document.querySelectorAll('a, span, div[role="tab"], div[role="button"]')]
            const sobre = links.find(el => /^Sobre$/i.test(el.textContent?.trim() || ''))
            if (sobre) { sobre.click(); return true }
            return false
          })
          if (sobreClicked) {
            await sleep(2000)
            const aboutHtml = await countPage.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')
            // Procurar padrão: @handle + "X,X mil seguidores" ou "X seguidores" perto de ícone Instagram
            const igAboutMatch = aboutHtml.match(/@([a-zA-Z0-9_.]{2,30})\s*(?:<[^>]*>)*\s*(?:<[^>]*>)*\s*([\d.,]+)\s*(?:mil|mi|K|M)?\s*seguidores/i)
            if (igAboutMatch) {
              p.ig_handle = '@' + igAboutMatch[1]
              let igNum = parseFloat(igAboutMatch[2].replace(/\./g, '').replace(',', '.'))
              const multiplier = aboutHtml.slice(aboutHtml.indexOf(igAboutMatch[0]), aboutHtml.indexOf(igAboutMatch[0]) + igAboutMatch[0].length + 20)
              if (/mil/i.test(igAboutMatch[0]) || /mil/i.test(multiplier)) igNum *= 1000
              if (/\bmi\b/i.test(igAboutMatch[0])) igNum *= 1000000
              p.ig_followers = Math.round(igNum)
              console.log(`[mine] ${p.pagina_nome} IG from Sobre: ${p.ig_handle} = ${p.ig_followers}`)
            }
            // Fallback: procurar texto com instagram e seguidores separados
            if (!p.ig_handle) {
              // Padrão: ícone IG + @handle em uma linha, seguidores na próxima
              const igHandleM = aboutHtml.match(/instagram[^@]*@([a-zA-Z0-9_.]{2,30})/i)
              if (igHandleM) {
                p.ig_handle = '@' + igHandleM[1]
                // Procurar seguidores perto do handle
                const afterHandle = aboutHtml.slice(aboutHtml.indexOf(igHandleM[0]))
                const segM = afterHandle.match(/([\d.,]+)\s*(?:mil|mi|K|M)?\s*seguidores/i)
                if (segM) {
                  let n = parseFloat(segM[1].replace(/\./g, '').replace(',', '.'))
                  if (/mil/i.test(segM[0])) n *= 1000
                  if (/\bmi\b/i.test(segM[0])) n *= 1000000
                  p.ig_followers = Math.round(n)
                }
                console.log(`[mine] ${p.pagina_nome} IG from Sobre(2): ${p.ig_handle} = ${p.ig_followers}`)
              }
            }
          }
        } catch {}

        // 2b. Fallback: buscar na landing page da oferta
        if (!p.ig_handle && p.landing_url) {
          try {
            const igBlacklist = ['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'about', 'login', '_n', '_u', 'share', 'direct', 'developer', 'legal', 'help', 'rsrc.php', 'rsrc', 'whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'google', 'meta', 'threads']
            const landRes = await fetch(p.landing_url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36' },
              signal: AbortSignal.timeout(6000),
              redirect: 'follow',
            })
            if (landRes.ok) {
              const landHtml = await landRes.text()
              const landIgMatches = [...landHtml.matchAll(/instagram\.com\/([a-zA-Z0-9_.]{2,30})/gi)]
              const handles = [...new Set(landIgMatches.map(m => m[1]).filter(h => !igBlacklist.includes(h)))]
              if (handles.length > 0) {
                p.ig_handle = '@' + handles[0]
                console.log(`[mine] ${p.pagina_nome} IG from landing: ${p.ig_handle}`)
              }
            }
          } catch {}
        }

        // 2c. Se achou handle mas não followers, buscar via curl no Instagram
        if (p.ig_handle && !p.ig_followers) {
          p.ig_followers = await fetchInstagramFollowers(p.ig_handle)
          if (p.ig_followers) console.log(`[mine] ${p.pagina_nome} IG ${p.ig_handle}: ${p.ig_followers} followers (curl)`)
        }

        if (realCount > 0) {
          const fStr = p.fb_followers ? `, fb=${p.fb_followers}` : ''
          const igStr = p.ig_followers ? `, ig=${p.ig_followers}` : ''
          console.log(`[mine] ${p.pagina_nome}: ${p.keyword_hits} hits -> ${realCount} real ads${fStr}${igStr}`)
          p.total_anuncios = realCount
        }
      } catch (e) {
        console.log(`[mine] Count failed for ${p.pagina_nome}: ${e.message}`)
      }
    }
    await countPage.close().catch(() => {})

    const counted = toCount.filter(p => p.total_anuncios > 0)
    console.log(`[mine] "${keyword}": ${counted.length} pages with real counts`)

    const results = preliminary.slice(0, 60).map(p => ({
      ...p,
      fb_followers: p.fb_followers || null,
      ig_followers: p.ig_followers || null,
      ig_handle: p.ig_handle || null,
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

// ── AUTO-MINE ──
const AUTO_MINE_KEYWORDS = [
  // Packs & Educação
  "pack de aulas", "pack de atividades", "mega pack", "pack completo",
  "pack professor", "pack educação", "pack infantil", "pack direito",
  "pack enfermagem", "pack musical", "pack sublimação", "pack de artes",
  "material pedagógico", "atividades prontas", "apostila concurso",
  "simulado OAB", "simulado ENEM", "material pdf", "kit professor",
  "atividades lúdicas", "planner digital", "pack canva",
  // Emagrecimento
  "truque pra emagrecer", "truque da gelatina", "truque do limão",
  "truque da banana", "truque do café", "truque da maçã",
  "café bariátrico", "emagrecer rápido", "secar barriga",
  "perder barriga", "derreter gordura", "glicemia", "diabetes tipo 2",
  "chá emagrecedor", "jejum intermitente", "protocolo jejum",
  "receita detox", "suco verde", "metabolismo acelerado",
  // Relacionamento
  "reconquistar ex", "ex de volta", "mensagem secreta",
  "mensagem que conquista", "como reconquistar", "frases de conquista",
  "sedução", "relacionamento",
  // Disfunção Erétil
  "disfunção erétil", "impotência", "vigor masculino",
  "desempenho masculino", "ereção", "libido masculina",
  // Low Ticket Geral
  "truque", "método comprovado", "segredo", "fórmula",
  "protocolo", "descubra como", "por apenas",
  "ebook", "curso online", "guia completo", "planilha",
  // Plataformas
  "inlead", "xquiz", "lovable.app", "typebot", "quizclass",
  // Preços Low Ticket
  "por apenas 10 reais", "por apenas 9 reais", "R$9,90",
  "R$10", "R$17", "R$19,90", "R$27", "R$27,90",
  "R$37", "R$39,90", "R$47", "por apenas 7 reais",
  "por apenas 14 reais", "por apenas 29 reais",
  // Outros Nichos
  "crochê", "artesanato", "sublimação", "maquiagem",
  "confeitaria", "adestrar cachorro", "treino em casa",
  "renda extra", "ganhar dinheiro",
]

const CALLBACK_URL = process.env.CALLBACK_URL || '' // URL do Next.js pra salvar resultados
let autoMineRunning = false
let autoMineIndex = 0

app.post('/auto-mine/start', (req, res) => {
  if (autoMineRunning) return res.json({ status: 'already_running', index: autoMineIndex, total: AUTO_MINE_KEYWORDS.length })
  const callbackUrl = req.body?.callbackUrl || CALLBACK_URL
  if (!callbackUrl) return res.status(400).json({ error: 'callbackUrl required' })
  autoMineRunning = true
  autoMineIndex = 0
  runAutoMineLoop(callbackUrl)
  res.json({ status: 'started', total: AUTO_MINE_KEYWORDS.length })
})

app.post('/auto-mine/stop', (req, res) => {
  autoMineRunning = false
  res.json({ status: 'stopped', index: autoMineIndex })
})

app.get('/auto-mine/status', (req, res) => {
  res.json({
    running: autoMineRunning,
    index: autoMineIndex,
    total: AUTO_MINE_KEYWORDS.length,
    currentKeyword: autoMineRunning ? AUTO_MINE_KEYWORDS[autoMineIndex % AUTO_MINE_KEYWORDS.length] : null,
  })
})

// ── WARP IP rotation (proxy mode — não interfere no Cloudflare Tunnel) ──
// ── AUTO-RECOVERY SYSTEM ──
// Detecta bloqueio do Facebook e recupera automaticamente
let lastKnownIP = ''
let recoveryAttempts = 0
const MAX_RECOVERY_ATTEMPTS = 5

// warp-cli: path completo no Windows, bare no Linux/Mac
const WARP_CLI = process.platform === 'win32'
  ? 'C:\\Program Files\\Cloudflare\\Cloudflare WARP\\warp-cli.exe'
  : 'warp-cli'

async function getNewWarpIP() {
  if (browserInstance) { await browserInstance.close().catch(() => {}); browserInstance = null }
  const oldIP = lastKnownIP
  // Tenta até 3 reconexões pra garantir IP diferente
  for (let i = 0; i < 3; i++) {
    await execFileAsync(WARP_CLI, ['disconnect'], { timeout: 5000, windowsHide: true }).catch(() => {})
    await new Promise(r => setTimeout(r, 2000))
    await execFileAsync(WARP_CLI, ['connect'], { timeout: 5000, windowsHide: true }).catch(() => {})
    await new Promise(r => setTimeout(r, 3000))
    try {
      const { stdout } = await execFileAsync('curl', ['-s', '--socks5-hostname', 'localhost:40000', 'https://ifconfig.me'], { timeout: 10000, windowsHide: true })
      const newIP = stdout.trim()
      if (newIP && newIP !== oldIP) {
        lastKnownIP = newIP
        console.log(`[recovery] New IP: ${newIP} (was ${oldIP || 'unknown'})`)
        return newIP
      }
      console.log(`[recovery] Same IP ${newIP}, retrying...`)
    } catch {}
    // Espera progressivo entre tentativas
    await new Promise(r => setTimeout(r, 5000 * (i + 1)))
  }
  console.log(`[recovery] Could not get different IP`)
  return null
}

// Testa se o Facebook tá respondendo com resultados reais
async function testFacebookAccess() {
  const browser = await getFbBrowser()
  const page = await browser.newPage()
  await setupPage(page)
  try {
    const testUrl = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=emagrecimento&search_type=keyword_unordered'
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // Handle challenge
    let html = await page.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')
    if (html.includes('__rd_verify') || html.includes('executeChallenge')) {
      try { await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }) } catch {}
      await sleep(2000)
    }
    await page.waitForNetworkIdle({ timeout: 10000 }).catch(() => {})
    await sleep(3000)
    // Checa se tem resultados
    const hasResults = await page.evaluate(() => {
      const html = document.documentElement?.innerHTML || ''
      // Se tem "Nenhum anúncio" = bloqueado. Se tem ad_archive_id ou cards de anuncio = OK
      if (html.includes('Nenhum an') && html.includes('corresponde')) return false
      if (html.includes('ad_archive_id') || html.includes('collated_results')) return true
      // Checa se tem divs de resultado visíveis
      const cards = document.querySelectorAll('[class*="result"], [class*="card"]')
      return cards.length > 5
    }).catch(() => false)
    console.log(`[recovery] Facebook test: ${hasResults ? 'OK' : 'BLOCKED'}`)
    return hasResults
  } catch (e) {
    console.log(`[recovery] Facebook test error: ${e.message}`)
    return false
  } finally {
    await page.close()
  }
}

async function autoRecover() {
  console.log(`[recovery] Starting auto-recovery (attempt ${recoveryAttempts + 1}/${MAX_RECOVERY_ATTEMPTS})...`)
  recoveryAttempts++

  // Estratégia 1: Trocar IP via WARP
  console.log(`[recovery] Step 1: Getting new WARP IP...`)
  useWarpProxy = true
  const newIP = await getNewWarpIP()

  if (newIP) {
    // Testar se o novo IP funciona
    const works = await testFacebookAccess()
    if (works) {
      console.log(`[recovery] SUCCESS — IP ${newIP} works`)
      recoveryAttempts = 0
      return true
    }
  }

  // Estratégia 2: Tentar IP residencial (sem WARP)
  console.log(`[recovery] Step 2: Trying residential IP (no WARP)...`)
  useWarpProxy = false
  if (browserInstance) { await browserInstance.close().catch(() => {}); browserInstance = null }
  const residentialWorks = await testFacebookAccess()
  if (residentialWorks) {
    console.log(`[recovery] SUCCESS — residential IP works`)
    recoveryAttempts = 0
    return true
  }

  // Estratégia 3: Voltar pro WARP com novo IP + esperar cooldown
  console.log(`[recovery] Step 3: Both IPs blocked. Waiting cooldown (${5 * recoveryAttempts}min)...`)
  useWarpProxy = true
  if (browserInstance) { await browserInstance.close().catch(() => {}); browserInstance = null }
  // Cooldown progressivo: 5min, 10min, 15min, 20min, 25min
  await new Promise(r => setTimeout(r, 5 * 60 * 1000 * recoveryAttempts))
  await getNewWarpIP()
  const afterCooldown = await testFacebookAccess()
  if (afterCooldown) {
    console.log(`[recovery] SUCCESS after cooldown`)
    recoveryAttempts = 0
    return true
  }

  console.log(`[recovery] FAILED — attempt ${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}`)
  return recoveryAttempts < MAX_RECOVERY_ATTEMPTS
}

// Legacy alias
async function toggleWarp() { await getNewWarpIP(); useWarpProxy = true }

async function runAutoMineLoop(callbackUrl) {
  console.log(`[auto-mine] Starting loop with ${AUTO_MINE_KEYWORDS.length} keywords, callback: ${callbackUrl}`)
  let consecutiveEmpty = 0
  while (autoMineRunning) {
    const keyword = AUTO_MINE_KEYWORDS[autoMineIndex % AUTO_MINE_KEYWORDS.length]
    console.log(`[auto-mine] [${autoMineIndex + 1}/${AUTO_MINE_KEYWORDS.length}] Mining "${keyword}"...`)
    try {
      const jobId = 'auto_' + Date.now().toString(36)
      jobs.set(jobId, { status: 'running', results: null, error: null })
      await runMineJob(jobId, keyword, 300)
      const job = jobs.get(jobId)
      if (job?.status === 'done' && job.results) {
        const results = job.results
        const filtered = results.filter(p =>
          p.total_anuncios >= 5 && p.total_anuncios <= 300 &&
          (p.fb_followers === null || p.fb_followers < 10000) &&
          (p.ig_followers === null || p.ig_followers < 10000) &&
          p.keyword_hits >= 1
        )
        console.log(`[auto-mine] "${keyword}": ${results.length} pages -> ${filtered.length} after filters`)

        // Detectar rate limit: 0 resultados = Facebook bloqueou
        if (results.length === 0) {
          consecutiveEmpty++
          if (consecutiveEmpty >= 3) {
            console.log(`[auto-mine] BLOCKED detectado (${consecutiveEmpty} keywords vazias). Iniciando auto-recovery...`)
            const recovered = await autoRecover()
            consecutiveEmpty = 0
            if (!recovered) {
              console.log(`[auto-mine] Recovery esgotado. Pausando 1 hora...`)
              await new Promise(r => setTimeout(r, 60 * 60 * 1000))
              recoveryAttempts = 0
            }
            continue
          }
        } else {
          consecutiveEmpty = 0
          recoveryAttempts = 0 // reset se tá funcionando
        }

        if (filtered.length > 0 && callbackUrl) {
          try {
            const res = await fetch(callbackUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET}` },
              body: JSON.stringify({ keyword, offers: filtered }),
              signal: AbortSignal.timeout(15000),
            })
            const data = await res.json().catch(() => ({}))
            console.log(`[auto-mine] Callback: saved ${data.saved || 0}`)
          } catch (e) {
            console.log(`[auto-mine] Callback failed: ${e.message}`)
          }
        }
      } else {
        console.log(`[auto-mine] "${keyword}" failed: ${job?.error || 'unknown'}`)
        consecutiveEmpty++
      }
      jobs.delete(jobId)
    } catch (e) {
      console.log(`[auto-mine] "${keyword}" error: ${e.message}`)
      consecutiveEmpty++
    }

    autoMineIndex++
    if (autoMineIndex >= AUTO_MINE_KEYWORDS.length) {
      console.log(`[auto-mine] Cycle complete! Refreshing ad counts...`)
      await refreshOfferCounts(callbackUrl)
      autoMineIndex = 0
    }
    // 10 min entre keywords (evita rate limit do Facebook)
    await sleep(600000)
  }
  console.log(`[auto-mine] Loop stopped`)
}

// ── REFRESH AD COUNTS ──
async function refreshOfferCounts(callbackUrl) {
  try {
    // Buscar ofertas ativas do banco via API
    const res = await fetch(callbackUrl.replace('/auto-mine', '/auto-mine/offers'), {
      headers: { 'Authorization': `Bearer ${SECRET}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) { console.log(`[refresh] Failed to fetch offers: ${res.status}`); return }
    const { offers } = await res.json()
    if (!offers?.length) { console.log(`[refresh] No offers to refresh`); return }

    console.log(`[refresh] Refreshing ${offers.length} offers...`)
    const browser = await getFbBrowser()
    const page = await browser.newPage()
    await setupPage(page)

    for (const o of offers) {
      try {
        const pageUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${o.page_id}&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped&search_type=page&media_type=all`
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await sleep(3000)
        const html = await page.evaluate(() => document.documentElement?.innerHTML || '')
        const approxMatch = html.match(/(?:aproximadamente|approximately|exibindo|~)\s*(\d[\d.,]*)\s*(?:an[uú]ncios|ads|resultados)/i)
        const newCount = approxMatch ? parseInt(approxMatch[1].replace(/[.,]/g, '')) : null
        if (newCount !== null && newCount !== o.ad_count) {
          // Atualizar via callback
          await fetch(callbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET}` },
            body: JSON.stringify({ keyword: '_refresh', offers: [{ pagina_nome: o.page_name, page_id: o.page_id, total_anuncios: newCount, landing_url: o.landing_url, dias_rodando: o.dias_rodando, fb_followers: o.fb_followers, ig_followers: o.ig_followers, keyword_hits: 1 }] }),
            signal: AbortSignal.timeout(10000),
          }).catch(() => {})
          console.log(`[refresh] ${o.page_name}: ${o.ad_count} -> ${newCount} ads`)
        }
        await sleep(2000)
      } catch (e) {
        console.log(`[refresh] ${o.page_name}: error ${e.message}`)
      }
    }
    await page.close().catch(() => {})
    console.log(`[refresh] Done`)
  } catch (e) {
    console.log(`[refresh] Error: ${e.message}`)
  }
}

// ── ENRICH IG HANDLES (via Ad Library "Sobre" com login FB + landing fallback) ──
app.post('/enrich-ig', async (req, res) => {
  const { offers } = req.body || {}
  if (!offers?.length) return res.json({ error: 'No offers' })

  const results = []
  const browser = await getFbBrowser() // usa browser com cookies do Facebook
  const page = await browser.newPage()
  await setupPage(page)

  for (const o of offers.slice(0, 30)) {
    try {
      let igHandle = null
      let igFollowers = null

      // Método 1: Ad Library "Sobre" — pega IG handle + followers da transparência
      const pageUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${o.page_id}`
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await sleep(3000)

      // Clicar "Sobre"
      const sobreClicked = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a, span, div[role="tab"], div[role="button"]')]
        const sobre = links.find(el => /^Sobre$/i.test(el.textContent?.trim() || ''))
        if (sobre) { sobre.click(); return true }
        return false
      })

      if (sobreClicked) {
        await sleep(2000)
        const aboutHtml = await page.evaluate(() => document.documentElement?.innerHTML || '').catch(() => '')

        // Padrão 1: @handle seguido de seguidores
        const igAboutMatch = aboutHtml.match(/@([a-zA-Z0-9_.]{2,30})\s*(?:<[^>]*>\s*)*\s*([\d.,]+)\s*(?:mil|mi|K|M)?\s*seguidores/i)
        if (igAboutMatch) {
          igHandle = '@' + igAboutMatch[1]
          let n = parseFloat(igAboutMatch[2].replace(/\./g, '').replace(',', '.'))
          if (/mil/i.test(igAboutMatch[0])) n *= 1000
          if (/\bmi\b/i.test(igAboutMatch[0])) n *= 1000000
          igFollowers = Math.round(n)
        }

        // Padrão 2: procurar por ícone instagram + @handle
        if (!igHandle) {
          const igHandleM = aboutHtml.match(/instagram[^@]{0,200}@([a-zA-Z0-9_.]{2,30})/i)
          if (igHandleM) {
            igHandle = '@' + igHandleM[1]
            const afterHandle = aboutHtml.slice(aboutHtml.indexOf(igHandleM[0]))
            const segM = afterHandle.match(/([\d.,]+)\s*(?:mil|mi|K|M)?\s*seguidores/i)
            if (segM) {
              let n = parseFloat(segM[1].replace(/\./g, '').replace(',', '.'))
              if (/mil/i.test(segM[0])) n *= 1000
              if (/\bmi\b/i.test(segM[0])) n *= 1000000
              igFollowers = Math.round(n)
            }
          }
        }
      }

      // Método 2 (fallback): buscar na landing page
      if (!igHandle && o.landing_url) {
        try {
          const igBlacklist = ['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'about', 'login', '_n', '_u', 'share', 'direct', 'developer', 'legal', 'help', 'whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'google', 'meta', 'threads']
          const landRes = await fetch(o.landing_url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(6000),
            redirect: 'follow',
          })
          if (landRes.ok) {
            const landHtml = await landRes.text()
            const landIgMatches = [...landHtml.matchAll(/instagram\.com\/([a-zA-Z0-9_.]{2,30})/gi)]
            const handles = [...new Set(landIgMatches.map(m => m[1]).filter(h => !igBlacklist.includes(h)))]
            if (handles.length > 0) igHandle = '@' + handles[0]
          }
        } catch {}
      }

      // Se achou handle mas não followers, buscar via curl no Instagram
      if (igHandle && !igFollowers) {
        igFollowers = await fetchInstagramFollowers(igHandle)
      }

      if (igHandle) {
        console.log(`[enrich] ${o.page_name}: ${igHandle} ig=${igFollowers}`)
        results.push({ page_id: o.page_id, ig_handle: igHandle, ig_followers: igFollowers })
      }

      await sleep(1000)
    } catch (e) {
      console.log(`[enrich] ${o.page_name}: error ${e.message}`)
    }
  }

  await page.close().catch(() => {})
  console.log(`[enrich] Done: ${results.length}/${offers.length} enriched`)
  res.json({ enriched: results })
})

// ── START ──
const AUTO_MINE_CALLBACK = process.env.AUTO_MINE_CALLBACK || 'https://ratoads.com.br/api/auto-mine'

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Scraper] Running on port ${PORT}`)
  console.log(`[Scraper] Chromium: ${CHROMIUM_PATH}`)
  console.log(`[Scraper] Auth: ${SECRET ? 'enabled' : 'DISABLED'}`)
  console.log(`[Scraper] Proxy: ${PROXY_URL ? PROXY_URL.replace(/\/\/.*@/, '//***@') : 'NONE'}`)

  // Auto-start mineração contínua após 30s (espera browser estar pronto)
  setTimeout(() => {
    if (!autoMineRunning) {
      console.log(`[auto-mine] Auto-starting with callback: ${AUTO_MINE_CALLBACK}`)
      autoMineRunning = true
      autoMineIndex = 0
      runAutoMineLoop(AUTO_MINE_CALLBACK)
    }
  }, 30000)
})
