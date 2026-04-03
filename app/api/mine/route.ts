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
      body: JSON.stringify({ keyword: keyword.trim(), count: 100 }),
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

    // Results come pre-processed with real ad counts from scraper
    const results = (data.results || []) as Array<{ pagina_nome: string; page_id: string; total_anuncios: number; dias_rodando: number | null; landing_url: string | null }>
    console.log(`[Mine] Got ${results.length} pages with real counts`)

    const ofertas = results
      .map(p => {
        const volPts = p.total_anuncios >= 50 ? 4 : p.total_anuncios >= 20 ? 3 : p.total_anuncios >= 10 ? 2 : 0
        const tempoPts = p.dias_rodando === null ? 0 : p.dias_rodando >= 41 ? 3 : p.dias_rodando >= 21 ? 2 : p.dias_rodando >= 10 ? 1 : 0
        const maxPts = p.dias_rodando === null ? 7 : 10
        const score = Math.round(((volPts + tempoPts + 2) / maxPts) * 10)

        return {
          pagina_nome: p.pagina_nome,
          ad_library_url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(p.pagina_nome)}&search_type=keyword_unordered`,
          landing_url: p.landing_url,
          total_anuncios: p.total_anuncios,
          dias_rodando: p.dias_rodando,
          score_escalabilidade: Math.min(10, score),
          nicho,
          resumo_angulo: '',
        }
      })
      .filter(p => {
        // Real ad count from scraper — filter directly
        if (p.total_anuncios < minAnuncios) return false
        if (p.dias_rodando !== null && p.dias_rodando < minDias) return false
        // Social media already filtered by scraper, but double check
        const url = (p.landing_url || '').toLowerCase()
        if (!url) return false
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
