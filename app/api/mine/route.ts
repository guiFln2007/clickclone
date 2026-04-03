import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById } from '@/lib/db'

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''

// POST — Start mining with local scraper
export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const user = await dbGetUserById(userId)
  if (!user?.ativo) return NextResponse.json({ error: 'Conta inativa' }, { status: 403 })
  if (!SCRAPER_URL) return NextResponse.json({ error: 'SCRAPER_URL não configurado' }, { status: 500 })

  const { keyword, minAnuncios = 20, minDias = 15 } = await req.json()
  if (!keyword?.trim()) return NextResponse.json({ error: 'Digite uma palavra-chave' }, { status: 400 })

  console.log(`[Mine] Starting scraper for keyword: "${keyword.trim()}"`)

  try {
    const res = await fetch(`${SCRAPER_URL}/mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
      body: JSON.stringify({ keyword: keyword.trim(), count: 500 }),
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) throw new Error((data.error as string) || `Scraper HTTP ${res.status}`)

    const jobId = data.jobId as string
    if (!jobId) return NextResponse.json({ error: 'Scraper não retornou jobId' }, { status: 500 })

    console.log('[Mine] Scraper job started:', jobId)
    return NextResponse.json({ runId: jobId, keyword: keyword.trim(), minAnuncios, minDias })
  } catch (e) {
    return NextResponse.json({ error: `Erro ao iniciar scraper: ${(e as Error).message}` }, { status: 500 })
  }
}

// GET — Poll for results from local scraper
export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const runId = req.nextUrl.searchParams.get('runId')
  const minAnuncios = Number(req.nextUrl.searchParams.get('minAnuncios')) || 20
  const minDias = Number(req.nextUrl.searchParams.get('minDias')) || 15
  const nicho = req.nextUrl.searchParams.get('nicho') || ''

  if (!runId) return NextResponse.json({ error: 'runId obrigatório' }, { status: 400 })

  try {
    const res = await fetch(`${SCRAPER_URL}/mine?jobId=${runId}`, {
      headers: { 'Authorization': `Bearer ${SCRAPER_SECRET}` },
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json() as Record<string, unknown>
    const status = data.status as string

    if (status === 'running') {
      return NextResponse.json({ status: 'running' })
    }

    if (status === 'failed') {
      return NextResponse.json({ status: 'failed', error: data.error || 'Scraper falhou' })
    }

    if (status !== 'done') {
      return NextResponse.json({ status: 'failed', error: `Scraper status: ${status}` })
    }

    // Process results — same grouping logic as before
    const items = (data.ads || []) as Array<Record<string, unknown>>
    console.log(`[Mine] Got ${items.length} ads, grouping by page...`)

    const pageMap: Record<string, { nome: string; pageId: string; count: number; datas: number[]; landingUrl: string | null }> = {}
    for (const ad of items) {
      const pageId = (ad.page_id as string) || ''
      const pageName = (ad.page_name as string) || 'Desconhecido'
      if (!pageId) continue
      if (!pageMap[pageId]) pageMap[pageId] = { nome: pageName, pageId, count: 0, datas: [], landingUrl: null }
      pageMap[pageId].count++

      const ts = ad.start_date as number | undefined
      const formatted = ad.start_date_formatted as string || ''
      if (typeof ts === 'number' && ts > 0) pageMap[pageId].datas.push(ts * 1000)
      else if (formatted) { const d = new Date(formatted).getTime(); if (!isNaN(d) && d > 0) pageMap[pageId].datas.push(d) }

      if (!pageMap[pageId].landingUrl) {
        const snap = ad.snapshot as Record<string, unknown> | undefined
        pageMap[pageId].landingUrl = (snap?.link_url as string) || null
      }
    }

    console.log(`[Mine] Found ${Object.keys(pageMap).length} unique pages`)

    const ofertas = Object.values(pageMap)
      .map(p => {
        const maisAntiga = p.datas.length > 0 ? Math.min(...p.datas) : null
        const diasRodando = maisAntiga ? Math.floor((Date.now() - maisAntiga) / 86400000) : null

        const volPts = p.count >= 50 ? 4 : p.count >= 20 ? 3 : p.count >= 10 ? 2 : 0
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
      .filter(p => p.total_anuncios >= minAnuncios && (p.dias_rodando === null || p.dias_rodando >= minDias))
      .sort((a, b) => b.score_escalabilidade - a.score_escalabilidade)
      .slice(0, 30)

    console.log(`[Mine] Returning ${ofertas.length} offers`)
    return NextResponse.json({ status: 'done', ofertas })
  } catch (e) {
    return NextResponse.json({ status: 'failed', error: (e as Error).message })
  }
}
