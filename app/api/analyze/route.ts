import { NextRequest, NextResponse } from 'next/server'
import { load } from 'cheerio'
import {
  dbGetUserById,
  dbDecrementAnalises,
  dbGetFreeUsage,
  dbIncrementFreeAnalises,
  dbLogAnalysis,
  dbGetCachedAnalysis,
  dbSaveCachedAnalysis,
} from '@/lib/db'

export const maxDuration = 300

const APIFY_TOKEN = process.env.APIFY_TOKEN!

async function callClaude(prompt: string, systemPrompt?: string, model = 'claude-sonnet-4-6', maxTokens = 1024): Promise<string> {
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
    console.log('[callClaude] resultado size:', result.length, 'chars')
    return result
  } catch (err) {
    const e = err as Error
    console.error('[callClaude] ERRO nome:', e?.name)
    console.error('[callClaude] ERRO mensagem:', e?.message)
    console.error('[callClaude] ERRO stack:', e?.stack?.slice(0, 500))
    return `__CLAUDE_ERROR__:${e?.message || String(err)}`
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
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
    runData = await runRes.json()
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
    const statusData = await statusRes.json()
    status = statusData?.data?.status ?? 'FAILED'
    console.log(`[Apify] Tentativa ${attempts + 1}: status=${status}`)
    attempts++
  }

  console.log('[Apify] Run finalizado com status:', status)

  const itemsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=999`
  )
  const items = await itemsRes.json()
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
    const runData = await runRes.json()
    const runId = runData?.data?.id
    if (!runId) return null

    let status = 'RUNNING'
    let attempts = 0
    while (['RUNNING', 'READY'].includes(status) && attempts < 30) {
      await sleep(4000)
      const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
      status = (await s.json())?.data?.status ?? 'FAILED'
      attempts++
    }
    if (status !== 'SUCCEEDED') return null

    const items = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=1`)).json()
    const d = items?.[0]
    if (!d) return null

    const testimonials: string[] = []
    const $ = load(d.html || '')
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
      title: d.title || '',
      headings: d.headings || [],
      bullets: d.bullets || [],
      testimonials: testimonials.slice(0, 8),
      prices: d.prices || [],
      ctas: d.ctas || [],
      images: d.images || [],
      videos: d.videos || [],
      fullText: d.text || '',
      structuredHtml: (d.html || '').slice(0, 20000),
      design: { colors: d.colors || [], fonts: [] },
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
Mobile-first. Wrapper: max-width:560px; margin:0 auto; padding:0 20px.
Paleta: defina --bg,--bg-alt,--text,--text2,--accent,--accent-dark,--border,--card-bg,--green:#16A34A no :root.
Botões: border-radius:99px (pílula), gradiente acento, font-weight:900.
Sem IntersectionObserver. Sem animações de scroll. Opacity:1 desde o load.
PRIMEIRA LINHA DO CSS (obrigatório): html,body{margin:0;padding:0;background:#fff;color:#111;opacity:1!important;visibility:visible!important}
Todos os elementos visíveis no load devem ter display:block/flex/grid — NUNCA display:none ou opacity:0 no estado inicial.`

  const briefing = `━━━ BRIEFING ━━━
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

${designRules}`

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

Interface de ferramenta real com funcionalidades pagas bloqueadas. Parece um SaaS — não uma LP.

[0] NAVBAR (height:56px, sticky, fundo --bg, border-bottom:1px solid --border):
  Logo + nome da ferramenta à esquerda
  Badge "FREE" à direita + botão "Upgrade ${price}" (pill, acento)

[1] HERO TOOL (padding:40px 20px):
  - H1 pequeno (20-22px): o que a ferramenta faz em 6 palavras
  - Sub: 1 frase do benefício principal
  - INPUT ou FORMULÁRIO PRINCIPAL visível e funcional (aparência):
    Campo de texto, select, ou inputs relevantes para o nicho
    Botão "Analisar / Verificar / Gerar" (acento, pill)
  - Nota: "Versão gratuita: X análises por dia"

[2] RESULTADO GRÁTIS (mostra 1 resultado parcial como preview):
  - Card de resultado com dados reais parciais (1-2 itens visíveis)
  - Resto do resultado com blur(6px) + overlay "Desbloqueie o relatório completo"
    Overlay: padding:24px; background:rgba(0,0,0,.7); border-radius:12px; text-align:center
    "🔒 Mais ${Math.floor(Math.random()*5)+3} insights disponíveis no plano Pro"
    Botão "DESBLOQUEAR TUDO — ${price}" (pill, acento, font-size:15px)

[3] O QUE VOCÊ DESBLOQUEIA (padding:60px 20px):
  - H2: "Tudo que você recebe no plano completo"
  - Lista de 6-8 funcionalidades premium (cada linha: ✓ emoji + feature + resultado específico)
  - Destaque: a funcionalidade mais valiosa em card separado com borda acento

[4] DEPOIMENTOS (grid 2 col, padding:60px 20px, fundo alternado):
  - 4 cards com resultado específico de quem usou a versão paga
  ${persons.length > 0 ? `Avatares: [PESSOAS]` : 'Círculos CSS'}

[5] PRICING (padding:60px 20px, centralizado):
  - Plano GRÁTIS vs Plano COMPLETO lado a lado
  - Free: features limitadas (3 itens riscados)
  - Pro: tudo liberado + preço ${price}
  - Botão "QUERO O PLANO COMPLETO" (pill, acento, max-width:380px)

[DESIGN ESPECIAL]: Use fontes monoespaçadas (JetBrains Mono ou similar) para os resultados.
Elementos de loading (skeleton shimmer animado) nos campos de resultado.`
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
        error: 'Você usou sua análise gratuita. Acesse o ClickClone completo com 10 análises por apenas R$XX.',
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
        error: 'Limite de análises atingido. Faça upgrade para continuar.',
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
        const analysisText = await callClaude(`TOTAL DE ANÚNCIOS ATIVOS: ${ads.length}

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
        // Keepalive: envia SSE ping a cada 15s para evitar timeout do nginx na Hostinger
        const keepAlive = setInterval(() => {
          try { controller.enqueue(encoder.encode(': ping\n\n')) } catch {}
        }, 15000)
        const rawText = await callClaude(
          buildHtmlPrompt(analysis, landingPage, adCopies, pageMedia),
          `Você é um dev front-end + copywriter brasileiro especialista em páginas de vendas de alta conversão para produtos low ticket. Você vai gerar uma página que seja SUPERIOR ao concorrente analisado.

FILOSOFIA:
- NÃO copie — melhore. Cada ponto fraco identificado DEVE ser corrigido na página
- Mantenha os pontos fortes do concorrente
- Use os hooks dos anúncios mais escalados como base para o hero e CTAs
- O design deve ser moderno, responsivo, e profissional
- Copy específico: números reais, benefícios tangíveis, sem vagueza

REGRAS TÉCNICAS:
- APENAS HTML puro (sem markdown, sem explicação)
- CSS inline via <style> no <head>
- Sem dependências externas (sem CDNs, sem fonts externas)
- Responsivo mobile-first
- Todos os CTAs com href="#comprar" ou data-cta="principal"
- Quando URLs de imagens reais forem fornecidas no briefing, USE-AS diretamente nas tags <img src='...'> e <video src='...'>. Quando não houver imagens disponíveis, use gradientes CSS ou SVG inline como fallback.
- JavaScript mínimo: apenas o essencial para interatividade

ANTI-TELA-PRETA (OBRIGATÓRIO — viola esta regra = página invisível):
- A PRIMEIRA regra CSS do <style> DEVE ser: html,body{background:#fff;color:#111;opacity:1!important;visibility:visible!important}
- NUNCA use display:none, opacity:0 ou visibility:hidden em elementos visíveis no load
- Se usar variáveis CSS (--bg, --text, etc.), defina valores claros explícitos no :root — nunca dependa de herança
- NUNCA use animações de entrada que dependem de JS para revelar conteúdo
- Todos os textos devem ter contraste mínimo: texto escuro (#111-#333) em fundo claro, ou texto claro (#eee-#fff) em fundo escuro — NUNCA texto preto em fundo preto

ESTRUTURA POR TIPO DE FUNIL:

landing_page:
- Hero com headline forte baseada no hook dominante dos anúncios
- Subheadline que resolve a objeção principal
- CTA acima da dobra (botão grande e visível)
- Seção de benefícios (3-5 itens com ícones simples)
- Prova social (3 depoimentos plausíveis para o nicho com nome e resultado)
- Garantia (7 ou 30 dias conforme o nicho)
- FAQ (3-5 perguntas reais do nicho)
- CTA final com urgência real
- Sticky mobile com CTA
- Cores baseadas no design_context

quiz:
- Container centralizado com barra de progresso visual
- 3-5 perguntas qualificadoras com botões de opção
- Resultado parcialmente revelado com blur nos dados mais valiosos
- CTA para desbloquear resultado completo
- Transições suaves entre steps via JavaScript

ferramenta_freemium:
- Interface de ferramenta com campo de input relevante
- Resultado parcial visível (ex: primeiros 2 itens)
- Blur progressivo nos dados mais valiosos
- Paywall elegante com CTA de upgrade
- Badge 'Grátis' + 'Pro' bem diferenciados

vsl:
- Área de vídeo como hero (placeholder escuro com ícone play)
- Headline acima do vídeo
- Copy de suporte abaixo
- CTA inicialmente oculto que aparece após 30s (via setTimeout)
- Depoimentos abaixo do vídeo

whatsapp:
- Página simples e direta
- Headline forte com benefício principal
- 3 bullets de benefício com ícone ✓
- Botão verde WhatsApp como único CTA (wa.me/... com link placeholder)
- 1-2 depoimentos curtos`,
          'claude-sonnet-4-6',
          16000
        )
        clearInterval(keepAlive)
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

        const revealFix = `<script id="cc-reveal">(function(){
function reveal(){document.querySelectorAll('*').forEach(function(el){
  var s=window.getComputedStyle(el);
  if(parseFloat(s.opacity)<0.1&&s.position!=='fixed'&&el.tagName!=='SCRIPT'&&el.tagName!=='STYLE'){
    el.style.setProperty('opacity','1','important');
    el.style.setProperty('transform','none','important');
    el.style.setProperty('visibility','visible','important');
  }
});}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',reveal);}else{reveal();}
setTimeout(reveal,300);setTimeout(reveal,800);
})();</script>`
        generatedHtml = generatedHtml.replace('</body>', revealFix + '</body>')

        // Decrementa uso após sucesso e loga
        let newAnalises: number | undefined
        if (userId) {
          await dbDecrementAnalises(userId)
          const updatedUser = await dbGetUserById(userId)
          newAnalises = updatedUser?.analises
        } else {
          await dbIncrementFreeAnalises(ip, sessionId)
        }
        await dbLogAnalysis(userId, ip)

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
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
