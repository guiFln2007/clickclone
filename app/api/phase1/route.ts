import { NextRequest } from 'next/server'
import {
  dbGetUserById,
  dbDecrementAnalises,
  dbGetFreeUsage,
  dbIncrementFreeAnalises,
  dbLogAnalysis,
  dbGetCachedAnalysis,
  dbSaveCachedAnalysis,
} from '@/lib/db'

export const maxDuration = 300

const APIFY_TOKEN = process.env.APIFY_TOKEN!

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (text.trimStart().startsWith('<')) {
    throw new Error(`Apify retornou HTML. Status: ${res.status}`)
  }
  try { return JSON.parse(text) } catch {
    throw new Error(`Apify resposta inválida. Status: ${res.status}`)
  }
}

function cleanAdLibraryUrl(url: string): string {
  try {
    const u = new URL(url)
    const clean = new URL('https://www.facebook.com/ads/library/')
    const keep = ['active_status', 'ad_type', 'country', 'search_type', 'view_all_page_id', 'media_type']
    for (const k of keep) {
      const v = u.searchParams.get(k)
      if (v) clean.searchParams.set(k, v)
    }
    return clean.toString()
  } catch { return url }
}

async function scrapeAds(url: string) {
  const cleanUrl = cleanAdLibraryUrl(url)
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [{ url: cleanUrl }], maxAds: 100 }),
    }
  )
  const runData = await safeJson(runRes) as Record<string, unknown>
  const runId = (runData?.data as Record<string, unknown>)?.id
  if (!runId) throw new Error('Apify não retornou runId')

  let status = 'RUNNING'
  let attempts = 0
  while (['RUNNING', 'READY'].includes(status) && attempts < 30) {
    await sleep(2000)
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    const sd = await safeJson(s) as Record<string, unknown>
    status = (sd?.data as Record<string, unknown>)?.status as string ?? 'FAILED'
    attempts++
  }

  const itemsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=999`
  )
  return await safeJson(itemsRes) as Record<string, unknown>[]
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

function extractPageId(url: string): string {
  try {
    const u = new URL(url)
    return u.searchParams.get('view_all_page_id') || u.searchParams.get('id') || url
  } catch { return url }
}

function buildAdsDigest(ads: Record<string, unknown>[]): string {
  return ads.slice(0, 50).map((ad, i) => {
    const snap = ad.snapshot as Record<string, unknown> | undefined
    const body = (snap?.body as Record<string, unknown>)?.text || (ad.ad_creative_bodies as string[])?.[0] || ''
    const title = (snap?.title as string) || (ad.ad_creative_link_titles as string[])?.[0] || ''
    const cta = (snap?.cta_text as string) || ''
    const format = (snap?.videos as unknown[])?.length ? 'vídeo' : (snap?.images as unknown[])?.length ? 'imagem' : 'carrossel'
    const startDate = ad.ad_delivery_start_time as string || ''
    const days = startDate
      ? Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000)
      : null

    return `[Anúncio ${i + 1}] Formato: ${format} | ${days !== null ? `Rodando há ${days} dias` : ''}
Texto: ${String(body).slice(0, 200)}
Título: ${String(title).slice(0, 100)}
CTA: ${cta}`
  }).join('\n---\n')
}

const SYSTEM_PROMPT_PHASE1 = `Você é um analista de criativos de anúncios especializado no mercado brasileiro de infoprodutos low ticket.

Sua função: analisar criativos do Meta Ad Library e retornar um JSON estruturado com inteligência competitiva.

RETORNE APENAS O JSON ABAIXO, sem texto antes ou depois:

{
  "landing_url": "URL extraída dos anúncios",
  "total_ads_analyzed": 0,
  "dias_rodando": 0,
  "nota_entrada": {
    "score": 0,
    "volume_pts": 0,
    "volume_desc": "X anúncios ativos",
    "tempo_pts": 0,
    "tempo_desc": "X dias rodando",
    "expert_pts": 0,
    "expert_desc": "Sem expert identificável / Expert com seguidores / Marca sem persona",
    "justificativa": "explicação em 1-2 frases"
  },
  "angulo_dominante": "descrição do ângulo principal",
  "copy_patterns": ["padrão 1", "padrão 2", "padrão 3"],
  "formatos_validados": ["formato 1", "formato 2"],
  "pontos_fracos_criativos": ["fraqueza 1", "fraqueza 2"],
  "sugestoes_criativos": ["sugestão 1", "sugestão 2", "sugestão 3"]
}

━━━ CÁLCULO DA NOTA DE ENTRADA (0-10) ━━━
A nota é a SOMA EXATA de 3 critérios. Siga rigorosamente:

CRITÉRIO 1 — Volume de anúncios ativos (0 a 4 pontos):
- 0-9 anúncios → 0 pts
- 10-19 anúncios → 2 pts
- 20-49 anúncios → 3 pts
- 50+ anúncios → 4 pts

CRITÉRIO 2 — Tempo rodando (0 a 3 pontos):
Use a data mais antiga de "ad_delivery_start_time" dos anúncios para calcular dias.
- Menos de 10 dias → 0 pts
- 10-20 dias → 1 pt
- 21-40 dias → 2 pts
- 41+ dias → 3 pts

CRITÉRIO 3 — Ausência de expert (0 a 3 pontos):
- Expert real identificável (pessoa física com nome, rosto recorrente, perfil com seguidores) → 0 pts
- Marca/personagem sem persona forte → 2 pts
- Sem expert nenhum, marca genérica ou produto direto → 3 pts

score = volume_pts + tempo_pts + expert_pts (máximo 10)

IMPORTANTE: Formatos de criativos (vídeo, foto, carrossel) NÃO afetam a nota. Ignore formato no cálculo.

Preencha volume_pts, tempo_pts, expert_pts com os valores exatos calculados.
Preencha volume_desc, tempo_desc, expert_desc com descrição curta do critério.
Preencha dias_rodando com o número de dias desde o anúncio mais antigo.

COPY PATTERNS: frases-gatilho reais extraídas dos anúncios (não genéricas)
FORMATOS: "vídeo UGC feminino 15s", "carrossel com resultado", "estático com headline de dor"
SUGESTÕES: hooks específicos e acionáveis para o nicho identificado`

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        const userIdHeader = req.headers.get('x-user-id')
        const userId = userIdHeader ? Number(userIdHeader) : null
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
        const sessionId = req.headers.get('x-session-id') || 'anonymous'

        const { url } = await req.json()
        if (!url) throw new Error('URL não fornecida')

        // Auth / quota check
        if (!userId) {
          const freeUsage = await dbGetFreeUsage(ip, sessionId)
          if ((freeUsage?.analises_usadas ?? 0) >= 1) {
            send({ type: 'error', message: 'Limite gratuito atingido. Crie uma conta para continuar.', upgrade: true })
            controller.close(); return
          }
        } else {
          const user = await dbGetUserById(userId)
          if (!user || !user.ativo) {
            send({ type: 'error', message: 'Conta inativa.' })
            controller.close(); return
          }
          if ((user.analises ?? 0) <= 0) {
            send({ type: 'error', message: 'Análises esgotadas.', upgrade: true })
            controller.close(); return
          }
        }

        // Cache check
        const pageId = extractPageId(url)
        const cached = await dbGetCachedAnalysis(pageId)
        if (cached?.analysis) {
          try {
            const cachedReport = JSON.parse(cached.analysis)
            if (cachedReport.angulo_dominante) {
              send({ type: 'progress', text: '⚡ Resultado em cache encontrado' })
              send({ type: 'done', report: cachedReport })
              controller.close(); return
            }
          } catch { /* ignore bad cache */ }
        }

        send({ type: 'progress', text: '🔍 Conectando ao Meta Ad Library...' })

        let ads: Record<string, unknown>[] = []
        try {
          const raw = await scrapeAds(url)
          ads = Array.isArray(raw) ? raw : []
        } catch (e) {
          throw new Error(`Falha ao scraper anúncios: ${(e as Error).message}`)
        }

        if (!ads.length) throw new Error('Nenhum anúncio encontrado. Verifique a URL.')

        send({ type: 'progress', text: `📊 ${ads.length} anúncios encontrados. Analisando com Claude...` })

        const landingUrl = extractLandingUrl(ads) || ''
        const digest = buildAdsDigest(ads)

        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const prompt = `URL DA PÁGINA DE DESTINO: ${landingUrl}

TOTAL DE ANÚNCIOS ATIVOS: ${ads.length}

CRIATIVOS:
${digest}

Analise estes criativos e retorne o JSON estruturado.`

        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: SYSTEM_PROMPT_PHASE1,
          messages: [{ role: 'user', content: prompt }],
        })

        const text = response.content.find(b => b.type === 'text')
        const rawText = text?.type === 'text' ? text.text : ''

        let report: Record<string, unknown>
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/)
          report = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
        } catch {
          throw new Error('Claude retornou JSON inválido na Fase 1')
        }

        // Ensure landing_url is set
        if (!report.landing_url && landingUrl) report.landing_url = landingUrl
        if (!report.total_ads_analyzed) report.total_ads_analyzed = ads.length

        // Deduct quota
        if (userId) {
          await dbDecrementAnalises(userId)
          await dbLogAnalysis(userId, ip)
        } else {
          await dbIncrementFreeAnalises(ip, sessionId)
        }

        // Save partial cache (just phase 1 report)
        await dbSaveCachedAnalysis(pageId, JSON.stringify(report), '')

        send({ type: 'done', report })
        controller.close()
      } catch (err) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : 'Erro interno' })}\n\n`
        ))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
