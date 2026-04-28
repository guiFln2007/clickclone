import { NextRequest, NextResponse } from 'next/server'
import { load } from 'cheerio'
import {
  dbGetUserById,
  dbDecrementAnalises,
  dbDecrementCreditosN,
  dbGetFreeUsage,
  dbIncrementFreeAnalises,
  dbLogAnalysis,
  dbGetCachedAnalysis,
  dbSaveCachedAnalysis,
  dbLogActivity,
} from '@/lib/db'

export const maxDuration = 300

const APIFY_TOKEN = process.env.APIFY_TOKEN!

async function callClaude(prompt: string, systemPrompt?: string, model = 'claude-sonnet-4-6', maxTokens = 1024): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  console.log('[callClaude] model:', model, '| prompt size:', prompt.length, 'chars | system size:', systemPrompt?.length ?? 0, 'chars')
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content.find(b => b.type === 'text')
    const result = text && text.type === 'text' ? text.text : ''
    console.log('[callClaude] resultado size:', result.length, 'chars | tokens:', response.usage.input_tokens, '+', response.usage.output_tokens)
    return { text: result, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
  } catch (err) {
    const e = err as Error
    console.error('[callClaude] ERRO nome:', e?.name)
    console.error('[callClaude] ERRO mensagem:', e?.message)
    console.error('[callClaude] ERRO stack:', e?.stack?.slice(0, 500))
    return { text: `__CLAUDE_ERROR__:${e?.message || String(err)}`, inputTokens: 0, outputTokens: 0 }
  }
}

function computeCredits(inputTokens: number, outputTokens: number, model: string): number {
  const isHaiku = model.includes('haiku')
  const costUSD = (inputTokens / 1000 * (isHaiku ? 0.001 : 0.003)) + (outputTokens / 1000 * (isHaiku ? 0.005 : 0.015))
  return Math.max(1, Math.ceil(costUSD / 0.01))
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (text.trimStart().startsWith('<')) {
    console.error('[safeJson] Apify retornou HTML em vez de JSON. Status:', res.status, '| Body:', text.slice(0, 300))
    throw new Error(`Apify retornou HTML — possível erro de autenticação ou saldo insuficiente. Status: ${res.status}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    console.error('[safeJson] JSON inválido. Status:', res.status, '| Body:', text.slice(0, 300))
    throw new Error(`Apify retornou resposta inválida. Status: ${res.status}`)
  }
}

function cleanAdLibraryUrl(url: string): string {
  // Mantém só os params essenciais — sort_data[] com colchetes quebra o JSON
  try {
    const u = new URL(url)
    const clean = new URL('https://www.facebook.com/ads/library/')
    const keep = ['active_status', 'ad_type', 'country', 'search_type', 'view_all_page_id', 'media_type']
    for (const k of keep) {
      const v = u.searchParams.get(k)
      if (v) clean.searchParams.set(k, v)
    }
    return clean.toString()
  } catch {
    return url
  }
}

async function scrapeAds(url: string) {
  const cleanUrl = cleanAdLibraryUrl(url)
  console.log('[Apify] APIFY_TOKEN exists:', !!APIFY_TOKEN, '| token prefix:', APIFY_TOKEN?.slice(0, 6) || 'EMPTY')
  console.log('[Apify] Iniciando scrape:', cleanUrl)

  let runRes: Response
  let runData: unknown
  try {
    runRes = await fetch(
      `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [{ url: cleanUrl }], maxAds: 100 }),
      }
    )
    runData = await safeJson(runRes)
  } catch (fetchErr) {
    const e = fetchErr as Error
    console.error('[Apify] Erro de rede ao iniciar run:', e.message, e.stack)
    throw new Error(`Falha de rede ao contactar Apify: ${e.message}`)
  }

  const rd = runData as Record<string, unknown>
  console.log('[Apify] HTTP status:', runRes.status, '| resposta:', JSON.stringify(rd).slice(0, 300))

  const runId = (rd?.data as Record<string, unknown>)?.id
  if (!runId) {
    const apifyError = (rd?.error as Record<string, unknown>)?.message || JSON.stringify(rd).slice(0, 200)
    console.error('[Apify] Falha ao iniciar run — resposta completa:', JSON.stringify(rd))
    if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN não configurado nas variáveis de ambiente')
    throw new Error(`Apify recusou a requisição: ${apifyError}`)
  }

  // Poll até completar
  let status = 'RUNNING'
  let attempts = 0
  while (['RUNNING', 'READY'].includes(status) && attempts < 30) {
    await sleep(2000)
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    )
    const statusData = await safeJson(statusRes) as Record<string, unknown>
    status = (statusData?.data as Record<string, unknown>)?.status as string ?? 'FAILED'
    console.log(`[Apify] Tentativa ${attempts + 1}: status=${status}`)
    attempts++
  }

  console.log('[Apify] Run finalizado com status:', status)

  const itemsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=999`
  )
  const items = await safeJson(itemsRes)
  console.log('[Apify] Items retornados:', Array.isArray(items) ? items.length : typeof items)
  if (Array.isArray(items) && items.length > 0) {
    console.log('[Apify] Primeiro item (keys):', Object.keys(items[0]))
  }
  return items
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const BLOCKED_DOMAINS = ['hotmart.com', 'eduzz.com', 'kiwify.com.br', 'monetizze.com.br', 'perfectpay.com.br', 'shopify.com', 'cdn.shopify', 'shopifycdn.com']

async function downloadAsBase64(url: string, maxKB = 600): Promise<string | null> {
  try {
    // Pula domínios conhecidos que bloqueiam CORS
    const hostname = new URL(url).hostname
    if (BLOCKED_DOMAINS.some(d => hostname.includes(d))) return null

    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Referer': new URL(url).origin },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.startsWith('image/') && !ct.startsWith('video/')) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength > maxKB * 1024) return null
    return `data:${ct.split(';')[0]};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

function extractAdVideos(ads: Record<string, unknown>[]): string[] {
  const urls: string[] = []
  for (const ad of ads.slice(0, 10)) {
    const snap = ad.snapshot as Record<string, unknown> | undefined
    // vídeos direto no snapshot
    const vids = snap?.videos as Record<string, unknown>[] | undefined
    if (Array.isArray(vids)) {
      for (const v of vids) {
        const u = (v.video_hd_url || v.video_sd_url || v.url) as string | undefined
        if (u && u.startsWith('http')) urls.push(u)
      }
    }
    // vídeos dentro de cards
    const cards = snap?.cards as Record<string, unknown>[] | undefined
    if (Array.isArray(cards)) {
      for (const c of cards) {
        const u = (c.video_hd_url || c.video_sd_url) as string | undefined
        if (u && u.startsWith('http')) urls.push(u)
      }
    }
  }
  return [...new Set(urls)].slice(0, 3)
}

type MediaItem = {
  url: string
  type: 'image' | 'video'
  role: 'hero' | 'product' | 'person' | 'badge' | 'background' | 'video' | 'unknown'
  alt?: string
  width?: number
  height?: number
}

function classifyMediaItems(items: Array<{url: string, type: 'image'|'video', alt?: string, width?: number, height?: number}>): MediaItem[] {
  const classified = items.map((item, index) => {
    let role: MediaItem['role'] = 'unknown'
    const url = item.url.toLowerCase()
    const alt = (item.alt || '').toLowerCase()

    if (item.type === 'video') {
      role = 'video'
    } else if (
      alt.includes('garantia') || alt.includes('seguro') || alt.includes('certificado') ||
      alt.includes('pagamento') || alt.includes('cartão') || alt.includes('pix') ||
      url.includes('garantia') || url.includes('badge') || url.includes('seal') || url.includes('pagamento')
    ) {
      role = 'badge'
    } else if (
      alt.includes('fundo') || alt.includes('background') || alt.includes('bg') ||
      url.includes('background') || url.includes('/bg') || url.includes('fundo')
    ) {
      role = 'background'
    } else if (
      alt.includes('produto') || alt.includes('ebook') || alt.includes('mockup') ||
      url.includes('produto') || url.includes('ebook') || url.includes('mockup') || url.includes('product')
    ) {
      role = 'product'
    } else if (
      alt.includes('foto') || alt.includes('depoimento') || alt.includes('pessoa') ||
      alt.includes('cliente') || alt.includes('autor') || alt.includes('especialista') ||
      url.includes('person') || url.includes('people') || url.includes('user') || url.includes('avatar') || url.includes('depoimento')
    ) {
      role = 'person'
    } else if (item.width && item.height && item.width > item.height * 1.5) {
      role = 'hero'
    } else if (index === 0) {
      role = 'hero'
    } else {
      role = 'unknown'
    }

    return { ...item, role }
  })

  // Limita heroes a no máximo 2
  let heroCount = 0
  return classified.map(item => {
    if (item.role === 'hero') {
      heroCount++
      if (heroCount > 2) return { ...item, role: 'unknown' as const }
    }
    return item
  })
}

// Scraper headless via Apify Playwright — para SPAs e páginas com Cloudflare
async function scrapeLandingPageHeadless(url: string) {
  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/apify~playwright-scraper/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url }],
          maxRequestsPerCrawl: 1,
          launchContext: { launchOptions: { headless: true } },
          pageFunction: `async function pageFunction({ page }) {
            await page.waitForTimeout(2500);
            const title = await page.title();
            const text = await page.evaluate(() => document.body.innerText || '');
            const html = await page.content();
            const images = await page.evaluate(() =>
              [...document.querySelectorAll('img')].map(i => {
                const src = i.src || i.dataset.src || ''
                if (!src.startsWith('http')) return null
                const alt = (i.alt || '').toLowerCase()
                const parents = []
                let el = i.parentElement
                for (let j = 0; j < 4; j++) {
                  if (!el) break
                  parents.push(((el.className||'') + ' ' + (el.id||'')).toLowerCase())
                  el = el.parentElement
                }
                return { src, alt, ctx: parents.join(' ') }
              }).filter(Boolean).slice(0, 15)
            );
            const videos = await page.evaluate(() =>
              [...document.querySelectorAll('video,source')].map(v=>v.src||v.dataset.src||'').filter(Boolean).slice(0,5)
            );
            const headings = await page.evaluate(() =>
              [...document.querySelectorAll('h1,h2,h3,h4')].map(h=>h.innerText.trim()).filter(Boolean).slice(0,20)
            );
            const bullets = await page.evaluate(() =>
              [...document.querySelectorAll('li')].map(l=>l.innerText.trim()).filter(t=>t.length>10&&t.length<200).slice(0,20)
            );
            const ctas = await page.evaluate(() =>
              [...document.querySelectorAll('button,a')].map(el=>el.innerText.trim()).filter(t=>t.length>2&&t.length<60).slice(0,10)
            );
            const prices = (text.match(/R\\$\\s*[\\d.,]+/g)||[]).filter((v,i,a)=>a.indexOf(v)===i).slice(0,6);
            const colors = await page.evaluate(() => {
              const cols = new Set();
              document.querySelectorAll('[style]').forEach(el=>{
                (el.getAttribute('style')||'').match(/#[0-9a-fA-F]{3,6}/g)?.forEach(c=>cols.add(c));
              });
              [...document.styleSheets].forEach(ss=>{
                try{[...ss.cssRules].forEach(r=>{ if(r.cssText)(r.cssText.match(/#[0-9a-fA-F]{3,6}/g)||[]).forEach(c=>cols.add(c)); })}catch(e){}
              });
              return [...cols].slice(0,20);
            });
            return { title, text: text.slice(0,12000), html: html.slice(0,25000), images, videos, headings, bullets, ctas, prices, colors };
          }`,
        }),
      }
    )
    const runData = await safeJson(runRes) as Record<string, unknown>
    const runId = (runData?.data as Record<string, unknown>)?.id
    if (!runId) return null

    let status = 'RUNNING'
    let attempts = 0
    while (['RUNNING', 'READY'].includes(status) && attempts < 20) {
      await sleep(3000)
      const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
      status = ((await safeJson(s) as Record<string, unknown>)?.data as Record<string, unknown>)?.status as string ?? 'FAILED'
      attempts++
    }
    if (status !== 'SUCCEEDED') return null

    const itemsRes2 = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=1`)
    const items = await safeJson(itemsRes2) as unknown[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = items?.[0] as any
    if (!d) return null

    const testimonials: string[] = []
    const $ = load((d.html as string) || '')
    $('[class*="testim"],[class*="depo"],[class*="review"],[class*="avali"],[class*="cliente"]').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim()
      if (t.length > 20) testimonials.push(t.slice(0, 300))
    })

    // Extract media from headless HTML
    const headlessMediaRaw: Array<{url: string, type: 'image'|'video', alt?: string}> = []
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || ''
      const alt = $(el).attr('alt') || ''
      if (src && !src.startsWith('data:') && src.length > 10) {
        const absoluteUrl = src.startsWith('http') ? src : (() => { try { return new URL(src, url).toString() } catch { return '' } })()
        if (absoluteUrl) headlessMediaRaw.push({ url: absoluteUrl, type: 'image', alt })
      }
    })
    $('video source, video').each((_, el) => {
      const src = $(el).attr('src') || ''
      if (src) {
        const absoluteUrl = src.startsWith('http') ? src : (() => { try { return new URL(src, url).toString() } catch { return '' } })()
        if (absoluteUrl) headlessMediaRaw.push({ url: absoluteUrl, type: 'video' })
      }
    })
    const ogImage = $('meta[property="og:image"]').attr('content') || ''
    const twitterImage = $('meta[name="twitter:image"]').attr('content') || ''
    if (ogImage) headlessMediaRaw.unshift({ url: ogImage, type: 'image', alt: 'og-hero' })
    if (twitterImage && twitterImage !== ogImage) headlessMediaRaw.unshift({ url: twitterImage, type: 'image', alt: 'twitter-hero' })
    const media = classifyMediaItems(headlessMediaRaw.slice(0, 30))

    return {
      title: (d.title as string) || '',
      headings: (d.headings as string[]) || [],
      bullets: (d.bullets as string[]) || [],
      testimonials: testimonials.slice(0, 8),
      prices: (d.prices as string[]) || [],
      ctas: (d.ctas as string[]) || [],
      images: [] as { src: string; alt: string; ctx: string }[],
      videos: (d.videos as string[]) || [],
      fullText: (d.text as string) || '',
      structuredHtml: ((d.html as string) || '').slice(0, 20000),
      design: { colors: (d.colors as string[]) || [], fonts: [] },
      media,
    }
  } catch (e) {
    console.warn('[Headless] Falha:', e)
    return null
  }
}

async function scrapeLandingPage(url: string) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000),
    })
    const html = await res.text()
    const $ = load(html)

    // Extrai cores e fontes ANTES de remover style tags
    const cssText = $('style').map((_, el) => $(el).html() || '').get().join(' ')
    const colorMatches = cssText.match(/#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)/g) || []
    const fontMatches = cssText.match(/font-family\s*:\s*([^;}"']+)/g) || []
    const inlineColors: string[] = []
    $('[style]').slice(0, 40).each((_, el) => {
      const m = ($(el).attr('style') || '').match(/#[0-9a-fA-F]{3,6}|rgb\([^)]+\)/g) || []
      inlineColors.push(...m)
    })

    // Imagens e vídeos ANTES de limpar
    type ImageRaw = { src: string; alt: string; ctx: string }
    const images: ImageRaw[] = $('img').map((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || ''
      if (!src.startsWith('http')) return null
      const alt = ($(el).attr('alt') || '').toLowerCase()
      const pCtx = $(el).parents().slice(0, 4).map((_, p) => (($(p).attr('class') || '') + ' ' + ($(p).attr('id') || '')).toLowerCase()).get().join(' ')
      return { src, alt, ctx: pCtx }
    }).get().filter((x): x is ImageRaw => x !== null).slice(0, 15)
    const videos = $('video, video source, source').map((_, el) => $(el).attr('src') || $(el).attr('data-src')).get()
      .filter((src): src is string => Boolean(src)).slice(0, 5)

    // HTML limpo para análise — remove scripts/styles mas mantém estrutura e texto
    $('script, noscript, svg, iframe').remove()
    // Remove atributos desnecessários mas mantém class/id para contexto
    $('*').removeAttr('onclick onmouseover onload onerror')

    // Texto completo da página — essencial para modelar copy
    const fullText = $.text().replace(/\s+/g, ' ').trim().slice(0, 12000)

    // Extrai seções de depoimentos especificamente
    const testimonials: string[] = []
    $('[class*="testim"], [class*="depo"], [class*="review"], [class*="avali"], [class*="cliente"]').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim()
      if (t.length > 20) testimonials.push(t.slice(0, 300))
    })

    // Preços mencionados
    const priceMatches = fullText.match(/R\$\s*[\d.,]+/g) || []

    // Lista de bullets/benefícios
    const bullets = $('li').map((_, el) => $(el).text().trim()).get().filter(t => t.length > 10 && t.length < 200).slice(0, 20)

    // HTML resumido da estrutura (primeiros 20KB) para o Claude ver o layout real
    const structuredHtml = $('body').html()?.slice(0, 20000) || ''

    $('style').remove()

    // Extract classified media
    const staticMediaRaw: Array<{url: string, type: 'image'|'video', alt?: string}> = []
    images.forEach(img => {
      if (img.src && !img.src.startsWith('data:') && img.src.length > 10) {
        staticMediaRaw.push({ url: img.src, type: 'image', alt: img.alt })
      }
    })
    videos.forEach(videoSrc => {
      if (videoSrc) staticMediaRaw.push({ url: videoSrc, type: 'video' })
    })
    const ogImageStatic = $('meta[property="og:image"]').attr('content') || ''
    const twitterImageStatic = $('meta[name="twitter:image"]').attr('content') || ''
    if (ogImageStatic) staticMediaRaw.unshift({ url: ogImageStatic, type: 'image', alt: 'og-hero' })
    if (twitterImageStatic && twitterImageStatic !== ogImageStatic) staticMediaRaw.unshift({ url: twitterImageStatic, type: 'image', alt: 'twitter-hero' })
    const media = classifyMediaItems(staticMediaRaw.slice(0, 30))

    return {
      title: $('title').text().trim(),
      headings: $('h1, h2, h3, h4').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 20),

      bullets,
      testimonials: testimonials.slice(0, 8),
      prices: [...new Set(priceMatches)].slice(0, 6),
      ctas: $('button, a[class*="btn"], a[class*="cta"], [class*="button"]').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 10),
      images,
      videos,
      fullText,
      structuredHtml,
      design: {
        colors: [...new Set([...colorMatches, ...inlineColors])].slice(0, 20),
        fonts: fontMatches.map(f => f.replace('font-family:', '').trim()).slice(0, 5),
      },
      media,
    }
  } catch (e) {
    console.warn('[Landing] Falha ao scraper landing page:', e)
    return null
  }
}

function extractLandingUrl(ads: Record<string, unknown>[]): string | null {
  for (const ad of ads) {
    const snapshot = ad.snapshot as Record<string, unknown> | undefined
    const url =
      (snapshot?.link_url as string) ||
      (snapshot?.cards as Record<string, unknown>[])?.[0]?.link_url as string ||
      (ad.ad_creative_link_url as string) ||
      (ad.ad_creative_link_urls as string[])?.[0]
    if (url && url.startsWith('http')) return url
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHtmlPrompt(analysis: any, landingPage: any, adCopies: string, media: MediaItem[]): string {
  const funnel = (analysis.funnel_type as string) || 'landing_page'
  const price = analysis.price_anchor || landingPage?.prices?.[0] || 'R$19,90'
  const pageName = analysis.page_name
  const niche = analysis.niche || ''
  const angle = analysis.dominant_angle
  const weakPoints = (analysis.weak_points as string[]).map((p: string, i: number) => `${i+1}. ✗ ${p}`).join('\n')
  const strongPoints = (analysis.strong_points as string[]).map((p: string, i: number) => `${i+1}. ✓ ${p}`).join('\n')
  const headings = landingPage?.headings?.join('\n') || '(não disponível)'
  const bullets = landingPage?.bullets?.join('\n') || '(não disponível)'
  const ctas = landingPage?.ctas?.join(' | ') || '(não disponível)'
  const fullText = landingPage?.fullText?.slice(0, 3000) || '(não disponível)'
  const testimonials = landingPage?.testimonials?.length
    ? landingPage.testimonials.map((t: string, i: number) => `[Depo ${i+1}]: ${t}`).join('\n')
    : '(não detectados — crie 4 depoimentos ultra-realistas com nome, cidade e resultado específico)'
  const designVibe = analysis.design_context?.vibe || ''
  const primaryColor = analysis.design_context?.primary_color || 'não detectado'
  const cssColors = landingPage?.design?.colors?.slice(0, 10).join(', ') || 'não disponível'
  const cssFonts = landingPage?.design?.fonts?.join(', ') || 'não disponível'

  // Deriva arrays de mídia por role a partir do MediaItem[]
  const heroImages = media.filter(m => m.role === 'hero').slice(0, 2)
  const productImages = media.filter(m => m.role === 'product').slice(0, 3)
  const personImages = media.filter(m => m.role === 'person').slice(0, 5)
  const badgeImages = media.filter(m => m.role === 'badge').slice(0, 6)
  const mediaVideos = media.filter(m => m.role === 'video').slice(0, 2)
  const bgImages = media.filter(m => m.role === 'background').slice(0, 2)

  // Variáveis de conveniência para uso nos templates de funil
  const hero = heroImages[0]?.url || null
  const product = productImages[0]?.url || null
  const persons = personImages.map(m => m.url)
  const videos = mediaVideos.map(m => m.url)

  const mediaSection = media.length > 0 ? `

MÍDIAS REAIS DO CONCORRENTE (use estas URLs diretamente no HTML):
${heroImages.length > 0 ? `Hero images: ${heroImages.map(m => m.url).join(', ')}` : ''}
${productImages.length > 0 ? `Produto: ${productImages.map(m => m.url).join(', ')}` : ''}
${personImages.length > 0 ? `Pessoas/depoimentos: ${personImages.map(m => m.url).join(', ')}` : ''}
${badgeImages.length > 0 ? `Badges/selos: ${badgeImages.map(m => m.url).join(', ')}` : ''}
${mediaVideos.length > 0 ? `Vídeos: ${mediaVideos.map(m => m.url).join(', ')}` : ''}
${bgImages.length > 0 ? `Backgrounds: ${bgImages.map(m => m.url).join(', ')}` : ''}

INSTRUÇÕES DE USO DE MÍDIA:
- Use as URLs hero como src da imagem/vídeo principal no hero da página
- Use as URLs de pessoas como fotos nos depoimentos (com nomes fictícios plausíveis)
- Use os badges de garantia/pagamento na seção de garantia e próximo ao CTA
- Use as imagens de produto na seção de apresentação do produto
- Se funnel_type é "vsl" e há vídeos disponíveis, use-os como VSL principal
- Em TODOS os <img> e <video>, adicione: onerror="this.style.display='none';this.parentElement.classList.add('media-fallback')"
- Adicione no CSS: .media-fallback{background:linear-gradient(135deg,#1a1a1a,#2a2a2a);min-height:200px;border-radius:8px;display:flex;align-items:center;justify-content:center}
- .media-fallback::after{content:'';display:block;width:40px;height:40px;border:2px solid #333;border-radius:50%}` : ''

  const designRules = `━━━ DESIGN ━━━
NICHO: ${niche} | VIBE: ${designVibe} | COR PRINCIPAL: ${primaryColor}
CORES CSS: ${cssColors} | FONTES: ${cssFonts}
Mobile-first. Wrapper: max-width:1200px desktop / 560px mobile; margin:0 auto; padding:0 20px.
Paleta no :root: --bg, --bg-alt, --surface, --text, --text-muted, --accent, --accent-2, --border, --accent-alpha.
Botões: border-radius:99px, gradiente acento, font-weight:900, @keyframes pulse no CTA principal.
Animações CSS permitidas: gradiente animado no hero, pulse no botão, hover transition nos cards.
ZERO IntersectionObserver. ZERO JS para revelar conteúdo. Tudo visível por padrão no load.
PRIMEIRA LINHA DO CSS (obrigatório): html,body{margin:0;padding:0;background:var(--bg,#0a0a0a);color:var(--text,#fff);opacity:1!important;visibility:visible!important;overflow-x:hidden}

━━━ RESPONSIVIDADE — INEGOCIÁVEL ━━━
Use CSS Grid e Flexbox. NUNCA posicionamento fixo/absoluto para layout de conteúdo.
ZERO overflow-x em mobile — overflow-x:hidden no body é obrigatório.
Teste mental antes de fechar: "se reduzir para 375px, tudo é legível e clicável?"

DESKTOP (min-width: 1025px):
- Hero font-size: clamp(48px, 6vw, 72px)
- Padding horizontal: 80px
- Max-width: 1200px centralizado
- Grids: 3-4 colunas onde fizer sentido

TABLET @media (max-width: 1024px):
- Hero font-size: clamp(36px, 5vw, 48px)
- Padding horizontal: 32px
- Grids: máximo 2 colunas
- Cards: grid 2 colunas
- Pricing: lado a lado se couber, senão stack

MOBILE @media (max-width: 768px):
- Hero font-size: clamp(28px, 7vw, 36px) — NUNCA maior que 36px
- Padding horizontal: 16px
- TUDO em 1 coluna: grid-template-columns: 1fr
- Botões: width:100%; min-height:52px; padding:16px
- CTAs: largura total, sem texto cortado
- Input fields: width:100%; box-sizing:border-box
- Imagens: max-width:100%; height:auto
- Nav: links empilhados ou hamburger
- Cards: stack vertical, sem grid
- Font-size mínimo: 14px em qualquer elemento
- Pricing cards: empilhados (flex-direction:column)

MOBILE PEQUENO @media (max-width: 480px):
- Padding horizontal: 12px
- Hero font-size: clamp(24px, 8vw, 32px)
- Todos os grid: grid-template-columns: 1fr !important

PADRÃO DE GRID RESPONSIVO OBRIGATÓRIO para cards/features/depoimentos:
display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:20px`

  const visualDirection = `━━━ DIREÇÃO VISUAL OBRIGATÓRIA ━━━
Analise o nicho "${niche}" e o ângulo "${analysis.dominant_angle}" e escolha a estética mais adequada:
- SaaS/Tech: dark com neon accents (#00ff88 ou #7c3aed), glassmorphism, partículas ou grid animado
- Infoproduto/Curso: dark premium (#0a0a0a + gold/amber) ou light bold com cores vibrantes
- Saúde/Bem-estar: gradientes suaves (rosa→lilás, verde→teal), orgânico, moderno
- Relacionamento/Comportamento: tons quentes (bordô, coral, dourado), emocional, elegante
- Finanças/Renda: verde escuro ou azul navy com gold, transmite confiança e autoridade

Execute com CORAGEM. Esta página deve ser visualmente memorável — não uma landing page genérica.`

  const preAnalysis = `━━━ ANÁLISE OBRIGATÓRIA ANTES DE GERAR ━━━
Antes de escrever uma linha de HTML, responda internamente:
1. funnel_type: ${funnel} — qual é o mecanismo central? (o que o usuário FAZ nessa página)
2. A página original tem campo de input/formulário? Verifique no texto original abaixo — se sim, DEVE estar na geração funcionando com JS
3. A página original tem pricing? ${landingPage?.prices?.length ? `SIM — valores reais detectados: ${landingPage.prices.join(', ')} — USE ESTES VALORES EXATOS` : `Use ${price}`}
4. Quais 3 elementos do funil original NÃO PODEM faltar? (mecanismo central, pricing, prova social)
Só então comece a gerar.`

  const goldenRule = `━━━ REGRA DE OURO ━━━
Você está gerando uma versão MELHORADA do funil original — não uma página sobre o mesmo tema. Isso significa:
1. Mesma estrutura de conversão do original, melhorada visualmente
2. Mesmo mecanismo central (ferramenta → ferramenta funcional; quiz → quiz JS; VSL → player de vídeo)
3. Copy baseado no original (headlines, bullets, depoimentos reais), não inventado
4. Todos os elementos interativos funcionando com JS inline (inputs, simulações, accordions, countdowns)
5. Design superior ao original — mais moderno, mais animado, mais impactante

OBRIGATÓRIO SE DETECTADO NO ORIGINAL:
• Campo de input/ferramenta → gere funcional com simulação JS e resultados verossímeis para o nicho "${niche}"
• Pricing ${landingPage?.prices?.length ? `(valores reais: ${landingPage.prices.join(', ')})` : `(${price})`} → seção de pricing obrigatória com planos lado a lado
• ${landingPage?.testimonials?.length ? `${landingPage.testimonials.length} depoimentos detectados → use o copy real abaixo` : `Crie 4 depoimentos ultra-realistas com nome, cidade e resultado específico`}
• Se detectou contador de urgência → gere countdown JS (24h a partir do load)
• Se detectou bônus → gere grid de bônus com valores riscados + "INCLUSO GRÁTIS"

Se o produto original tem um campo onde o usuário digita algo e recebe um resultado, sua página DEVE ter esse campo funcionando com uma simulação realista.`

  const qualityChecklist = `━━━ CHECKLIST FINAL — execute antes de fechar </html> ━━━
□ Mecanismo central presente e funcional? (${funnel === 'ferramenta_freemium' ? 'input + simulação JS com dados reais do nicho' : funnel === 'quiz' ? 'quiz com ≥5 perguntas JS + resultado bloqueado' : funnel === 'vsl' ? 'player de vídeo principal visível' : 'CTA/formulário principal funcionando'})
□ Pricing com valor real (${price}) aparece na página?
□ CTA principal aparece ≥3 vezes?
□ Animações CSS: pulse no CTA, hover:transform nos cards, gradiente animado?
□ Página tem ≥8 seções completas com conteúdo real?
□ ZERO IntersectionObserver — todo conteúdo visível no load?
□ Marcadores <!-- cc:X --> em todas as seções principais?
□ RESPONSIVIDADE: overflow-x:hidden no body; grids usam auto-fit/minmax ou 1fr em mobile; botões width:100% em ≤768px; hero font-size ≤36px em mobile; padding ≤16px em mobile?
Se qualquer item faltar → adicione antes de fechar.`

  const briefing = `${preAnalysis}

${visualDirection}

━━━ BRIEFING ━━━
Produto: "${pageName}" | Nicho: ${niche} | Ângulo: ${angle} | Preço: ${price}
Score concorrente: ${analysis.score}/10 — ${analysis.reason}

FRAQUEZAS DELES (seu diferencial):
${weakPoints}

FORÇAS DELES (mantenha e melhore):
${strongPoints}

COPY ORIGINAL DO CONCORRENTE:
Headlines: ${headings}
Bullets: ${bullets}
CTAs: ${ctas}
Hooks dos anúncios: ${adCopies}
Texto da página: ${fullText}
Depoimentos: ${testimonials}

${mediaSection}

${designRules}

${goldenRule}

${qualityChecklist}`

  if (funnel === 'quiz') {
    return `${briefing}

━━━ ESTRUTURA: QUIZ FUNNEL ━━━

Gera um quiz funnel completo em HTML single-page com JavaScript.

[0] ANNOUNCE BAR: sticky top, fundo acento, "⏳ Responda agora — oferta por apenas ${price}"

[1] INTRO PAGE (#step-0, visível no load):
  - Headline forte PAS baseada no ângulo: "${angle}"
  - Sub: 2 frases que validam a dor do visitante
  - Prova social compacta: +X pessoas já fizeram esse quiz
  - Botão grande "COMEÇAR AGORA →"

[2] PERGUNTAS (#step-1 até #step-N, cada uma oculta inicialmente):
  Cria 5 perguntas relevantes para o nicho/ângulo. Cada pergunta:
  - Título da pergunta (máx 8 palavras)
  - 3-4 opções como botões clicáveis (onclick="nextStep()")
  - Barra de progresso no topo (ex: "Pergunta 2 de 5")
  Exemplo para nicho de relacionamento: nome do parceiro, signo, mudanças de comportamento, etc.
  Exemplo para saúde: objetivo, histórico, disponibilidade, etc.
  Adapte 100% ao nicho "${niche}".

[3] TELA DE RESULTADO BLOQUEADO (#step-result, última etapa):
  - "Analisando suas respostas..." com spinner por 2s (setTimeout), depois aparece resultado
  - Título: "Identificamos [algo específico do nicho] em sua situação"
  - Parágrafo de 3-4 linhas descrevendo o resultado (genérico o suficiente pra parecer personalizado)
  - Seção bloqueada: blur(8px) + overlay escuro com cadeado 🔒
  - Overlay text: "Desbloqueie sua análise completa"
  - Preço grande: ~~R$XX~~ → ${price}
  - Botão CTA pill grande "DESBLOQUEAR RESULTADO →"
  - Trust badges abaixo

[JS]:
  - currentStep começa em 0
  - nextStep() oculta step atual, exibe próximo
  - Armazena respostas em objeto para personalização (ex: exibir o valor respondido na tela de resultado)
  - Spinner + delay de 2s antes de mostrar resultado bloqueado`
  }

  if (funnel === 'whatsapp') {
    return `${briefing}

━━━ ESTRUTURA: WHATSAPP FUNNEL ━━━

Página simples, mobile-first, objetivo único: fazer o visitante clicar no WhatsApp.

[0] ANNOUNCE BAR: sticky, "⚡ Resposta em menos de 24h · Apenas ${price}"

[1] HERO (min-height:100vh, texto centralizado):
  ${hero ? `Background: [HERO_BG]` : `Background: gradiente do nicho`}
  - Headline PAS poderosa (máx 10 palavras) com <mark>
  - Sub: 2 frases validando a dor
  - ${product ? `[PRODUTO] abaixo da headline` : `Ícone grande ou visual CSS`}
  - Preço âncora: ~~R$XX~~ → ${price}
  - BOTÃO WHATSAPP: background:#25D366; border-radius:99px; display:flex; align-items:center; gap:10px; font-size:17px; font-weight:900; padding:18px 32px
    Ícone WhatsApp SVG inline (branco) + "FALAR AGORA NO WHATSAPP"
    href="https://wa.me/55XXXXXXXXXX?text=Olá%2C%20quero%20saber%20mais%20sobre%20${encodeURIComponent(pageName)}"
    (use placeholder de número — o usuário vai substituir)
  - Trust badges: "🔒 Privado" · "⚡ Resposta rápida" · "🛡️ Garantia"

[2] PROVA SOCIAL (padding:60px 20px):
  - H2: "O que dizem quem já [resultado]"
  - 4 cards de depoimento grid 2 col (baseados nos depoimentos reais ou criados)
  ${persons.length > 0 ? `Avatares: ${persons.slice(0,4).map((p,i)=>`[P${i+1}]`).join(', ')}` : 'Círculos CSS com inicial'}
  ${videos.length > 0 ? `Vídeo de depoimento: [V1]` : ''}

[3] COMO FUNCIONA (padding:60px 20px, fundo alternado):
  - H2: "Como funciona"
  - 3 passos horizontais simples: 1. Envia mensagem → 2. Recebe análise → 3. Resultado
  - Cada passo: emoji grande + título + 1 frase

[4] CTA FINAL (padding:80px 20px, fundo escuro):
  - Headline emocional curta
  - Botão WhatsApp idêntico ao do hero
  - Linha: "Atendimento humano · Privado · Resposta rápida"

[STICKY MOBILE]: botão WhatsApp fixo no bottom`
  }

  if (funnel === 'ferramenta_freemium') {
    return `${briefing}

━━━ ESTRUTURA: FERRAMENTA FREEMIUM ━━━

Página que parece um SaaS real. Cada seção deve usar o copy REAL dos anúncios e da landing page acima — não invente copy genérico.

[0] NAVBAR (height:56px, sticky, fundo --bg, border-bottom:1px solid --border):
  Logo + nome à esquerda | Badge "GRÁTIS" + botão "Upgrade → ${price}" (pill acento) à direita

<!-- cc:announce -->
[1] HERO (padding:80px 20px, fundo --bg, text-align:center):
  - H1 impactante baseado nos hooks dos anúncios: clamp(2.4rem,6vw,4rem), font-weight:900
  - Sub: 1 frase clara do benefício principal (do copy original)
  - INPUT PRINCIPAL visível (campo relevante pro nicho: username, URL, CPF, nome, etc.)
    padding:16px 20px; border:2px solid --border; border-radius:12px; font-size:1rem; width:100%; max-width:480px
    + Botão de ação ao lado ou abaixo: "Analisar Agora →" (pill, acento, padding:16px 32px, font-weight:800)
  - Social proof abaixo: "✦ +X.XXX usuários ativos · X.XXX análises feitas hoje"
    (use números verossímeis para o nicho)
<!-- /cc:announce -->

<!-- cc:hero -->
[2] DEMO INTERATIVA (padding:60px 20px, fundo --bg-alt, border-radius:16px, max-width:640px, margin:0 auto):
  Título: "Veja como funciona — teste agora"
  - INPUT FUNCIONAL: analise o texto original acima e identifique o tipo EXATO de input do produto original
    (username Instagram, URL do site, domínio, CPF, keyword, email, nome, etc.)
    Placeholder realista para o nicho "${niche}". O input deve ser idêntico ao mecanismo do original.
  - Botão "Analisar →" dispara simulação JS:
    1. Botão muda para "Analisando..." + spinner CSS (border:3px solid --accent, animation:spin 0.8s linear infinite)
    2. Após 1500ms (setTimeout): resultado aparece com opacity transition (0→1, 300ms)
  - RESULTADO SIMULADO com dados VEROSSÍMEIS E ESPECÍFICOS para o nicho "${niche}":
    Gere 3-4 métricas numéricas realistas — adapte ao nicho (NÃO use genéricos como "Score: 85/100"):
    Ex Instagram/Social: "Seguidores: 12.483 · Engajamento: 4,2% · Alcance: ~8.900/post · Crescimento: +312/mês"
    Ex SEO/Site: "DA: 34 · Backlinks: 1.247 · Posição média Google: 18,4 · Velocidade: 2,1s"
    Ex Finanças/Crédito: "Score: 687 · Limite estimado: R$4.200 · Aprovação: 78% · Nível: Bom"
    Ex Conteúdo/Copy: "Hooks testados: 47 · Taxa clique: 6,8% · Viral score: 72/100 · Potencial: Alto"
    Ex Saúde/Fitness: "IMC: 24,3 · Meta em: 42 dias · Queima estimada: 0,4kg/semana · Nível: Moderado"
    3-4 métricas visíveis + restante com filter:blur(8px) + overlay escuro com cadeado 🔒
    Overlay: "🔒 Relatório completo disponível no plano Pro" + botão "DESBLOQUEAR — ${price}"
  JS OBRIGATÓRIO: captura o valor digitado e exibe no resultado personalizado
  Padrão: function runDemo(btn){const v=document.getElementById('demoInput').value||'exemplo';btn.disabled=true;btn.innerHTML='Analisando... <span class="spin"></span>';setTimeout(function(){document.getElementById('demoUser').textContent=v;document.getElementById('demoResult').style.cssText='display:block;opacity:1'},1500)}
  NUNCA use opacity:0 no estado inicial sem garantir o reveal via JS inline no mesmo script
<!-- /cc:hero -->

<!-- cc:benefits -->
[3] FEATURES GRID (padding:80px 20px):
  H2: "Tudo que você consegue com ${pageName}"
  Grid 2-3 colunas, gap:20px:
  Gere 8-10 cards baseados nas forças e features reais da ferramenta. Cada card:
  - Ícone SVG inline (20x20, cor --accent)
  - Título da feature (font-weight:700)
  - Descrição curta 1 frase (resultado concreto)
  - Badge no canto: "GRÁTIS" (verde) | "PRO" (acento) | "EM BREVE" (cinza)
  background:--surface; border:1px solid --border; border-radius:16px; padding:24px
<!-- /cc:benefits -->

<!-- cc:testimonials -->
[4] DEPOIMENTOS (padding:80px 20px, fundo --bg-alt):
  H2: "Quem usou ${pageName} não voltou para o manual"
  Grid 2 colunas (mobile:1 col):
  4 cards — use os depoimentos reais ou crie 4 ultra-realistas com nome brasileiro, cidade, resultado específico em negrito
  ${persons.length > 0 ? `Avatares reais: ${persons.slice(0,4).join(', ')}` : 'Avatar: círculo CSS com inicial do nome, cor --accent'}
  Card: background:--surface; border:1px solid --border; border-radius:16px; padding:24px
  Estrutura: ★★★★★ | quote | nome + cidade + resultado em destaque (cor --accent, font-weight:700)
<!-- /cc:testimonials -->

<!-- cc:guarantee -->
[5] PRICING (padding:80px 20px, text-align:center):
  H2: "Escolha seu plano"
  Dois cards lado a lado (mobile:empilhados), gap:20px, max-width:700px, margin:0 auto:

  CARD GRÁTIS (border:1px solid --border; border-radius:20px; padding:32px):
  - Badge "GRÁTIS"
  - Preço: R$0
  - 4-5 limitações listadas com ✗ vermelho (baseadas nas fraquezas reais do plano grátis)

  CARD PRO (border:2px solid --accent; border-radius:20px; padding:32px; position:relative):
  - Badge "MAIS POPULAR" (position:absolute; top:-14px; background:--accent; color:#fff; border-radius:99px; padding:4px 16px; font-size:12px; font-weight:700)
  - Preço: ${price} (font-size:2.5rem; font-weight:900)
  - 6-8 benefícios com ✓ verde (baseados nos pontos fortes reais)
  - Botão "QUERO O PLANO PRO →" (pill, acento, width:100%, padding:18px, font-weight:900)
  - Garantia abaixo do botão: "🛡️ Garantia de 7 dias — devolução total sem perguntas"

  Se houver bônus nos anúncios: seção BÔNUS logo abaixo do pricing:
  H3: "Bônus incluídos no plano Pro"
  Grid 2-3 col, cards com: ícone + nome do bônus + valor original riscado + "INCLUSO GRÁTIS"
<!-- /cc:guarantee -->

<!-- cc:faq -->
[6] FAQ (padding:80px 20px, max-width:680px, margin:0 auto):
  H2: "Suas dúvidas respondidas"
  5 perguntas reais do nicho (baseadas no copy original e fraquezas identificadas)
  Accordion CSS: cada item tem input[type=checkbox] hidden + label como header + div.faq-body
  CSS: .faq-body{max-height:0;overflow:hidden;transition:max-height 0.3s ease}
       input:checked ~ .faq-body{max-height:300px}
  Sem JavaScript no accordion — apenas CSS.
<!-- /cc:faq -->

<!-- cc:cta-final -->
[7] ÚLTIMA CHAMADA (padding:80px 20px, fundo --accent, text-align:center):
  - H2 curto e emocional (cor #fff, font-size:clamp(1.8rem,5vw,3rem))
  - Sub: 1 frase de urgência ou escassez plausível
  - Botão "COMEÇAR AGORA — ${price}" (fundo #fff, cor --accent, pill, padding:20px 48px, font-weight:900)
  - Abaixo: "🔒 Pagamento seguro · 🛡️ Garantia 7 dias · ⚡ Acesso imediato"
<!-- /cc:cta-final -->

[DESIGN ESPECIAL]:
- Fontes dos resultados/dados: JetBrains Mono ou monospace do Google Fonts
- Skeleton loader nos campos de resultado (shimmer: @keyframes shimmer{0%{background-position:-200%}100%{background-position:200%}})
- Sticky bottom bar mobile: "Testar grátis + Upgrade ${price}" com 2 botões`
  }

  if (funnel === 'vsl') {
    return `${briefing}

━━━ ESTRUTURA: VSL (VIDEO SALES LETTER) ━━━

Vídeo como elemento principal. O texto suporta o vídeo, não compete com ele.

[0] ANNOUNCE BAR: sticky, urgência leve

[1] HERO VSL (padding-top:40px, fundo escuro --bg ou gradiente):
  - Headline acima do vídeo (máx 8 palavras, cor clara): promessa do vídeo
  - Sub pequena: "Assista até o final — tem uma oferta especial no fim"
  ${videos.length > 0 ? `- [V1] como vídeo principal (controls, sem autoplay): max-width:640px, width:100%, border-radius:16px, box-shadow grande` : `- Player placeholder CSS (fundo escuro, botão play centralizado, border-radius:16px)`}
  - Abaixo do vídeo: 3 trust badges discretos

[2] COPY PRÉ-VENDA (padding:60px 20px, max-width:640px):
  - Para quem está assistindo: valida a dor em 2 parágrafos
  - "Você vai descobrir no vídeo:" + 4-5 bullets de curiosidade (resultado sem revelar o método)

[3] OFERTA (padding:60px 20px, fundo alternado):
  - H2: o nome do produto em destaque
  - ${product ? `[PRODUTO] com sombra colorida` : `Visual CSS do produto`}
  - Lista de 6-8 o que está incluído (emoji + item + valor percebido)
  - Preço âncora: ~~R$XX~~ → ${price}
  - Botão CTA pill grande (max-width:480px, padding:20px)
  - "Acesso imediato após a compra"

[4] DEPOIMENTOS (grid 2 col):
  - 4 cards de resultado (focados em transformação, não em features)
  ${persons.length > 0 ? `Avatares: [PESSOAS]` : ''}

[5] GARANTIA + FAQ (padding:60px 20px, max-width:600px):
  - Garantia 7 dias em destaque
  - 4 perguntas rápidas (accordion JS)

[6] CTA FINAL (fundo escuro, padding:80px 20px):
  - Headline de urgência
  - Preço grande
  - Botão CTA (pulse animation)
  - Métodos de pagamento`
  }

  // landing_page (padrão)
  return `${briefing}

━━━ ESTRUTURA: LANDING PAGE (10 SEÇÕES) ━━━

PRINCÍPIO: Uma seção = uma mensagem = um elemento focal. Wrapper: max-width:560px; margin:0 auto; padding:52px 20px.

━ [0] ANNOUNCE BAR (sticky top, z-index:200, background:--accent, color:#fff, padding:9px 16px, text-align:center, font-size:12px, font-weight:700)
"⏳ Oferta de lançamento — acesso por apenas ${price} · Encerra em: <span id='cd'>carregando...</span>"
JS countdown: 24h a partir do load.

━ [1] NAV (height:56px, sticky, top:38px, z-index:100, background:--bg com 96% opacidade, border-bottom:1px solid --border)
Logo emoji + nome | botão pill "Comprar ${price}" à direita.

━ [2] HERO (padding-top:56px, min-height:100vh, centralizado)
${hero ? `Background [HERO_BG] com overlay rgba(0,0,0,.72). Texto branco.` : `Gradiente dramático do nicho. Texto branco.`}
1. Rating pill "★★★★★ [X] avaliações · [nicho] comprovado"
2. H1 PAS (clamp 22-30px, weight:900): "Nunca mais [DOR] — [SOLUÇÃO em 6 palavras]". <mark> em palavras-chave.
3. Sub (13px, rgba branco .8, max-width:380px): 2 frases quebrando objeção #1.
4. ${product ? `[PRODUTO] max-width:380px, border-radius:18px, sombra colorida` : `Visual CSS premium`}
5. Prova social: ${persons.length > 0 ? `3 avatares circulares [PESSOAS] (36px, margin-left:-8px)` : `3 círculos CSS com iniciais`} + "★★★★★ +X pessoas já [resultado]" (11px)
6. Preço âncora: ~~R$XX~~ → ${price} (font-size:2.4rem, weight:900)
7. Botão CTA pill (border-radius:99px, max-width:380px, padding:15px 28px, gradient acento)
8. Trust badges: "🔒 Seguro · ⚡ Acesso imediato · 🛡️ 7 dias de garantia"

━ [3] PROBLEMA → SOLUÇÃO (padding:52px 20px, fundo alternado)
Layout 50/50 desktop, empilhado mobile.
Tag "Você se identifica?" | H2 "Você já tentou [solução comum] e não funcionou?"
3-4 bullets de dor (ícone ✗, sem card boxes).
Parágrafo transição em destaque (border-left:4px solid --accent, itálico, negrito).

━ [4] APRESENTAÇÃO DO PRODUTO (padding:52px 20px, centralizado)
Tag "✓ A SOLUÇÃO" | Nome produto (clamp 2.5-4rem, cor --accent, weight:900)
Parágrafo 3 frases descrevendo o produto.
${product ? `[PRODUTO] display:block; margin:40px auto; max-width:400px` : `Mockup CSS com gradiente`}
Lista 6-8 benefícios: emoji + resultado específico + prazo/contexto.

━ [5] DEPOIMENTOS (padding:52px 20px)
H2: "O que dizem quem já usou"
Grid 2 col (mobile:1), gap:20px, max-width:900px.
Card: ${persons.length > 0 ? `avatar 48px [PESSOAS]` : `círculo CSS com inicial`} + nome + cidade + ★★★★★ | texto depoimento itálico | tag verde "✓ [resultado obtido]"
${videos.length > 0 ? `Vídeo depoimento [V1] após o grid.` : ''}

━ [6] PARA QUEM É (padding:52px 20px, fundo alternado, centralizado)
H2: "Este [produto] é para você se..."
5-6 perfis: ✦ + descrição 1 linha. Frase final + CTA repetido.

━ [7] GARANTIA (padding:52px 20px, centralizado, max-width:580px)
🛡️ 4.5rem | H2 "Garantia incondicional de 7 dias"
1 parágrafo forte + caixa destaque (border:2px solid --green).

━ [8] FAQ ACCORDION (padding:52px 20px, max-width:720px)
5 itens JS toggle: "Funciona para iniciantes?" / "Em quanto tempo?" / "Como acesso?" / "Por que tão barato?" / "E se não funcionar?"

━ [9] CTA FINAL (padding:80px 20px, centralizado, fundo escuro)
H2 emocional | 4 bullets ✦ | preço âncora | botão pulse | "🔒 100% seguro · ⚡ Acesso imediato · 🛡️ 7 dias"

━ [STICKY MOBILE] position:fixed;bottom:0; @media(max-width:768px){display:flex} — nome + preço | botão "COMPRAR AGORA"`
}

export async function POST(req: NextRequest) {
  // Auth guard
  const userIdHeader = req.headers.get('x-user-id')
  const userId = userIdHeader ? Number(userIdHeader) : null

  // Usuário sem JWT → plano gratuito por IP/sessão
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const sessionId = req.headers.get('x-session-id') || 'anonymous'

  if (!userId) {
    const freeUsage = await dbGetFreeUsage(ip, sessionId)
    if ((freeUsage?.analises_usadas ?? 0) >= 1) {
      return NextResponse.json({
        error: 'Você usou sua análise gratuita. Acesse o RatoAds completo com 10 análises por apenas R$XX.',
        upgrade: true,
      }, { status: 402 })
    }
  } else {
    const user = await dbGetUserById(userId)
    if (!user || !user.ativo) {
      return NextResponse.json({ error: 'Conta inativa ou não encontrada.' }, { status: 403 })
    }
    if (user.analises <= 0) {
      return NextResponse.json({
        error: 'Limite de análises atingido. Adquirir Versão Completa.',
        upgrade: true,
      }, { status: 402 })
    }
  }

  const { url } = await req.json().catch(() => ({ url: null }))
  if (!url) return NextResponse.json({ error: 'URL obrigatória' }, { status: 400 })

  if (!url.includes('view_all_page_id') && !url.includes('search_type=page')) {
    return NextResponse.json({
      error: 'URL inválida. Abra a biblioteca de anúncios, filtre por um anunciante específico e copie a URL completa (deve conter "view_all_page_id=...").'
    }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      // Keepalive global: envia heartbeat a cada 15s para evitar timeout do nginx/Hostinger
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'heartbeat', message: 'Processando...' })}\n\n`))
        } catch {}
      }, 15000)

      try {
        // 0. Cache check — evita chamadas à API se já analisado nas últimas 24h
        const pageId = new URL(url).searchParams.get('view_all_page_id')
        if (pageId) {
          const cached = await dbGetCachedAnalysis(pageId)
          if (cached) {
            console.log('[Cache HIT] pageId:', JSON.stringify(pageId), '| length:', pageId.length)
            send({ step: 'scraping', message: '✓ Resultado em cache. Carregando...', percent: 60 })
            const analysis = JSON.parse(cached.analysis)
            // Cache hit — não debita créditos do usuário
            await dbLogAnalysis(userId, ip)
            if (userId) await dbLogActivity(userId, 'analyze', { url, page_id: pageId, cached: true })
            let newAnalises: number | undefined
            if (userId) {
              const updatedUser = await dbGetUserById(userId)
              newAnalises = updatedUser?.analises
            }
            send({ step: 'done', message: 'Análise concluída (cache).', percent: 100, data: { analysis, generatedHtml: cached.html, analises: newAnalises } })
            controller.close()
            return
          }
        }

        // 1. Scrape anúncios
        send({ step: 'scraping', message: 'Conectando à biblioteca de anúncios...', percent: 10 })
        const ads = await scrapeAds(url)

        if (!Array.isArray(ads) || ads.length === 0) {
          send({ step: 'error', message: 'Nenhum anúncio encontrado. Verifique se o anunciante tem anúncios ativos e se a URL está correta.' })
          controller.close()
          return
        }

        send({ step: 'scraping', message: `✓ ${ads.length} anúncios encontrados. Lendo página de destino...`, percent: 25 })

        // 2. Scrape landing page — Cheerio + headless em paralelo (headless só aguardado se cheerio falhar)
        const landingUrl = extractLandingUrl(ads)
        console.log('[Landing] URL detectada:', landingUrl)

        // Preparar dados de ads enquanto landing page carrega — sem limite
        const adsForClaude = ads.map((ad: Record<string, unknown>) => {
          const snap = ad.snapshot as Record<string, unknown> | undefined
          return {
            body: (snap?.body as Record<string, unknown>)?.text || ad.ad_creative_bodies,
            title: snap?.title,
            cta: snap?.cta_text,
            link: snap?.link_url,
            isActive: ad.isActive,
            startDate: ad.startDate,
          }
        })

        let landingPage = landingUrl ? await scrapeLandingPage(landingUrl) : null

        if (landingUrl && (!landingPage || landingPage.fullText.length < 500 || landingPage.fullText.split('\n').filter(l => l.trim().length > 50).length < 2)) {
          send({ step: 'analyzing_page', message: 'Renderizando página (modo avançado)...', percent: 30 })
          // Headless já rodando em paralelo com o cheerio — aguarda resultado
          const headless = await scrapeLandingPageHeadless(landingUrl)
          if (headless && headless.fullText.length > (landingPage?.fullText.length ?? 0)) {
            landingPage = headless
            console.log('[Landing] Headless OK — texto:', headless.fullText.length, 'chars')
          }
        }

        send({ step: 'analyzing_page', message: 'Analisando copy e estrutura da oferta...', percent: 42 })

        const landingPageLoaded = !!(landingPage && landingPage.fullText.length > 100)

        // 3. Análise Claude
        send({ step: 'scoring', message: 'Calculando score e identificando ângulos...', percent: 50 })
        const { text: analysisText, inputTokens: analysisInputTokens, outputTokens: analysisOutputTokens } = await callClaude(`TOTAL DE ANÚNCIOS ATIVOS: ${ads.length}

TODOS OS ANÚNCIOS (copies completos):
${JSON.stringify(adsForClaude)}

PÁGINA DE VENDAS DO CONCORRENTE:
${landingPage ? `
Título: ${landingPage.title}
Headlines: ${landingPage.headings.join(' | ')}
CTAs: ${landingPage.ctas.join(' | ')}
Preços detectados: ${landingPage.prices.join(', ') || 'não detectado'}
Depoimentos encontrados: ${landingPage.testimonials.length}
Texto completo da página: ${landingPage.fullText}
` : 'Não disponível'}
${!landingPageLoaded ? '\nATENÇÃO: landing page não carregou. Baseie a análise APENAS nos anúncios. Seja explícito no "reason" que a análise é parcial.' : ''}

Retorne o JSON conforme o schema obrigatório:`, `Você é um analista sênior de marketing digital brasileiro especializado em performance de paid media low ticket. Sua tarefa é analisar um concorrente com profundidade cirúrgica.

INSTRUÇÕES:
- Analise TODOS os anúncios enviados, não apenas uma amostra
- Identifique padrões de escalada: anúncios com mais variações de copy/criativo = mais verba investida
- Identifique o ângulo dominante baseado em frequência real nos anúncios, não suposição
- Gere 3 scripts de CTV (conteúdo tipo UGC) baseados nos hooks que mais aparecem
- Seja honesto no score: não infle nem deflate. Score 8+ = operação lucrativa e profissional com evidências claras
- Analise a estrutura da landing page criticamente — design, copy, fluxo de conversão, objeções não tratadas
- Se não encontrar dados suficientes (ex: landing page sem texto), seja explícito no reason e reduza o score
- RETORNE APENAS JSON VÁLIDO, sem markdown, sem explicação

SCHEMA OBRIGATÓRIO:
{"score":0-10,"verdict":"Vale entrar|Cuidado|Evitar","reason":"3-4 frases","dominant_angle":"...","hook_patterns":["...","...","..."],"page_name":"...","niche":"...","price_anchor":"... ou null","funnel_type":"landing_page|quiz|ferramenta_freemium|whatsapp|vsl","design_context":{"vibe":"...","primary_color":"#hex"},"weak_points":["...","...","...","...","..."],"strong_points":["...","...","..."],"ad_analysis":{"total_ads":0,"dominant_hooks":["...","...","..."],"copy_patterns":"...","escalation_signal":"..."},"ctv_recommendations":[{"hook":"...","angle":"...","script":"..."},{"hook":"...","angle":"...","script":"..."},{"hook":"...","angle":"...","script":"..."}]}`, 'claude-sonnet-4-6', 4096)
        let analysis
        try {
          if (analysisText.startsWith('__CLAUDE_ERROR__:')) {
            const sdkError = analysisText.replace('__CLAUDE_ERROR__:', '')
            console.error('[Claude] SDK error:', sdkError)
            send({ step: 'error', message: `Claude SDK: ${sdkError.slice(0, 120)}` })
            controller.close()
            return
          }
          if (!analysisText) {
            send({ step: 'error', message: 'Claude retornou resposta vazia. Verifique os logs do servidor.' })
            controller.close()
            return
          }
          const rawJson = analysisText.match(/\{[\s\S]*\}/)?.[0] ?? null
          if (!rawJson) throw new Error('Resposta inválida do modelo — JSON não encontrado')
          analysis = JSON.parse(rawJson)
        } catch {
          console.error('[Claude] Falha ao parsear análise — resposta recebida:', analysisText.slice(0, 300))
          send({ step: 'error', message: `Falha ao parsear resposta Claude: "${analysisText.slice(0, 80)}"` })
          controller.close()
          return
        }

        send({ step: 'scoring', message: `✓ Score ${analysis.score}/10 — ${analysis.verdict}. Preparando modelagem...`, percent: 65 })

        // 4. Mídia do concorrente — usa apenas pageMedia (classifyMediaItems já aplicado no scraper)
        const pageMedia: MediaItem[] = (landingPage as (typeof landingPage & { media?: MediaItem[] }) | null)?.media ?? []
        // Adiciona vídeos dos anúncios ao pageMedia se não estiverem lá
        const adVideos = extractAdVideos(ads)
        adVideos.forEach(v => {
          if (!pageMedia.find(m => m.url === v)) {
            pageMedia.push({ url: v, type: 'video', role: 'video' })
          }
        })
        const adCopies = adsForClaude.map(a => a.body).filter(Boolean).map(t => String(t)).join('\n\n')
        // Para embed base64, usa as URLs do pageMedia
        const imageUrls = pageMedia.filter(m => m.type === 'image').map(m => m.url).slice(0, 8)
        console.log('[Media] MediaItems classificados:', pageMedia.length, '| roles:', pageMedia.map(m => m.role).join(',').slice(0, 100))

        // 5. Geração HTML
        send({ step: 'generating', message: `Gerando página de vendas modelada (tipo: ${analysis.funnel_type || 'landing_page'})...`, percent: 75 })
        console.log('[Funil] Tipo detectado:', analysis.funnel_type || 'landing_page')
        const { text: rawText, inputTokens: htmlInputTokens, outputTokens: htmlOutputTokens } = await callClaude(
          buildHtmlPrompt(analysis, landingPage, adCopies, pageMedia),
          `Você é o melhor desenvolvedor frontend do Brasil especializado em landing pages de alta conversão.

Sua missão: gerar um HTML/CSS/JS ÚNICO, LIMPO e PROFISSIONAL que seja uma versão MELHORADA do funil original.

REGRAS ABSOLUTAS DE QUALIDADE:

1. ESTRUTURA LIMPA
- Cada seção tem seu próprio bloco separado com padding generoso (80px vertical no desktop, 48px no mobile)
- Zero sobreposição de elementos — cada coisa no seu lugar
- Hierarquia visual clara: título grande, subtítulo médio, corpo pequeno
- Máximo 1200px de largura, sempre centralizado com margin: 0 auto

2. CSS ORGANIZADO
- NUNCA use !important no CSS principal — só no revealFix
- PROIBIDO: IntersectionObserver, qualquer JS que mude opacity/visibility/display após load (causa tela preta/conteúdo invisível)
- PROIBIDO: opacity:0 ou visibility:hidden em elementos de conteúdo no load inicial
- CSS variables no :root para todas as cores e fontes
- Reset básico no início: *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
- OBRIGATÓRIO: html, body { opacity: 1; visibility: visible; background: var(--bg); color: var(--text); }

3. TIPOGRAFIA
- SEMPRE importe fontes do Google Fonts no <head>
- NUNCA use Arial, Roboto, system-ui sozinhos
- Escolha baseada no nicho do produto

4. SEÇÕES OBRIGATÓRIAS NA ORDEM CERTA — sem sobreposição, sem mistura:
   a) Barra de urgência (se houver countdown)
   b) Header/Nav simples
   c) Hero — headline + subheadline + CTA + social proof
   d) Problema (dores do público)
   e) Solução/O que é o produto
   f) Features/O que inclui (cards em grid)
   g) Prova social (depoimentos reais do briefing)
   h) Oferta/Pricing (preço real, desconto, garantia)
   i) FAQ accordion
   j) CTA final

5. IMAGENS
- Use as URLs reais fornecidas no briefing
- Se não houver URL, use gradiente CSS ou SVG inline — NUNCA placeholder de texto

6. RESPONSIVIDADE
- Mobile first: escreva o CSS base para mobile, use @media (min-width: 768px) para desktop
- Em mobile: 1 coluna, padding 16px, font-size do hero máximo 36px
- Em desktop: grid de 2-3 colunas onde fizer sentido, font-size do hero 56-72px

7. JAVASCRIPT
- Apenas o necessário: countdown timer se houver, accordion para FAQ
- NUNCA use IntersectionObserver para revelar conteúdo (causa tela em branco)
- NUNCA coloque JS inline em atributos HTML (onclick="...")
- Todo JS vai em uma única tag <script> antes do </body>

MARCADORES DE SEÇÃO (CRÍTICO — sem isso o editor ao vivo não funciona):
Envolva cada seção com comentários exatos no formato abaixo. Sem exceção.
<!-- cc:announce -->[barra de topo]<!-- /cc:announce -->
<!-- cc:hero -->[seção hero completa]<!-- /cc:hero -->
<!-- cc:benefits -->[benefícios/features]<!-- /cc:benefits -->
<!-- cc:testimonials -->[depoimentos]<!-- /cc:testimonials -->
<!-- cc:guarantee -->[garantia]<!-- /cc:guarantee -->
<!-- cc:faq -->[FAQ]<!-- /cc:faq -->
<!-- cc:cta-final -->[CTA final]<!-- /cc:cta-final -->
O <style> e <script> ficam FORA dos marcadores.

CHECKLIST FINAL antes de fechar o HTML:
□ O CSS tem reset no início?
□ As fontes estão sendo importadas?
□ Nenhum elemento está com opacity:0 ou visibility:hidden no CSS principal?
□ Todas as seções têm espaçamento adequado sem sobreposição?
□ O HTML passa o teste mental de "isso parece profissional"?

PROIBIDO:
- Bootstrap, Tailwind, jQuery, qualquer CDN externo
- Fontes genéricas (Arial, Helvetica, sans-serif puro)
- IntersectionObserver ou qualquer JS que revele conteúdo após load
- opacity:0 ou display:none em elementos visíveis no load inicial
- Design genérico sem personalidade`,
          'claude-sonnet-4-6',
          8192
        )
        let generatedHtml = rawText.replace(/^```html\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
        if (!generatedHtml.startsWith('<!')) {
          const idx = generatedHtml.indexOf('<!DOCTYPE')
          if (idx > 0) generatedHtml = generatedHtml.slice(idx)
        }
        // Detect and repair truncated HTML
        if (!generatedHtml.includes('</html>')) {
          console.warn('[HTML] Geração truncada — fechando tags manualmente')
          if (!generatedHtml.includes('</body>')) generatedHtml += '\n</body>'
          generatedHtml += '\n</html>'
        }

        // 6. Pós-processamento: embed imagens como base64
        send({ step: 'generating', message: 'Embedando imagens e finalizando...', percent: 90 })
        console.log(`[Media] Embedando ${imageUrls.length} imagens como base64...`)
        for (const imgUrl of imageUrls) {
          if (!imgUrl || !generatedHtml.includes(imgUrl)) continue
          const b64 = await downloadAsBase64(imgUrl, 600)
          if (b64) {
            generatedHtml = generatedHtml.split(imgUrl).join(b64)
            console.log(`[Media] Embedada: ${imgUrl.slice(0, 60)}`)
          }
        }

        const revealScript = `<script id="cc-reveal">(function(){
  function reveal(){
    document.querySelectorAll('*').forEach(function(el){
      var s=window.getComputedStyle(el);
      if(parseFloat(s.opacity)<0.1&&s.position!=='fixed'&&el.tagName!=='SCRIPT'&&el.tagName!=='STYLE'){
        el.style.setProperty('opacity','1','important');
        el.style.setProperty('transform','none','important');
        el.style.setProperty('visibility','visible','important');
      }
    });
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',reveal);
  }else{reveal();}
  setTimeout(reveal,300);
  setTimeout(reveal,800);
})()</` + `script>`
        if (generatedHtml.includes('</body>')) {
          generatedHtml = generatedHtml.replace('</body>', revealScript + '</body>')
        } else {
          generatedHtml = generatedHtml + revealScript
        }

        // Decrementa uso após sucesso e loga
        const analysisCreditCost = computeCredits(
          analysisInputTokens + htmlInputTokens,
          analysisOutputTokens + htmlOutputTokens,
          'claude-sonnet-4-6'
        )
        let newAnalises: number | undefined
        if (userId) {
          await dbDecrementAnalises(userId)
          await dbDecrementCreditosN(userId, analysisCreditCost)
          const updatedUser = await dbGetUserById(userId)
          newAnalises = updatedUser?.analises
        } else {
          await dbIncrementFreeAnalises(ip, sessionId)
        }
        await dbLogAnalysis(userId, ip)
        if (userId) await dbLogActivity(userId, 'analyze', { url, page_id: pageId })

        // Salva no cache para evitar chamadas repetidas em 24h
        if (pageId) {
          const saveWithRetry = async () => {
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                await dbSaveCachedAnalysis(pageId, JSON.stringify(analysis), generatedHtml)
                console.log('[Cache] Salvo com sucesso na tentativa', attempt)
                return
              } catch (e) {
                console.error(`[Cache] Falha tentativa ${attempt}:`, e)
                if (attempt < 2) await sleep(1000)
              }
            }
          }
          // await com timeout de 3s — não bloqueia se Turso estiver lenta
          await Promise.race([saveWithRetry(), sleep(3000)])
        }

        send({ step: 'done', message: 'Análise concluída. Abrindo editor_', percent: 100, data: { analysis, generatedHtml, analises: newAnalises } })
        controller.close()

      } catch (err) {
        console.error('[Route] Erro:', err)
        send({ step: 'error', message: err instanceof Error ? err.message : 'Erro interno' })
        controller.close()
      } finally {
        clearInterval(keepAlive)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
