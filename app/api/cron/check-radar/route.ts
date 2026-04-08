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

    // maxAds: 100 — economia Apify, suficiente pra detectar variação
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_TOKEN}`,
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

async function getAdsCount(pageName: string, pageId: string | null, adLibraryUrl: string): Promise<{ count: number; resolvedPageId?: string }> {
  // Prefer saved page_id, fallback to extracting from URL
  let resolvedPageId = pageId || undefined
  if (!resolvedPageId) {
    const m = adLibraryUrl.match(/view_all_page_id=(\d+)/)
    if (m) resolvedPageId = m[1]
  }

  // Try local scraper first
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
        return { count: data.count, resolvedPageId: data.pageId || resolvedPageId }
      }
    } catch { /* fall through to Apify */ }
  }

  // Fallback to Apify
  const count = await countAdsFromApify(adLibraryUrl)
  return { count, resolvedPageId }
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
async function processOfferGroup(oferta: Offer, allOffers: Offer[]): Promise<{
  status: 'verified' | 'skipped' | 'error'
  alertas: number
  error?: string
  dedup?: number
}> {
  // Skip se foi verificada nas últimas 18h
  if (oferta.verificado_em) {
    const hoursSince = (Date.now() - new Date(oferta.verificado_em).getTime()) / 3600000
    if (hoursSince < 18) return { status: 'skipped', alertas: 0 }
  }

  // Encontra todas as irmãs (mesma chave de scrape)
  const myKey = scrapeKey(oferta)
  const siblings = allOffers.filter(o => scrapeKey(o) === myKey)

  try {
    // 1 único scrape para todo o grupo
    const { count: adsCount, resolvedPageId } = await getAdsCount(oferta.pagina_nome, oferta.page_id, oferta.ad_library_url)

    let totalAlertas = 0
    for (const sib of siblings) {
      // Landing hash é por oferta (URLs de destino podem diferir mesmo com mesma page)
      const landingHash = sib.landing_url ? await getPageHash(sib.landing_url) : null
      totalAlertas += await applyScrapeToOffer(sib, adsCount, landingHash, resolvedPageId)
    }

    return { status: 'verified', alertas: totalAlertas, dedup: siblings.length }
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
    const result = await processOfferGroup(offer, ofertas)
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
    const result = await processOfferGroup(oferta, ofertas)
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
