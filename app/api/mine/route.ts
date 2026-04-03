import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById } from '@/lib/db'

const APIFY_TOKEN = process.env.APIFY_TOKEN!

// POST — Start mining with a single keyword
export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const user = await dbGetUserById(userId)
  if (!user?.ativo) return NextResponse.json({ error: 'Conta inativa' }, { status: 403 })
  if (!APIFY_TOKEN) return NextResponse.json({ error: 'APIFY_TOKEN não configurado' }, { status: 500 })

  const { keyword, minAnuncios = 20, minDias = 15 } = await req.json()
  if (!keyword?.trim()) return NextResponse.json({ error: 'Digite uma palavra-chave' }, { status: 400 })

  const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(keyword.trim())}&search_type=keyword_unordered`

  console.log(`[Mine] Starting Apify for keyword: "${keyword.trim()}"`)

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_TOKEN}&timeout=120&maxItems=150`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [{ url: searchUrl }],
          count: 150,           // limita total de resultados do actor
          maxConcurrency: 1,
        }),
        signal: AbortSignal.timeout(15000),
      }
    )
    const runData = await runRes.json() as Record<string, unknown>
    if (!runRes.ok) {
      const errMsg = (runData?.error as Record<string, string>)?.message || `Apify HTTP ${runRes.status}`
      console.error('[Mine] Apify error:', errMsg)
      return NextResponse.json({ error: errMsg }, { status: 500 })
    }
    const runId = ((runData?.data as Record<string, unknown>)?.id as string)
    if (!runId) return NextResponse.json({ error: 'Apify não retornou runId' }, { status: 500 })

    console.log('[Mine] Apify run started:', runId)
    return NextResponse.json({ runId, keyword: keyword.trim(), minAnuncios, minDias })
  } catch (e) {
    return NextResponse.json({ error: `Erro ao iniciar Apify: ${(e as Error).message}` }, { status: 500 })
  }
}

// GET — Poll for results
export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const runId = req.nextUrl.searchParams.get('runId')
  const minAnuncios = Number(req.nextUrl.searchParams.get('minAnuncios')) || 20
  const minDias = Number(req.nextUrl.searchParams.get('minDias')) || 15
  const nicho = req.nextUrl.searchParams.get('nicho') || ''

  if (!runId) return NextResponse.json({ error: 'runId obrigatório' }, { status: 400 })

  try {
    // Check run status
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`, { signal: AbortSignal.timeout(10000) })
    const statusData = await statusRes.json() as Record<string, unknown>
    const status = ((statusData?.data as Record<string, unknown>)?.status as string) ?? 'UNKNOWN'

    if (status === 'RUNNING' || status === 'READY') {
      return NextResponse.json({ status: 'running' })
    }

    if (status !== 'SUCCEEDED') {
      return NextResponse.json({ status: 'failed', error: `Apify status: ${status}` })
    }

    // Get results
    const itemsRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=500`, { signal: AbortSignal.timeout(30000) })
    const items = await itemsRes.json() as Record<string, unknown>[]
    if (!Array.isArray(items)) return NextResponse.json({ status: 'failed', error: 'Dados inválidos do Apify' })

    console.log(`[Mine] Got ${items.length} ads, grouping by page...`)

    // Group by page
    const pageMap: Record<string, { nome: string; pageId: string; count: number; datas: number[]; landingUrl: string | null }> = {}
    for (const ad of items) {
      const pageId = (ad.page_id as string) || (ad.pageId as string) || (ad.pageName as string) || ''
      const pageName = (ad.page_name as string) || (ad.pageName as string) || 'Desconhecido'
      if (!pageId) continue
      if (!pageMap[pageId]) pageMap[pageId] = { nome: pageName, pageId, count: 0, datas: [], landingUrl: null }
      pageMap[pageId].count++

      const ts = ad.start_date as number | undefined
      const formatted = (ad.start_date_formatted as string) || (ad.startDate as string) || (ad.startedRunningAt as string) || ''
      if (typeof ts === 'number' && ts > 1000000000) pageMap[pageId].datas.push(ts * 1000)
      else if (formatted) { const d = new Date(formatted).getTime(); if (!isNaN(d) && d > 0) pageMap[pageId].datas.push(d) }

      if (!pageMap[pageId].landingUrl) {
        const snap = ad.snapshot as Record<string, unknown> | undefined
        pageMap[pageId].landingUrl = (snap?.link_url as string) || (ad.linkUrl as string) || (ad.link_url as string) || null
      }
    }

    console.log(`[Mine] Found ${Object.keys(pageMap).length} unique pages`)

    // Scale minAnuncios filter proportionally to sample size
    // With 150 ads sampled, a page with 3+ hits is already significant
    // Map user selection: 10+ → 2, 20+ → 3, 50+ → 5, 100+ → 8
    const totalAds = items.length
    const scaledMinAds = totalAds < 200
      ? (minAnuncios >= 100 ? 8 : minAnuncios >= 50 ? 5 : minAnuncios >= 20 ? 3 : 2)
      : minAnuncios // se por algum motivo vier muitos ads, usa o valor real

    console.log(`[Mine] Filter: ${minAnuncios}+ ads scaled to ${scaledMinAds}+ (sample: ${totalAds})`)

    // Build results
    const ofertas = Object.values(pageMap)
      .map(p => {
        const maisAntiga = p.datas.length > 0 ? Math.min(...p.datas) : null
        const diasRodando = maisAntiga ? Math.floor((Date.now() - maisAntiga) / 86400000) : null

        const volPts = p.count >= 50 ? 4 : p.count >= 20 ? 3 : p.count >= 10 ? 2 : p.count >= 5 ? 1 : 0
        const tempoPts = diasRodando === null ? 0 : diasRodando >= 41 ? 3 : diasRodando >= 21 ? 2 : diasRodando >= 10 ? 1 : 0
        const maxPts = diasRodando === null ? 7 : 10
        const score = Math.round(((volPts + tempoPts + 2) / maxPts) * 10)

        return {
          pagina_nome: p.nome,
          ad_library_url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${p.pageId}`,
          landing_url: p.landingUrl,
          total_anuncios: p.count,
          dias_rodando: diasRodando,
          score_escalabilidade: Math.min(10, score),
          nicho,
          resumo_angulo: '',
        }
      })
      .filter(p => p.total_anuncios >= scaledMinAds && (p.dias_rodando === null || p.dias_rodando >= minDias))
      .sort((a, b) => b.score_escalabilidade - a.score_escalabilidade)
      .slice(0, 30)

    console.log(`[Mine] Returning ${ofertas.length} offers (filtered ${minAnuncios}+ ads, ${minDias}+ days)`)
    return NextResponse.json({ status: 'done', ofertas })
  } catch (e) {
    return NextResponse.json({ status: 'failed', error: (e as Error).message })
  }
}
