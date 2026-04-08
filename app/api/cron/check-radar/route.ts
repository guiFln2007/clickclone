import { NextRequest, NextResponse } from 'next/server'
import { dbGetActiveTrackedOffers, dbUpdateTrackedOffer, dbCreateOfferAlert } from '@/lib/db'
import db from '@/lib/db'
import crypto from 'crypto'

export const maxDuration = 300

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''
const APIFY_TOKEN = process.env.APIFY_TOKEN || ''

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function countAdsFromApify(adLibraryUrl: string): Promise<number> {
  if (!APIFY_TOKEN) return -1
  try {
    const cleanUrl = (() => {
      try {
        const u = new URL(adLibraryUrl)
        const clean = new URL('https://www.facebook.com/ads/library/')
        for (const k of ['active_status', 'ad_type', 'country', 'search_type', 'view_all_page_id', 'media_type']) {
          const v = u.searchParams.get(k)
          if (v) clean.searchParams.set(k, v)
        }
        return clean.toString()
      } catch { return adLibraryUrl }
    })()

    // SAFEGUARDS: timeout=120s + memory=1024MB + maxAds=100 (kill switch contra runaway)
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_TOKEN}&timeout=120&memory=1024`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: [{ url: cleanUrl }], maxAds: 100 }) }
    )
    const runData = await runRes.json() as Record<string, unknown>
    const runId = (runData?.data as Record<string, unknown>)?.id as string
    if (!runId) return -1

    let status = 'RUNNING'
    let attempts = 0
    while (['RUNNING', 'READY'].includes(status) && attempts < 30) {
      await sleep(2000)
      const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
      const sd = await s.json() as Record<string, unknown>
      status = ((sd?.data as Record<string, unknown>)?.status as string) ?? 'FAILED'
      attempts++
    }

    const itemsRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=999`)
    const items = await itemsRes.json() as unknown[]
    return Array.isArray(items) ? items.length : -1
  } catch {
    return -1
  }
}

// GRATUITO: faz fetch direto da pagina do Ad Library e extrai a contagem do HTML.
// Meta embute dados no HTML inicial em varios formatos — tentamos multiplos padroes.
// Retorna -1 se nao conseguir (caller faz fallback).
async function countAdsDirect(pageId: string, adLibraryUrl: string): Promise<number> {
  try {
    // Monta uma URL limpa do Ad Library pra page especifica
    const url = new URL('https://www.facebook.com/ads/library/')
    url.searchParams.set('active_status', 'active')
    url.searchParams.set('ad_type', 'all')
    url.searchParams.set('country', 'BR')
    url.searchParams.set('view_all_page_id', pageId)
    url.searchParams.set('search_type', 'page')
    url.searchParams.set('media_type', 'all')

    // Preserva pais da URL original se existir
    try {
      const orig = new URL(adLibraryUrl)
      const country = orig.searchParams.get('country')
      if (country) url.searchParams.set('country', country)
    } catch { /* usa BR */ }

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(20000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
    })
    if (!res.ok) return -1
    const html = await res.text()

    // Tenta varios padroes conhecidos (Meta muda isso de tempos em tempos)
    // Ordem: mais especifico -> mais generico
    const patterns: RegExp[] = [
      /"total_count"\s*:\s*(\d+)/,
      /"totalCount"\s*:\s*(\d+)/,
      /"results"\s*:\s*\{\s*"count"\s*:\s*(\d+)/,
      /"collation_count"\s*:\s*(\d+)/,
      /"page_total_count"\s*:\s*(\d+)/,
      // Texto visivel: "~120 resultados" / "About 120 results" / "Cerca de 120 resultados"
      /~\s*(\d+)\s+resultad/i,
      /Cerca de\s+(\d+)\s+resultad/i,
      /About\s+(\d+)\s+result/i,
      /(\d+)\s+resultad[ao]s?\s+encontrad/i,
    ]

    for (const re of patterns) {
      const m = html.match(re)
      if (m && m[1]) {
        const n = parseInt(m[1], 10)
        if (!isNaN(n) && n >= 0 && n < 100000) return n
      }
    }

    // Ultimo recurso: contar ocorrencias de "Biblioteca ID" / "Library ID" no HTML
    // (cada ad tem um ID visivel). Pode subestimar se houver lazy load, mas e um piso.
    const idMatches = html.match(/"ad_archive_id"\s*:\s*"?\d+/g)
    if (idMatches && idMatches.length > 0) {
      // Dedup por ID
      const unique = new Set(idMatches)
      return unique.size
    }

    return -1
  } catch {
    return -1
  }
}

async function getAdsCount(pageName: string, pageId: string | null, adLibraryUrl: string): Promise<{ count: number; resolvedPageId?: string; source: 'direct' | 'scraper' | 'apify' | 'none' }> {
  // Prefer saved page_id, fallback to extracting from URL
  let resolvedPageId = pageId || undefined
  if (!resolvedPageId) {
    const m = adLibraryUrl.match(/view_all_page_id=(\d+)/)
    if (m) resolvedPageId = m[1]
  }

  // ✅ 1ª TENTATIVA: scrape direto do HTML do Facebook (GRATUITO)
  if (resolvedPageId) {
    const directCount = await countAdsDirect(resolvedPageId, adLibraryUrl)
    if (directCount >= 0) {
      return { count: directCount, resolvedPageId, source: 'direct' }
    }
    console.warn(`[Radar] Scrape direto falhou pra page ${resolvedPageId}, tentando fallbacks`)
  }

  // 2ª: scraper local (se configurado)
  if (SCRAPER_URL) {
    try {
      const res = await fetch(`${SCRAPER_URL}/count-ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
        body: JSON.stringify({ pageName, pageId: resolvedPageId }),
        signal: AbortSignal.timeout(60000),
      })
      if (res.ok) {
        const data = await res.json() as { count: number; pageId?: string }
        return { count: data.count, resolvedPageId: data.pageId || resolvedPageId, source: 'scraper' }
      }
    } catch { /* fall through to Apify */ }
  }

  // 3ª: Apify (pago, ultimo recurso)
  const count = await countAdsFromApify(adLibraryUrl)
  return { count, resolvedPageId, source: count >= 0 ? 'apify' : 'none' }
}

async function getPageHash(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!res.ok) return null
    let html = await res.text()
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    html = html.replace(/\d{10,13}/g, '')
    return crypto.createHash('sha256').update(html).digest('hex')
  } catch {
    return null
  }
}

type Offer = Awaited<ReturnType<typeof dbGetActiveTrackedOffers>>[0]

// Gera uma chave única de scrape: se tem page_id, usa page_id. Senão, normaliza URL.
// Duas ofertas com a mesma chave compartilham 1 scrape (dedup).
function scrapeKey(o: Offer): string {
  if (o.page_id) return `pid:${o.page_id}`
  try {
    const u = new URL(o.ad_library_url)
    const pid = u.searchParams.get('view_all_page_id')
    if (pid) return `pid:${pid}`
    const name = u.searchParams.get('q') || o.pagina_nome
    return `url:${name.toLowerCase().trim()}`
  } catch {
    return `url:${o.pagina_nome.toLowerCase().trim()}`
  }
}

// Aplica o resultado de 1 scrape a 1 oferta (gera alertas + update)
async function applyScrapeToOffer(
  oferta: Offer,
  adsCount: number,
  landingHash: string | null,
  resolvedPageId: string | undefined,
): Promise<number> {
  const anterior = oferta.ultimo_snapshot_ads ?? oferta.primeiro_snapshot_ads ?? 0
  const alertas: { tipo: string; mensagem: string }[] = []

  if (adsCount >= 0) {
    const diff = adsCount - anterior
    if (adsCount === 0 && anterior > 0) {
      alertas.push({ tipo: 'morreu', mensagem: `${oferta.pagina_nome} parou de rodar - 0 anuncios ativos` })
    } else if (diff >= 10) {
      alertas.push({ tipo: 'escalou', mensagem: `${oferta.pagina_nome} adicionou ${diff} novos anuncios` })
    } else if (diff <= -10) {
      alertas.push({ tipo: 'queda', mensagem: `${oferta.pagina_nome} removeu ${Math.abs(diff)} anuncios` })
    }
  }

  if (landingHash && oferta.landing_hash && landingHash !== oferta.landing_hash) {
    alertas.push({ tipo: 'pagina_mudou', mensagem: `${oferta.pagina_nome} alterou a pagina de destino` })
  }

  for (const alerta of alertas) {
    await dbCreateOfferAlert({
      id: crypto.randomUUID(),
      tracked_offer_id: oferta.id,
      tipo: alerta.tipo,
      mensagem: alerta.mensagem,
      dados_anteriores: JSON.stringify({ ads: anterior, hash: oferta.landing_hash }),
      dados_novos: JSON.stringify({ ads: adsCount, hash: landingHash }),
    })
  }

  const newStatus = adsCount === 0 && anterior > 0 ? 'morta'
    : adsCount >= 0 && adsCount - anterior >= 10 ? 'escalando'
    : adsCount >= 0 && anterior - adsCount >= 10 ? 'caindo'
    : oferta.status

  const updates: Parameters<typeof dbUpdateTrackedOffer>[1] = {
    ultimo_snapshot_ads: adsCount >= 0 ? adsCount : undefined,
    landing_hash: landingHash ?? undefined,
    status: newStatus,
    alertas_nao_lidos: oferta.alertas_nao_lidos + alertas.length,
  }
  if (resolvedPageId && resolvedPageId !== oferta.page_id) {
    updates.page_id = resolvedPageId
  }
  await dbUpdateTrackedOffer(oferta.id, updates)

  return alertas.length
}

// Processa uma oferta E todas as suas "irmãs" (mesma chave de scrape) com 1 único scrape
async function processOfferGroup(oferta: Offer, allOffers: Offer[], force = false): Promise<{
  status: 'verified' | 'skipped' | 'error'
  alertas: number
  error?: string
  dedup?: number
  source?: 'direct' | 'scraper' | 'apify' | 'none'
  adsCount?: number
}> {
  // Skip se foi verificada nas últimas 18h (a menos que force=true)
  if (!force && oferta.verificado_em) {
    const hoursSince = (Date.now() - new Date(oferta.verificado_em).getTime()) / 3600000
    if (hoursSince < 18) return { status: 'skipped', alertas: 0 }
  }

  // Encontra todas as irmãs (mesma chave de scrape)
  const myKey = scrapeKey(oferta)
  const siblings = allOffers.filter(o => scrapeKey(o) === myKey)

  try {
    // 1 único scrape para todo o grupo
    const { count: adsCount, resolvedPageId, source } = await getAdsCount(oferta.pagina_nome, oferta.page_id, oferta.ad_library_url)
    console.log(`[Radar] ${oferta.pagina_nome}: ${adsCount} ads via ${source}`)

    let totalAlertas = 0
    for (const sib of siblings) {
      // Landing hash é por oferta (URLs de destino podem diferir mesmo com mesma page)
      const landingHash = sib.landing_url ? await getPageHash(sib.landing_url) : null
      totalAlertas += await applyScrapeToOffer(sib, adsCount, landingHash, resolvedPageId)
    }

    return { status: 'verified', alertas: totalAlertas, dedup: siblings.length, source, adsCount }
  } catch (err) {
    return { status: 'error', alertas: 0, error: (err as Error).message }
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado no servidor' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ofertas = await dbGetActiveTrackedOffers()
  const targetId = req.nextUrl.searchParams.get('id')
  const force = req.nextUrl.searchParams.get('force') === '1'

  // MODE 1: List mode — agrupa por scrapeKey e retorna 1 representante por grupo
  // (GitHub Actions itera sobre grupos, cada grupo = 1 scrape compartilhado)
  if (req.nextUrl.searchParams.get('mode') === 'list') {
    const seen = new Set<string>()
    const groups: { id: string; nome: string; ultimaVerificacao: string | null; compartilha: number }[] = []
    for (const o of ofertas) {
      const key = scrapeKey(o)
      if (seen.has(key)) continue
      seen.add(key)
      const dedupCount = ofertas.filter(x => scrapeKey(x) === key).length
      groups.push({
        id: o.id,
        nome: o.pagina_nome,
        ultimaVerificacao: o.verificado_em,
        compartilha: dedupCount,
      })
    }
    return NextResponse.json({
      ids: groups,
      total: ofertas.length,
      grupos: groups.length,
      economia: `${ofertas.length - groups.length} scrapes evitados via dedup`,
    })
  }

  // MODE 2: Single group — processa 1 representante + todas as irmãs com 1 scrape
  if (targetId) {
    const offer = ofertas.find(o => o.id === targetId)
    if (!offer) return NextResponse.json({ error: 'Oferta não encontrada' }, { status: 404 })
    const result = await processOfferGroup(offer, ofertas, force)
    return NextResponse.json({ id: targetId, nome: offer.pagina_nome, ...result })
  }

  // MODE 3: Processa tudo com dedup (legacy — risco de timeout, mantido pra compat)
  let verificadas = 0
  let alertasCriados = 0
  let puladas = 0
  const processedKeys = new Set<string>()
  for (const oferta of ofertas) {
    const key = scrapeKey(oferta)
    if (processedKeys.has(key)) continue
    processedKeys.add(key)
    const result = await processOfferGroup(oferta, ofertas, force)
    if (result.status === 'verified') verificadas++
    else if (result.status === 'skipped') puladas++
    alertasCriados += result.alertas
  }

  // Cleanup old cache (housekeeping)
  let cacheCleared = 0
  try {
    const r = await db.execute("DELETE FROM analysis_cache WHERE created_at < datetime('now', '-7 days')")
    cacheCleared = r.rowsAffected ?? 0
  } catch { /* ok */ }

  return NextResponse.json({ verificadas, alertasCriados, puladas, total: ofertas.length, cacheCleared })
}
