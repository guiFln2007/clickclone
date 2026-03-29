import { NextRequest, NextResponse } from 'next/server'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { load } from 'cheerio'

export const maxDuration = 300

const APIFY_TOKEN = process.env.APIFY_TOKEN!

async function callClaude(prompt: string, systemPrompt?: string, model = 'claude-sonnet-4-6'): Promise<string> {
  let assistantText = ''
  let resultText = ''
  try {
    for await (const msg of query({
      prompt,
      options: {
        ...(systemPrompt ? { systemPrompt } : {}),
        allowedTools: [],
        disallowedTools: ['Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Read', 'WebFetch', 'WebSearch', 'AskUserQuestion', 'Agent', 'TodoWrite', 'TodoRead'],
        maxTurns: 3,
        model,
      },
    })) {
      const m = msg as Record<string, unknown>
      // AssistantMessage: o texto está em m.message.content[], não em m.content[]
      if (m.type === 'assistant' && m.message) {
        const inner = m.message as Record<string, unknown>
        if (Array.isArray(inner.content)) {
          for (const block of inner.content as Array<{ type: string; text?: string }>) {
            if (block.type === 'text' && block.text) assistantText += block.text
          }
        }
      }
      // ResultMessage: fallback
      if (m.type === 'result' && typeof m.result === 'string' && m.result) {
        resultText = m.result
      }
    }
  } catch (err) {
    console.error('[callClaude] ERRO:', err)
  }
  console.log('[callClaude] assistant:', assistantText.length, '| result:', resultText.length)
  return assistantText || resultText
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
  console.log('[Apify] Iniciando scrape:', cleanUrl)

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [{ url: cleanUrl }], maxAds: 20 }),
    }
  )
  const runData = await runRes.json()
  console.log('[Apify] Run iniciado:', JSON.stringify(runData?.data?.id), 'status:', runData?.data?.status)

  const runId = runData?.data?.id
  if (!runId) {
    console.error('[Apify] Falha ao iniciar run:', JSON.stringify(runData))
    throw new Error('Falha ao iniciar scraper Apify')
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
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=40`
  )
  const items = await itemsRes.json()
  console.log('[Apify] Items retornados:', Array.isArray(items) ? items.length : typeof items)
  if (Array.isArray(items) && items.length > 0) {
    console.log('[Apify] Primeiro item (keys):', Object.keys(items[0]))
  }
  return items
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function downloadAsBase64(url: string, maxKB = 600): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Referer': new URL(url).origin },
      signal: AbortSignal.timeout(12000),
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

type ImageMeta = { src: string; alt: string; ctx: string }

function classifyMedia(images: ImageMeta[], videos: string[]): {
  hero: string | null
  product: string | null
  persons: string[]
  others: string[]
  videos: string[]
} {
  const personRx = /depo|testim|review|cliente|usuari|avatar|person|autor|avalia|perfil|member|foto.*pess/i
  const productRx = /produto|product|kit|mock|ebook|apostil|curso|pack|thumb|capa|cover|material|digital/i
  const heroRx = /hero|banner|background|\bbg\b|bg-|cover|header|topo|destaque|main/i

  const persons: string[] = []
  const products: string[] = []
  const heroes: string[] = []
  const others: string[] = []

  for (let i = 0; i < images.length; i++) {
    const { src, alt, ctx } = images[i]
    const combined = `${alt} ${ctx} ${src}`.toLowerCase()
    if (personRx.test(combined)) {
      persons.push(src)
    } else if (productRx.test(combined)) {
      products.push(src)
    } else if (heroRx.test(combined)) {
      heroes.push(src)
    } else if (i === 0) {
      heroes.push(src) // primeira imagem = provavelmente hero
    } else {
      others.push(src)
    }
  }

  const allSrcs = images.map(i => i.src)
  return {
    hero: heroes[0] || allSrcs[0] || null,
    product: products[0] || (heroes.length > 1 ? heroes[1] : null) || allSrcs[1] || null,
    persons: persons.slice(0, 6),
    others: [...heroes.slice(heroes[0] ? 1 : 0), ...products.slice(products[0] ? 1 : 0), ...others].slice(0, 4),
    videos: [...new Set(videos.filter(Boolean))].slice(0, 3), // deduplicado
  }
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

    return {
      title: d.title || '',
      headings: d.headings || [],
      paragraphs: [],
      bullets: d.bullets || [],
      testimonials: testimonials.slice(0, 8),
      prices: d.prices || [],
      ctas: d.ctas || [],
      images: d.images || [],
      videos: d.videos || [],
      fullText: d.text || '',
      structuredHtml: (d.html || '').slice(0, 20000),
      design: { colors: d.colors || [], fonts: [] },
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
    const images: ImageMeta[] = $('img').map((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || ''
      if (!src.startsWith('http')) return null
      const alt = ($(el).attr('alt') || '').toLowerCase()
      const pCtx = $(el).parents().slice(0, 4).map((_, p) => (($(p).attr('class') || '') + ' ' + ($(p).attr('id') || '')).toLowerCase()).get().join(' ')
      return { src, alt, ctx: pCtx }
    }).get().filter((x): x is ImageMeta => x !== null).slice(0, 15)
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

    return {
      title: $('title').text().trim(),
      headings: $('h1, h2, h3, h4').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 20),
      paragraphs: $('p').map((_, el) => $(el).text().trim()).get().filter(t => t.length > 30).slice(0, 30),
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
function buildHtmlPrompt(analysis: any, landingPage: any, hero: string | null, product: string | null, persons: string[], others: string[], videos: string[], adCopies: string): string {
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

  const mediaBriefing = `━━━ MANIFESTO DE MÍDIA ━━━
${hero ? `[HERO_BG] background-image do hero: style="background-image:linear-gradient(rgba(0,0,0,.70),rgba(0,0,0,.70)),url('${hero}');background-size:cover;background-position:center"` : '[HERO_BG] não disponível — use gradiente CSS'}
${product ? `[PRODUTO] <img src="${product}" alt="produto" style="display:block;margin:0 auto;max-width:400px;width:100%;border-radius:20px;box-shadow:0 40px 100px rgba(0,0,0,.25)">` : '[PRODUTO] não disponível — use mockup CSS'}
${persons.length > 0 ? `[PESSOAS] avatares:\n${persons.map((p, i) => `  [P${i+1}] <img src="${p}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--accent)">`).join('\n')}` : '[PESSOAS] não disponível — círculos CSS com inicial'}
${videos.length > 0 ? `[VÍDEOS]:\n${videos.map((v, i) => `  [V${i+1}] <video src="${v}" ${i===0?'autoplay muted loop playsinline':'controls'} style="display:block;margin:32px auto;max-width:560px;width:100%;border-radius:16px"></video>`).join('\n')}` : '[VÍDEOS] não disponível'}
⚠️ Nunca invente URLs. Use cada asset EXATAMENTE como está.`

  const designRules = `━━━ DESIGN ━━━
NICHO: ${niche} | VIBE: ${designVibe} | COR PRINCIPAL: ${primaryColor}
CORES CSS: ${cssColors} | FONTES: ${cssFonts}
Mobile-first. Wrapper: max-width:560px; margin:0 auto; padding:0 20px.
Paleta: defina --bg,--bg-alt,--text,--text2,--accent,--accent-dark,--border,--card-bg,--green:#16A34A no :root.
Botões: border-radius:99px (pílula), gradiente acento, font-weight:900.
Sem IntersectionObserver. Sem animações de scroll. Opacity:1 desde o load.
RETORNE APENAS o HTML completo começando com <!DOCTYPE html> até </html>. Sem markdown, sem explicação.`

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

${mediaBriefing}

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
  try {
    // Auth guard
    const userId = req.headers.get('x-user-id')
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL obrigatória' }, { status: 400 })

    // Validação: a URL precisa ter view_all_page_id para identificar o anunciante
    if (!url.includes('view_all_page_id') && !url.includes('search_type=page')) {
      return NextResponse.json({
        error: 'URL inválida. Abra a biblioteca de anúncios, filtre por um anunciante específico e copie a URL completa (deve conter "view_all_page_id=...").'
      }, { status: 400 })
    }

    // 1. Scrape anúncios
    const ads = await scrapeAds(url)

    if (!Array.isArray(ads) || ads.length === 0) {
      return NextResponse.json({
        error: 'Nenhum anúncio encontrado. Verifique se o anunciante tem anúncios ativos e se a URL está correta.'
      }, { status: 400 })
    }

    // 2. Scrape landing page — tenta Cheerio primeiro, headless como fallback
    const landingUrl = extractLandingUrl(ads)
    console.log('[Landing] URL detectada:', landingUrl)
    let landingPage = landingUrl ? await scrapeLandingPage(landingUrl) : null

    // Se o Cheerio retornou pouco texto (SPA ou Cloudflare), usa Apify Playwright
    if (landingUrl && (!landingPage || landingPage.fullText.length < 200)) {
      console.log('[Landing] Conteúdo insuficiente, tentando headless scraper...')
      const headless = await scrapeLandingPageHeadless(landingUrl)
      if (headless && headless.fullText.length > (landingPage?.fullText.length ?? 0)) {
        landingPage = headless
        console.log('[Landing] Headless OK — texto:', headless.fullText.length, 'chars')
      }
    }

    // 3. Preparar dados para Claude
    const adsForClaude = ads.slice(0, 7).map((ad: Record<string, unknown>) => {
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

    // 4. Análise Claude
    const analysisText = await callClaude(`TOTAL DE ANÚNCIOS ATIVOS: ${ads.length}
ANÚNCIOS (amostra com copies reais):
${JSON.stringify(adsForClaude)}

PÁGINA DE VENDAS DO CONCORRENTE:
${landingPage ? `
Título: ${landingPage.title}
Headlines: ${landingPage.headings.join(' | ')}
CTAs: ${landingPage.ctas.join(' | ')}
Preços detectados: ${landingPage.prices.join(', ') || 'não detectado'}
Depoimentos encontrados: ${landingPage.testimonials.length}
Texto completo (extrato): ${landingPage.fullText.slice(0, 1000)}
` : 'Não disponível'}

Retorne exatamente esta estrutura JSON:`, `Você é um estrategista de marketing digital brasileiro especializado em Meta Ads low ticket. Analisa concorrentes com olhar cirúrgico — extrai o que está funcionando, identifica brechas e gera inteligência acionável. Retorne APENAS JSON válido, sem markdown, sem explicação.
{
  "score": <número 1-10 — baseado em: volume de ads ativos, qualidade da copy, força da oferta, clareza da proposta>,
  "verdict": "<Vale entrar | Não vale entrar>",
  "reason": "<análise direta em 3 frases: o que está funcionando, o que está faltando, e qual é a oportunidade real>",
  "dominant_angle": "<o principal gatilho/ângulo usado — ex: 'Velocidade + resultado rápido', 'Dor financeira + solução acessível', 'Transformação de vida'>",
  "hook_patterns": ["<padrão de hook 1 extraído dos anúncios>", "<padrão 2>", "<padrão 3>"],
  "page_name": "<nome do produto/oferta>",
  "niche": "<nicho em 1-2 palavras>",
  "price_anchor": "<preço principal detectado, ex: R$19,90 — ou 'não detectado'>",
  "funnel_type": "<landing_page | quiz | ferramenta_freemium | whatsapp | vsl> — identifique pelo destino dos anúncios e estrutura da página: 'quiz' se há perguntas/triagem, 'whatsapp' se CTA principal é wa.me ou mensagem, 'ferramenta_freemium' se há interface de ferramenta com recursos pagos, 'vsl' se há vídeo de vendas dominante, 'landing_page' nos demais casos>",
  "design_context": {
    "style": "<estilo visual>",
    "primary_color": "<cor principal hex ou 'não detectado'>",
    "accent_color": "<cor de acento hex ou 'não detectado'>",
    "vibe": "<sensação geral em 4-6 palavras>"
  },
  "weak_points": ["<fraqueza específica e acionável 1>", "<fraqueza 2>", "<fraqueza 3>", "<fraqueza 4>", "<fraqueza 5>"],
  "strong_points": ["<força real que está funcionando 1>", "<força 2>", "<força 3>"],
  "ctv_recommendations": [
    {
      "hook": "<primeira frase — curta, impactante, específica>",
      "angle": "<nome do ângulo em 2-3 palavras>",
      "script": "<roteiro em 4-5 linhas — inclui hook, problema, solução, CTA com preço>"
    },
    {
      "hook": "<hook diferente — ângulo emocional ou resultado específico>",
      "angle": "<nome>",
      "script": "<roteiro>"
    },
    {
      "hook": "<hook de prova social ou comparação>",
      "angle": "<nome>",
      "script": "<roteiro>"
    }
  ]
}`, 'claude-haiku-4-5-20251001')
    let analysis
    try {
      const cleaned = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analysis = JSON.parse(cleaned)
    } catch {
      console.error('[Claude] Falha ao parsear análise:', analysisText.slice(0, 200))
      return NextResponse.json({ error: 'Erro ao processar análise. Tenta novamente.' }, { status: 500 })
    }

    // 5. Mídia do concorrente — classificada por papel
    const rawImages = (landingPage?.images ?? []) as ImageMeta[]
    const rawVideos = landingPage?.videos ?? []
    const adVideos = extractAdVideos(ads)

    const classified = classifyMedia(rawImages, [...rawVideos, ...adVideos])
    const { hero, product, persons, others, videos } = classified

    // imageUrls como strings para o embedding base64 no pós-processamento
    const imageUrls = rawImages.map(i => i.src).filter(Boolean).slice(0, 8)

    const adCopies = adsForClaude.slice(0, 3).map(a => a.body).filter(Boolean).map(t => String(t).slice(0, 400)).join('\n\n')

    console.log('[Funil] Tipo detectado:', analysis.funnel_type || 'landing_page')
    const rawText = await callClaude(
      buildHtmlPrompt(analysis, landingPage, hero, product, persons, others, videos, adCopies),
      `Você é o melhor copywriter e desenvolvedor front-end do Brasil. Especialista em páginas de vendas low ticket que já geraram mais de R$5 milhões em vendas diretas no Meta Ads. RETORNE APENAS HTML puro, sem markdown, sem explicação.`,
      'claude-sonnet-4-6'
    )
    // Remove markdown wrapper se houver, extrai só o HTML
    let generatedHtml = rawText.replace(/^```html\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
    // Garante que começa com <!DOCTYPE
    if (!generatedHtml.startsWith('<!')) {
      const idx = generatedHtml.indexOf('<!DOCTYPE')
      if (idx > 0) generatedHtml = generatedHtml.slice(idx)
    }

    // 7. Pós-processamento: substitui URLs de imagens por base64 no HTML gerado
    console.log(`[Media] Embedando ${imageUrls.length} imagens como base64...`)
    for (const url of imageUrls) {
      if (!url || !generatedHtml.includes(url)) continue
      const b64 = await downloadAsBase64(url, 600)
      if (b64) {
        generatedHtml = generatedHtml.split(url).join(b64)
        console.log(`[Media] Embedada: ${url.slice(0, 60)}`)
      }
    }

    // Fallback: força visibilidade de qualquer elemento que ainda tenha opacity:0
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

    return NextResponse.json({
      analysis,
      generatedHtml,
      meta: { totalAds: ads.length, landingUrl, hasLandingData: !!landingPage },
    })
  } catch (err) {
    console.error('[Route] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
