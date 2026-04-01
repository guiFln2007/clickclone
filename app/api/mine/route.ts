import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById } from '@/lib/db'

// Nicho -> keywords for Meta Ad Library search
const NICHO_KEYWORDS: Record<string, string[]> = {
  relacionamento: ['relacionamento', 'traicao', 'parceiro', 'amor', 'casamento', 'ex namorado'],
  financas: ['renda extra', 'investimento', 'dinheiro', 'trader', 'criptomoeda', 'riqueza'],
  emagrecimento: ['emagrecer', 'perder peso', 'dieta', 'barriga', 'emagrecimento', 'metabolismo'],
  espiritualidade: ['taro', 'mapa astral', 'cigana', 'orixas', 'simpatia', 'espiritualidade'],
  maternidade: ['maternidade', 'bebe', 'amamentacao', 'gravida', 'gestante', 'enxoval'],
  saude: ['saude', 'imunidade', 'diabetes', 'pressao', 'colesterol', 'dor nas costas'],
  beleza: ['skincare', 'cabelo', 'unha', 'maquiagem', 'rejuvenescimento', 'anti rugas'],
  pets: ['cachorro', 'gato', 'pet', 'racao', 'adestramento', 'veterinario'],
}

export interface OfertaMinerada {
  pagina_nome: string
  ad_library_url: string
  landing_url: string | null
  total_anuncios: number
  dias_rodando: number | null
  score_escalabilidade: number
  nicho: string
  tipo_funil_estimado: string
  resumo_angulo: string
}

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const user = await dbGetUserById(userId)
  if (!user || !user.ativo) return NextResponse.json({ error: 'Conta inativa' }, { status: 403 })

  const { nicho, min_ads = 20, min_days = 15 } = await req.json()
  if (!nicho) return NextResponse.json({ error: 'Nicho obrigatorio' }, { status: 400 })

  const keywords = NICHO_KEYWORDS[nicho.toLowerCase()] || [nicho]
  const token = process.env.APIFY_TOKEN
  if (!token) return NextResponse.json({ error: 'APIFY_TOKEN nao configurado' }, { status: 500 })

  try {
    // Search Meta Ad Library using Apify for each keyword (pick first 2 to save credits)
    const searchKeywords = keywords.slice(0, 2)
    const allResults: OfertaMinerada[] = []
    const seenPages = new Set<string>()

    for (const keyword of searchKeywords) {
      const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(keyword)}&search_type=keyword_unordered`

      const runRes = await fetch(`https://api.apify.com/v2/acts/apify~facebook-ads-scraper/runs?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: searchUrl }],
          maxItems: 50,
          activeStatus: 'active',
        }),
        signal: AbortSignal.timeout(90000),
      })
      if (!runRes.ok) continue
      const run = await runRes.json()
      const runId = run?.data?.id
      const datasetId = run?.data?.defaultDatasetId
      if (!runId || !datasetId) continue

      // Poll for completion
      let attempts = 0
      while (attempts < 45) {
        await new Promise(r => setTimeout(r, 2000))
        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
        const statusData = await statusRes.json()
        if (statusData?.data?.status === 'SUCCEEDED') break
        if (statusData?.data?.status === 'FAILED' || statusData?.data?.status === 'ABORTED') break
        attempts++
      }

      // Get results
      const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=50`)
      if (!itemsRes.ok) continue
      const items = await itemsRes.json()

      // Group by page
      const pageGroups: Record<string, { name: string; count: number; firstDate: string | null; landingUrl: string | null; pageId: string }> = {}
      for (const item of items) {
        const pageId = item.pageId || item.page_id || ''
        const pageName = item.pageName || item.page_name || 'Desconhecido'
        if (!pageId || seenPages.has(pageId)) continue

        if (!pageGroups[pageId]) {
          pageGroups[pageId] = { name: pageName, count: 0, firstDate: null, landingUrl: null, pageId }
        }
        pageGroups[pageId].count++
        if (item.startDate && (!pageGroups[pageId].firstDate || item.startDate < pageGroups[pageId].firstDate!)) {
          pageGroups[pageId].firstDate = item.startDate
        }
        if (item.linkUrl && !pageGroups[pageId].landingUrl) {
          pageGroups[pageId].landingUrl = item.linkUrl
        }
      }

      // Convert to OfertaMinerada
      for (const [pageId, group] of Object.entries(pageGroups)) {
        seenPages.add(pageId)
        const diasRodando = group.firstDate ? Math.floor((Date.now() - new Date(group.firstDate).getTime()) / 86400000) : null
        const scoreEsc = Math.min(10, (group.count / 10) + (diasRodando ? diasRodando / 30 : 0))

        if (group.count >= min_ads && (diasRodando === null || diasRodando >= min_days)) {
          allResults.push({
            pagina_nome: group.name,
            ad_library_url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${pageId}`,
            landing_url: group.landingUrl,
            total_anuncios: group.count,
            dias_rodando: diasRodando,
            score_escalabilidade: Math.round(scoreEsc * 10) / 10,
            nicho,
            tipo_funil_estimado: 'pagina de vendas',
            resumo_angulo: '',
          })
        }
      }
    }

    // Sort by score desc
    allResults.sort((a, b) => b.score_escalabilidade - a.score_escalabilidade)

    return NextResponse.json({ ofertas: allResults.slice(0, 20) })
  } catch (err) {
    console.error('[Mine] Error:', err)
    return NextResponse.json({ error: 'Erro ao minerar ofertas' }, { status: 500 })
  }
}
