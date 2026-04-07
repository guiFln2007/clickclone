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

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''

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

// Calls local scraper to scrape ads from a Facebook Ad Library URL
async function scrapeAds(url: string): Promise<Record<string, unknown>[]> {
  if (!SCRAPER_URL) throw new Error('SCRAPER_URL não configurado')
  const cleanUrl = cleanAdLibraryUrl(url)

  const res = await fetch(`${SCRAPER_URL}/scrape-ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
    body: JSON.stringify({ url: cleanUrl, maxAds: 100 }),
    signal: AbortSignal.timeout(240000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>
    throw new Error(err.error || `Scraper HTTP ${res.status}`)
  }
  const data = await res.json() as { ads?: Record<string, unknown>[]; results?: Record<string, unknown>[] }
  const rawAds = (data.ads || data.results || []) as Record<string, unknown>[]

  // Normalize to Apify-like shape so the rest of the code works unchanged
  return rawAds.map(ad => {
    // If already has Apify-like shape, keep as-is
    if (ad.snapshot || ad.start_date) return ad

    // Otherwise, normalize from scraper format
    const text = (ad.text as string) || (ad.body as string) || (ad.copy as string) || ''
    const title = (ad.title as string) || (ad.headline as string) || ''
    const cta = (ad.cta as string) || (ad.cta_text as string) || ''
    const linkUrl = (ad.linkUrl as string) || (ad.link_url as string) || (ad.landingUrl as string) || (ad.landing_url as string) || ''

    // Date handling — try various field names
    const startTs = (ad.startDate as number) || (ad.start_date as number) || (ad.startedAt as number) || 0
    const startStr = (ad.startDateFormatted as string) || (ad.start_date_formatted as string) || ''

    return {
      ...ad,
      snapshot: {
        body: { text },
        title,
        cta_text: cta,
        link_url: linkUrl,
        videos: ad.format === 'video' ? [{}] : [],
        images: ad.format === 'image' ? [{}] : [],
      },
      start_date: typeof startTs === 'number' && startTs > 0 ? startTs : undefined,
      start_date_formatted: startStr || undefined,
      ad_creative_link_url: linkUrl,
    }
  })
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

function calcDiasRodando(ads: Record<string, unknown>[]): { dias: number | null; texto: string; dataInicio: string | null } {
  const datas: Date[] = []

  // Log first ad keys to debug field names
  if (ads[0]) {
    console.log('[Phase1] Ad keys:', Object.keys(ads[0]).join(', '))
    const snap = ads[0].snapshot as Record<string, unknown> | undefined
    if (snap) console.log('[Phase1] Snapshot keys:', Object.keys(snap).join(', '))
  }

  for (const ad of ads) {
    // start_date from Apify is a UNIX timestamp (seconds)
    const tsRaw = ad.start_date as number | string | undefined
    const formatted = ad.start_date_formatted as string | undefined
    const legacy = (ad.ad_delivery_start_time as string) || (ad.startDate as string) || (ad.startedRunningAt as string) || ''

    let d: Date | null = null

    if (typeof tsRaw === 'number' && tsRaw > 1000000000) {
      // Unix timestamp in seconds
      d = new Date(tsRaw * 1000)
    } else if (formatted) {
      // "2026-02-25 08:00:00"
      d = new Date(formatted)
    } else if (typeof tsRaw === 'string' && tsRaw) {
      d = new Date(tsRaw)
    } else if (legacy) {
      d = new Date(legacy)
    }

    if (d && !isNaN(d.getTime()) && d.getFullYear() > 2000) datas.push(d)
  }

  console.log(`[Phase1] Datas encontradas: ${datas.length}/${ads.length} anúncios`)
  if (datas.length === 0) return { dias: null, texto: 'Data não disponível nos criativos', dataInicio: null }

  const maisAntiga = datas.reduce((o, d) => d < o ? d : o, datas[0])
  const dias = Math.floor((Date.now() - maisAntiga.getTime()) / 86400000)
  const meses = Math.floor(dias / 30)
  const textoTempo = meses >= 2 ? `${meses} meses` : `${dias} dias`
  const dataFormatada = maisAntiga.toLocaleDateString('pt-BR')
  return { dias, texto: `Rodando há ${textoTempo} (desde ${dataFormatada})`, dataInicio: dataFormatada }
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
  "pagina_nome": "nome da página anunciante",
  "nicho_identificado": "nicho do produto",
  "total_ads_analyzed": 0,
  "dias_rodando": 0,
  "nota_entrada": {
    "score": 0,
    "volume_pts": 0,
    "volume_desc": "X anúncios ativos",
    "tempo_pts": 0,
    "tempo_desc": "X dias rodando",
    "expert_pts": 0,
    "expert_desc": "descrição curta",
    "justificativa": "explicação em 2-3 frases"
  },
  "angulo_dominante": "descrição detalhada do ângulo principal usado nos criativos",
  "o_que_usa_pra_vender": ["gatilho/promessa 1", "gatilho/promessa 2", "gatilho/promessa 3"],
  "angulos_nao_explorados": ["ângulo sugerido 1", "ângulo sugerido 2", "ângulo sugerido 3"],
  "pontos_fortes_criativos": ["ponto forte 1", "ponto forte 2"],
  "pontos_fracos_criativos": ["fraqueza 1", "fraqueza 2"],
  "o_que_modelar": {
    "manter": ["o que copiar da estratégia", "o que funciona"],
    "corrigir": ["o que melhorar antes de replicar"]
  },
  "scripts_ctv": [
    {
      "numero": 1,
      "formato": "UGC Feminino 15s",
      "hook": "texto do hook 0-3s pronto pra gravar",
      "corpo": "texto do corpo 3-12s pronto pra gravar",
      "cta": "texto do CTA 12-15s pronto pra gravar"
    },
    {
      "numero": 2,
      "formato": "Estático com headline de dor",
      "hook": "texto do hook",
      "corpo": "texto do corpo",
      "cta": "texto do CTA"
    },
    {
      "numero": 3,
      "formato": "Vídeo carrossel 30s",
      "hook": "texto do hook",
      "corpo": "texto do corpo",
      "cta": "texto do CTA"
    }
  ]
}

━━━ CÁLCULO DA NOTA DE ENTRADA (0-10) ━━━
A nota é a SOMA EXATA de 3 critérios. Siga rigorosamente:

CRITÉRIO 1 — Volume de anúncios ativos (0 a 4 pontos):
- 0-9 anúncios → 0 pts
- 10-19 anúncios → 2 pts
- 20-49 anúncios → 3 pts
- 50+ anúncios → 4 pts

CRITÉRIO 2 — Tempo rodando (0 a 3 pontos):
Use o campo "TEMPO RODANDO" fornecido no prompt (já calculado pelo sistema).
- Menos de 10 dias → 0 pts
- 10-20 dias → 1 pt
- 21-40 dias → 2 pts
- 41+ dias → 3 pts
- Se "Data não disponível" → o sistema vai desconsiderar este critério automaticamente

CRITÉRIO 3 — Expert identificável (0 a 3 pontos):
ATENÇÃO: Ausência de expert é POSITIVO (facilita entrar na oferta).
- 3 pontos → Sem expert nenhum identificável nos criativos (marca genérica, produto direto, nenhum nome/rosto/persona recorrente)
- 3 pontos → Se todos os anúncios são de marca genérica sem pessoa por trás
- 2 pontos → Dúvida se existe expert (não consegue confirmar presença NEM ausência total)
- 2 pontos → Personagem/marca com nome mas sem persona forte nem seguidores
- 0 pontos → Expert REAL e IDENTIFICÁVEL (pessoa física com nome, rosto recorrente nos criativos, perfil público com seguidores)
REGRA: NUNCA dar 0 pontos por não conseguir confirmar a existência de expert. Se não há menção a persona, nome ou rosto = 3 pontos.

score = volume_pts + tempo_pts + expert_pts (máximo 10)

IMPORTANTE: Formatos de criativos NÃO afetam a nota.

━━━ ANÁLISE PROFUNDA DOS CRIATIVOS ━━━

Você recebe o texto completo de todos os anúncios ativos.
Analise cada um individualmente antes de identificar padrões.

PONTOS FORTES (pontos_fortes_criativos) — identifique especificamente:
- Quais hooks estão sendo usados e por que funcionam emocionalmente
- Quais gatilhos mentais aparecem (escassez, prova social, autoridade, curiosidade, medo, transformação)
- Padrões de abertura que se repetem em múltiplos anúncios (sinal de teste validado)
- Tom de voz que domina (confessional, educativo, urgente, aspiracional)
- Estruturas narrativas identificadas (história pessoal, lista de benefícios, pergunta + resposta, antes/depois)

PONTOS FRACOS (pontos_fracos_criativos) — identifique especificamente:
- Objeções que os anúncios NÃO estão quebrando
- Ângulos emocionais que existem no nicho mas não estão sendo explorados
- Problemas de copy: CTAs fracos, promessas genéricas, ausência de especificidade
- Formatos ausentes que poderiam ampliar alcance
- Inconsistências entre o que o anúncio promete e o que provavelmente entrega

O QUE MODELAR (o_que_modelar):
- manter: liste exatamente quais elementos valem replicar — seja específico
  Não diga "bom copy", diga "a abertura 'você já sentiu que...' ativa empatia imediata e deve ser mantida"
- corrigir: liste o que está fraco e deve ser melhorado antes de replicar

━━━ 3 SCRIPTS DE CTV ━━━
Baseado nos padrões validados, escreva 3 scripts completos em português BR coloquial,
prontos pra gravar sem edição. Cada script com:
- formato: tipo sugerido (UGC direto câmera, storytelling, educativo, prova social, carrossel)
- hook (0-3s): frase de abertura que PARA O SCROLL — emocional, específica, inesperada
- corpo (3-15s): desenvolvimento do argumento com o gatilho principal do nicho
- cta (últimos 3s): chamada pra ação direta, urgente e específica

Os scripts devem soar como uma pessoa real falando, não como copy de agência.
Use gírias do nicho quando relevante. Máximo 150 palavras por script.

━━━ ANÁLISE GERAL ━━━
- angulo_dominante: descreva em 2-3 frases detalhadas o ângulo emocional principal
- o_que_usa_pra_vender: liste os gatilhos específicos, objeções quebradas, promessas recorrentes
  Exemplo: "usa medo de traição como gatilho principal, promete acesso a mensagens deletadas, quebra objeção de legalidade"
- angulos_nao_explorados: 3-5 ângulos que o concorrente NÃO está usando e podem ser testados
  Seja criativo e específico — ângulos reais do nicho, não genéricos`

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
        const tempoInfo = calcDiasRodando(ads)

        console.log(`[Phase1] Dias rodando: ${tempoInfo.dias}, desde: ${tempoInfo.dataInicio}`)

        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const prompt = `URL DA PÁGINA DE DESTINO: ${landingUrl}

TOTAL DE ANÚNCIOS ATIVOS: ${ads.length}

TEMPO RODANDO: ${tempoInfo.dias !== null ? `${tempoInfo.dias} dias (desde ${tempoInfo.dataInicio})` : 'Data não disponível'}

CRIATIVOS:
${digest}

Analise estes criativos e retorne o JSON estruturado.
IMPORTANTE: Use o dado "TEMPO RODANDO" acima para preencher dias_rodando e calcular tempo_pts corretamente.`

        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
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

        // Ensure fields are set with real data (override Claude's guesses)
        if (!report.landing_url && landingUrl) report.landing_url = landingUrl
        if (!report.total_ads_analyzed) report.total_ads_analyzed = ads.length

        // Override dias_rodando with our calculated value (more accurate than Claude's guess)
        report.dias_rodando = tempoInfo.dias
        report.tempo_rodando_texto = tempoInfo.texto

        // Recalculate tempo_pts and score based on real data
        const notaEntrada = report.nota_entrada as Record<string, unknown> | undefined
        if (notaEntrada) {
          const vPts = Number(notaEntrada.volume_pts) || 0
          let ePts = Number(notaEntrada.expert_pts) || 0

          // Fix expert: if Claude gave 0 but couldn't confirm expert exists, bump to 2-3
          if (ePts === 0) {
            const desc = String(notaEntrada.expert_desc || '').toLowerCase()
            const hasRealExpert = desc.includes('expert real') || desc.includes('pessoa física') || desc.includes('seguidores')
            if (!hasRealExpert) {
              ePts = desc.includes('marca') || desc.includes('genéric') || desc.includes('sem expert') || desc.includes('sem persona') ? 3 : 2
              notaEntrada.expert_pts = ePts
              console.log(`[Phase1] Expert pts corrigido: 0 → ${ePts} (desc: ${desc.slice(0, 80)})`)
            }
          }

          if (tempoInfo.dias !== null) {
            // Tempo disponível: calcula normalmente
            const tempoPts = tempoInfo.dias >= 41 ? 3 : tempoInfo.dias >= 21 ? 2 : tempoInfo.dias >= 10 ? 1 : 0
            notaEntrada.tempo_pts = tempoPts
            notaEntrada.tempo_desc = tempoInfo.texto
            notaEntrada.score = vPts + tempoPts + ePts
          } else {
            // Tempo NÃO disponível: desconsidera critério, escala sobre 7 pontos
            notaEntrada.tempo_pts = null
            notaEntrada.tempo_desc = 'Data não disponível — critério desconsiderado'
            const pontosObtidos = vPts + ePts
            const pontosPossiveis = 7 // 4 (volume) + 3 (expert), sem tempo
            notaEntrada.score = Math.round((pontosObtidos / pontosPossiveis) * 10)
            console.log(`[Phase1] Tempo null: score = (${pontosObtidos}/${pontosPossiveis}) * 10 = ${notaEntrada.score}`)
          }
          report.nota_entrada = notaEntrada
        }

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
