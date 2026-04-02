import { NextRequest } from 'next/server'
import { dbGetUserById } from '@/lib/db'

export const maxDuration = 300

const APIFY_TOKEN = process.env.APIFY_TOKEN!

const NICHO_KEYWORDS: Record<string, string[]> = {
  relacionamento: ['relacionamento amoroso', 'traição parceiro', 'ciúme', 'ex volta', 'amor verdadeiro'],
  financas: ['renda extra online', 'dinheiro rápido', 'liberdade financeira', 'investimento iniciante', 'ganhar dinheiro'],
  emagrecimento: ['emagrecer rápido', 'barriga chapada', 'dieta funciona', 'perder peso', 'truque emagrecimento'],
  espiritualidade: ['tarot amor', 'simpatia funciona', 'orixá proteção', 'energia positiva', 'cigana'],
  maternidade: ['bebê dormir', 'amamentação dicas', 'gestante alimentação', 'maternidade', 'parto'],
  carreira: ['concurso público', 'home office', 'promoção emprego', 'salário maior', 'trabalho remoto'],
  saude: ['pressão alta natural', 'diabetes controle', 'ansiedade natural', 'dor costas', 'imunidade'],
  beleza: ['pele perfeita', 'cabelo crescer', 'skincare natural', 'rejuvenescimento', 'anti rugas'],
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function safeJson(res: Response) {
  const text = await res.text()
  try { return JSON.parse(text) } catch { throw new Error(`Invalid JSON: ${text.slice(0, 200)}`) }
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        const userId = Number(req.headers.get('x-user-id'))
        if (!userId) { send({ type: 'error', message: 'Não autenticado' }); controller.close(); return }
        const user = await dbGetUserById(userId)
        if (!user?.ativo) { send({ type: 'error', message: 'Conta inativa' }); controller.close(); return }
        if (!APIFY_TOKEN) { send({ type: 'error', message: 'APIFY_TOKEN não configurado' }); controller.close(); return }

        const { nichos, minAnuncios = 20, minDias = 15 } = await req.json()
        if (!nichos?.length) { send({ type: 'error', message: 'Selecione pelo menos um nicho' }); controller.close(); return }

        console.log('[Mine] Starting:', { nichos, minAnuncios, minDias })

        // 1. Build keywords
        const keywords: string[] = []
        for (const n of nichos as string[]) {
          keywords.push(...(NICHO_KEYWORDS[n] || [n]))
        }

        send({ type: 'progress', text: `🔍 Conectando ao Meta Ad Library...` })

        // 2. Search using keywords (pick first 3 to save Apify credits)
        const searchKeywords = keywords.slice(0, 3)
        const allAds: Record<string, unknown>[] = []

        for (const kw of searchKeywords) {
          send({ type: 'progress', text: `⛏️ Buscando "${kw}"...` })

          const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(kw)}&search_type=keyword_unordered`

          try {
            const runRes = await fetch(
              `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_TOKEN}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: [{ url: searchUrl }], maxAds: 100 }),
              }
            )
            const runData = await safeJson(runRes) as Record<string, unknown>
            const runId = ((runData?.data as Record<string, unknown>)?.id as string)
            if (!runId) continue

            let status = 'RUNNING'
            let attempts = 0
            while (['RUNNING', 'READY'].includes(status) && attempts < 40) {
              await sleep(2000)
              const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
              const sd = await safeJson(s) as Record<string, unknown>
              status = ((sd?.data as Record<string, unknown>)?.status as string) ?? 'FAILED'
              attempts++
            }

            const itemsRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=100`)
            const items = await safeJson(itemsRes) as Record<string, unknown>[]
            if (Array.isArray(items)) allAds.push(...items)
          } catch (e) {
            console.error(`[Mine] Keyword "${kw}" failed:`, (e as Error).message)
            send({ type: 'progress', text: `⚠️ Busca "${kw}" falhou, tentando próxima...` })
          }
        }

        console.log(`[Mine] Total ads scraped: ${allAds.length}`)
        if (allAds.length === 0) {
          send({ type: 'done', ofertas: [], total: 0 })
          controller.close(); return
        }
        send({ type: 'progress', text: `📊 ${allAds.length} anúncios encontrados. Agrupando por página...` })

        // 3. Group by page
        const pageMap: Record<string, { nome: string; pageId: string; ads: Record<string, unknown>[] }> = {}
        for (const ad of allAds) {
          const pageId = (ad.page_id as string) || ''
          const pageName = (ad.page_name as string) || 'Desconhecido'
          if (!pageId) continue
          if (!pageMap[pageId]) pageMap[pageId] = { nome: pageName, pageId, ads: [] }
          pageMap[pageId].ads.push(ad)
        }

        // 4. Calculate metrics per page
        const paginas = Object.values(pageMap).map(p => {
          const datas: Date[] = []
          let landingUrl: string | null = null
          for (const ad of p.ads) {
            const ts = ad.start_date as number | undefined
            const formatted = ad.start_date_formatted as string | undefined
            if (typeof ts === 'number' && ts > 1000000000) datas.push(new Date(ts * 1000))
            else if (formatted) { const d = new Date(formatted); if (!isNaN(d.getTime())) datas.push(d) }
            if (!landingUrl) {
              const snap = ad.snapshot as Record<string, unknown> | undefined
              landingUrl = (snap?.link_url as string) || (ad.ad_creative_link_url as string) || null
            }
          }

          const maisAntiga = datas.length > 0 ? datas.reduce((o, d) => d < o ? d : o, datas[0]) : null
          const diasRodando = maisAntiga ? Math.floor((Date.now() - maisAntiga.getTime()) / 86400000) : null

          return {
            pagina_nome: p.nome,
            ad_library_url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${p.pageId}`,
            landing_url: landingUrl,
            total_anuncios: p.ads.length,
            dias_rodando: diasRodando,
            data_mais_antiga: maisAntiga?.toLocaleDateString('pt-BR') || null,
            nicho: (nichos as string[])[0],
          }
        })

        // 5. Filter
        send({ type: 'progress', text: `🔧 Aplicando filtros (mín. ${minAnuncios} anúncios, ${minDias}+ dias)...` })

        const filtradas = paginas.filter(p => {
          if (p.total_anuncios < minAnuncios) return false
          if (p.dias_rodando !== null && p.dias_rodando < minDias) return false
          return true
        })

        if (filtradas.length === 0) {
          send({ type: 'done', ofertas: [], total: 0 })
          controller.close(); return
        }

        // 6. Claude ranking
        send({ type: 'progress', text: `🤖 Ranqueando ${filtradas.length} ofertas com IA...` })

        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const resp = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `Você recebe uma lista de páginas anunciantes do Meta Ad Library brasileiras.

Para cada página, calcule um score de 0-10:
- Volume: 10-19 ads = 2pts | 20-49 ads = 3pts | 50+ ads = 4pts | máx 4
- Tempo: não disponível = desconsiderar | 10-20d = 1pt | 21-40d = 2pts | 41+d = 3pts | máx 3
- Facilidade: marca genérica sem persona = 3pts | nome de pessoa = 0pts | incerto = 2pts | máx 3
Se tempo não disponível, escale score sobre 7 pontos: (volume + facilidade) / 7 * 10

Retorne JSON array ordenado do maior score pro menor. Cada item:
{"pagina_nome":"","ad_library_url":"","landing_url":"","total_anuncios":0,"dias_rodando":null,"data_mais_antiga":"","score":0,"resumo_angulo":"Uma frase sobre o provável ângulo da oferta","facilidade":"alta|média|baixa","nicho":""}

Retorne APENAS o JSON array, sem texto fora.

Páginas:
${JSON.stringify(filtradas, null, 2)}`
          }]
        })

        const rawText = resp.content.find(b => b.type === 'text')
        const text = rawText?.type === 'text' ? rawText.text : '[]'
        let ofertas: unknown[]
        try {
          const match = text.match(/\[[\s\S]*\]/)
          ofertas = JSON.parse(match ? match[0] : text)
        } catch {
          console.error('[Mine] Claude JSON parse failed:', text.slice(0, 300))
          ofertas = filtradas.map(p => ({ ...p, score: Math.min(10, Math.round((p.total_anuncios / 10 + (p.dias_rodando ?? 0) / 15) * 2)), resumo_angulo: '', facilidade: 'média' }))
        }

        send({ type: 'done', ofertas, total: (ofertas as unknown[]).length })
        controller.close()
      } catch (err) {
        send({ type: 'error', message: (err as Error).message })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}
