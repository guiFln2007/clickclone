import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById } from '@/lib/db'

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''
const APIFY_TOKEN = process.env.APIFY_TOKEN || ''

type MineResult = {
  pagina_nome: string
  page_id: string
  total_anuncios: number
  dias_rodando: number | null
  landing_url: string | null
}

// ── APIFY FALLBACK ──
// Quando o scraper local (Mac) tá offline, usa o curious_coder via search URL
// Cost: ~$0.05-0.10 per mining call

async function startApifyMine(keyword: string): Promise<string | null> {
  if (!APIFY_TOKEN) return null
  const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(keyword)}&search_type=keyword_unordered`
  try {
    // SAFEGUARDS no nivel da Apify (independente do codigo do cliente):
    // - timeout=180s: mata o run automaticamente se passar de 3 min
    // - memory=1024MB: limita RAM do container (menos compute = menos custo)
    // - maxAds=150 no body: limita quantos ads o actor extrai (pra ter 10+ paginas apos filtros)
    const res = await fetch(
      `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_TOKEN}&timeout=180&memory=1024`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [{ url: searchUrl }], maxAds: 150 }),
      }
    )
    const data = await res.json() as Record<string, unknown>
    const runId = (data?.data as Record<string, unknown>)?.id as string
    return runId || null
  } catch {
    return null
  }
}

// SAFEGUARD 2: Cache em memoria — mesma keyword nas ultimas 6h reusa o mesmo run
// Evita lead minerar a mesma keyword 10x e queimar credito
const mineCache = new Map<string, { runId: string; createdAt: number }>()
const MINE_CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 horas

function getCachedRun(keyword: string): string | null {
  const key = keyword.toLowerCase().trim()
  const cached = mineCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.createdAt > MINE_CACHE_TTL_MS) {
    mineCache.delete(key)
    return null
  }
  return cached.runId
}

function setCachedRun(keyword: string, runId: string) {
  const key = keyword.toLowerCase().trim()
  mineCache.set(key, { runId, createdAt: Date.now() })
}

// SAFEGUARD 3: Throttle por usuario — max 5 mineracoes a cada 1h
const userMineHistory = new Map<number, number[]>() // userId -> timestamps
const USER_MINE_LIMIT = 5
const USER_MINE_WINDOW_MS = 60 * 60 * 1000 // 1 hora

function checkUserMineLimit(userId: number): { allowed: boolean; remaining: number; resetInMin: number } {
  const now = Date.now()
  const history = (userMineHistory.get(userId) || []).filter(t => now - t < USER_MINE_WINDOW_MS)
  if (history.length >= USER_MINE_LIMIT) {
    const oldest = Math.min(...history)
    const resetInMin = Math.ceil((USER_MINE_WINDOW_MS - (now - oldest)) / 60000)
    return { allowed: false, remaining: 0, resetInMin }
  }
  history.push(now)
  userMineHistory.set(userId, history)
  return { allowed: true, remaining: USER_MINE_LIMIT - history.length, resetInMin: 0 }
}

type ApifyAd = {
  snapshot?: {
    page_id?: string | number
    page_name?: string
    link_url?: string
    cta_link?: string
  }
  start_date?: number
  start_date_string?: string
}

async function getApifyMineStatus(runId: string): Promise<{ status: 'running' | 'done' | 'failed', items?: ApifyAd[], error?: string }> {
  try {
    const r = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    const d = await r.json() as Record<string, unknown>
    const status = ((d?.data as Record<string, unknown>)?.status as string) ?? 'FAILED'

    if (status === 'RUNNING' || status === 'READY') return { status: 'running' }
    if (status === 'SUCCEEDED') {
      const itemsRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=999`)
      const items = await itemsRes.json() as ApifyAd[]
      return { status: 'done', items: Array.isArray(items) ? items : [] }
    }
    return { status: 'failed', error: `Apify status: ${status}` }
  } catch (e) {
    return { status: 'failed', error: (e as Error).message }
  }
}

function processApifyAds(items: ApifyAd[]): MineResult[] {
  const grouped = new Map<string, { name: string; count: number; earliestDate: number | null; landing: string | null }>()

  for (const ad of items) {
    const snap = ad.snapshot || {}
    const pageId = String(snap.page_id || '').trim()
    if (!pageId) continue

    const existing = grouped.get(pageId) || { name: snap.page_name || '?', count: 0, earliestDate: null, landing: null }
    existing.count++

    const startMs = ad.start_date ? ad.start_date * 1000 : (ad.start_date_string ? new Date(ad.start_date_string).getTime() : null)
    if (startMs && !isNaN(startMs) && (!existing.earliestDate || startMs < existing.earliestDate)) {
      existing.earliestDate = startMs
    }

    if (!existing.landing && (snap.link_url || snap.cta_link)) {
      existing.landing = snap.link_url || snap.cta_link || null
    }

    grouped.set(pageId, existing)
  }

  const now = Date.now()
  return Array.from(grouped.entries()).map(([pageId, info]) => ({
    pagina_nome: info.name,
    page_id: pageId,
    total_anuncios: info.count,
    dias_rodando: info.earliestDate ? Math.floor((now - info.earliestDate) / (1000 * 60 * 60 * 24)) : null,
    landing_url: info.landing,
  }))
}

// ── ROUTES ──

// POST — Start mining (tenta scraper local, fallback Apify)
export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const user = await dbGetUserById(userId)
  if (!user?.ativo) return NextResponse.json({ error: 'Conta inativa' }, { status: 403 })

  const { keyword } = await req.json()
  const minAnuncios = 10
  const minDias = 10
  if (!keyword?.trim()) return NextResponse.json({ error: 'Digite uma palavra-chave' }, { status: 400 })

  const kw = keyword.trim()

  // SAFEGUARD: throttle por usuario (5 mineracoes/hora)
  const limit = checkUserMineLimit(userId)
  if (!limit.allowed) {
    return NextResponse.json({
      error: `Limite de mineracoes atingido. Tente novamente em ${limit.resetInMin} min (max 5/hora)`
    }, { status: 429 })
  }

  // SAFEGUARD: cache de 6h por keyword
  const cachedRunId = getCachedRun(kw)
  if (cachedRunId) {
    console.log(`[Mine] Cache HIT pra "${kw}", reusando runId ${cachedRunId}`)
    return NextResponse.json({ runId: cachedRunId, keyword: kw, minAnuncios, minDias, cached: true })
  }

  console.log(`[Mine] Starting for keyword: "${kw}" (${limit.remaining} restantes na hora)`)

  // 1ª tentativa: scraper local (Mac via Cloudflare Tunnel)
  if (SCRAPER_URL) {
    try {
      const res = await fetch(`${SCRAPER_URL}/mine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
        body: JSON.stringify({ keyword: kw, count: 100 }),
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json() as Record<string, unknown>
        const jobId = data.jobId as string
        if (jobId) {
          console.log('[Mine] Local scraper job started:', jobId)
          const runId = `local:${jobId}`
          setCachedRun(kw, runId)
          return NextResponse.json({ runId, keyword: kw, minAnuncios, minDias })
        }
      }
    } catch {
      console.warn('[Mine] Local scraper falhou, caindo no Apify')
    }
  }

  // 2ª tentativa: Apify fallback
  const apifyRunId = await startApifyMine(kw)
  if (!apifyRunId) {
    return NextResponse.json({ error: 'Erro ao iniciar minerador (scraper local e Apify ambos falharam)' }, { status: 500 })
  }

  console.log('[Mine] Apify run started:', apifyRunId)
  const runId = `apify:${apifyRunId}`
  setCachedRun(kw, runId)
  return NextResponse.json({ runId, keyword: kw, minAnuncios, minDias })
}

// GET — Poll for results
export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const runId = req.nextUrl.searchParams.get('runId')
  const minAnuncios = 10
  const minDias = 10
  const nicho = req.nextUrl.searchParams.get('nicho') || ''

  if (!runId) return NextResponse.json({ error: 'runId obrigatório' }, { status: 400 })

  let results: MineResult[] = []

  try {
    if (runId.startsWith('apify:')) {
      // ── APIFY POLLING ──
      const apifyRunId = runId.slice(6)
      const r = await getApifyMineStatus(apifyRunId)
      if (r.status === 'running') return NextResponse.json({ status: 'running' })
      if (r.status === 'failed') return NextResponse.json({ status: 'failed', error: r.error || 'Apify falhou' })
      results = processApifyAds(r.items || [])
    } else {
      // ── LOCAL SCRAPER POLLING ──
      const localJobId = runId.startsWith('local:') ? runId.slice(6) : runId
      const res = await fetch(`${SCRAPER_URL}/mine?jobId=${localJobId}`, {
        headers: { 'Authorization': `Bearer ${SCRAPER_SECRET}` },
        signal: AbortSignal.timeout(10000),
      })
      const data = await res.json() as Record<string, unknown>
      const status = data.status as string

      if (status === 'running') return NextResponse.json({ status: 'running' })
      if (status === 'failed') return NextResponse.json({ status: 'failed', error: data.error || 'Scraper falhou' })
      if (status !== 'done') return NextResponse.json({ status: 'failed', error: `Scraper status: ${status}` })

      results = (data.results || []) as MineResult[]
    }

    console.log(`[Mine] Got ${results.length} pages`)

    const ofertas = results
      .map(p => {
        const volPts = p.total_anuncios >= 50 ? 4 : p.total_anuncios >= 20 ? 3 : p.total_anuncios >= 10 ? 2 : 0
        const tempoPts = p.dias_rodando === null ? 0 : p.dias_rodando >= 41 ? 3 : p.dias_rodando >= 21 ? 2 : p.dias_rodando >= 10 ? 1 : 0
        const maxPts = p.dias_rodando === null ? 7 : 10
        const score = Math.round(((volPts + tempoPts + 2) / maxPts) * 10)

        return {
          pagina_nome: p.pagina_nome,
          ad_library_url: /^\d+$/.test(p.page_id)
            ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${p.page_id}`
            : `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(p.pagina_nome)}&search_type=keyword_unordered`,
          landing_url: p.landing_url,
          total_anuncios: p.total_anuncios,
          dias_rodando: p.dias_rodando,
          score_escalabilidade: Math.min(10, score),
          nicho,
          resumo_angulo: '',
        }
      })
      .filter(p => {
        // Minimo: 10 anuncios ativos
        if (p.total_anuncios < minAnuncios) return false
        // Maximo: 80 anuncios (acima disso provavelmente e marca grande, nao infoproduto)
        if (p.total_anuncios > 80) return false
        // Minimo: 10 dias rodando (se conseguimos calcular)
        if (p.dias_rodando !== null && p.dias_rodando < minDias) return false
        // Tem que ter landing
        const url = (p.landing_url || '').toLowerCase()
        if (!url) return false
        // Sem redes sociais
        const blocked = ['instagram.com', 'whatsapp.com', 'wa.me', 'facebook.com', 'fb.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 't.me', 'telegram']
        if (blocked.some(domain => url.includes(domain))) return false
        return true
      })
      .sort((a, b) => b.score_escalabilidade - a.score_escalabilidade)
      .slice(0, 30)

    console.log(`[Mine] Returning ${ofertas.length} offers (filtered ${minAnuncios}+ ads, ${minDias}+ days)`)
    return NextResponse.json({ status: 'done', ofertas })
  } catch (e) {
    return NextResponse.json({ status: 'failed', error: (e as Error).message })
  }
}
