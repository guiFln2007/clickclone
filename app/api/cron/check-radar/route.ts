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

// Process a single offer — extracted so it can be called from both modes
async function processOffer(oferta: Awaited<ReturnType<typeof dbGetActiveTrackedOffers>>[0]): Promise<{
  status: 'verified' | 'skipped' | 'error'
  alertas: number
  error?: string
}> {
  // Skip se foi verificada nas últimas 18h (economia massiva de Apify)
  if (oferta.verificado_em) {
    const hoursSince = (Date.now() - new Date(oferta.verificado_em).getTime()) / 3600000
    if (hoursSince < 18) return { status: 'skipped', alertas: 0 }
  }

  try {
    const { count: adsCount, resolvedPageId } = await getAdsCount(oferta.pagina_nome, oferta.page_id, oferta.ad_library_url)
    const landingHash = oferta.landing_url ? await getPageHash(oferta.landing_url) : null

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

    return { status: 'verified', alertas: alertas.length }
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

  // MODE 1: List mode — returns IDs (used by GitHub Actions to iterate)
  if (req.nextUrl.searchParams.get('mode') === 'list') {
    return NextResponse.json({
      ids: ofertas.map(o => ({
        id: o.id,
        nome: o.pagina_nome,
        ultimaVerificacao: o.verificado_em,
      })),
      total: ofertas.length,
    })
  }

  // MODE 2: Single offer — process only one (used by GitHub Actions per offer)
  if (targetId) {
    const offer = ofertas.find(o => o.id === targetId)
    if (!offer) return NextResponse.json({ error: 'Oferta não encontrada' }, { status: 404 })
    const result = await processOffer(offer)
    return NextResponse.json({ id: targetId, nome: offer.pagina_nome, ...result })
  }

  // MODE 3: Process all (legacy — risk of timeout, kept for compat)
  let verificadas = 0
  let alertasCriados = 0
  let puladas = 0
  for (const oferta of ofertas) {
    const result = await processOffer(oferta)
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
