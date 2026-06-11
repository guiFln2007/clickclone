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
const APIFY_TOKEN = process.env.APIFY_TOKEN || ''

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (text.trimStart().startsWith('<')) throw new Error(`Apify retornou HTML. Status: ${res.status}`)
  try { return JSON.parse(text) } catch { throw new Error(`Apify resposta inválida. Status: ${res.status}`) }
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

// Apify fallback (used when local scraper is unavailable)
async function scrapeAdsFromApify(cleanUrl: string): Promise<Record<string, unknown>[]> {
  if (!APIFY_TOKEN) throw new Error('Nem scraper local nem APIFY_TOKEN disponíveis')
  // maxAds: 60 — buildAdsDigest só usa 50 mesmo, então 60 dá margem sem desperdício
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/runs?token=${APIFY_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: [{ url: cleanUrl }], maxAds: 60 }) }
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

  const itemsRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=999`)
  return await safeJson(itemsRes) as Record<string, unknown>[]
}

// Scraper local primeiro ($0), Apify como fallback
async function scrapeAdsLocal(url: string): Promise<Record<string, unknown>[] | null> {
  if (!SCRAPER_URL) return null
  try {
    const res = await fetch(`${SCRAPER_URL}/scrape-ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
      body: JSON.stringify({ url: cleanAdLibraryUrl(url), maxAds: 100 }),
      signal: AbortSignal.timeout(120000),
    })
    if (!res.ok) return null
    const data = await res.json() as { ads?: Record<string, unknown>[] }
    if (!Array.isArray(data.ads) || data.ads.length === 0) return null
    console.log(`[Phase1] Local scraper OK: ${data.ads.length} ads (custo $0)`)
    return data.ads
  } catch (e) {
    console.warn('[Phase1] Local scraper falhou:', (e as Error).message)
    return null
  }
}

async function scrapeAds(url: string): Promise<Record<string, unknown>[]> {
  const local = await scrapeAdsLocal(url)
  if (local && local.length > 0) return normalizeAds(local)
  throw new Error('Scraper local indisponível ou não retornou anúncios. Tente novamente em alguns segundos.')
}

// Normalize ads from local scraper to Apify-like shape
function normalizeAds(rawAds: Record<string, unknown>[]): Record<string, unknown>[] {
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
    const body = (snap?.body as Record<string, unknown>)?.text || (snap?.body_text as string) || (ad.ad_creative_bodies as string[])?.[0] || ''
    const title = (snap?.title as string) || (ad.ad_creative_link_titles as string[])?.[0] || ''
    const cta = (snap?.cta_text as string) || ''
    const format = (snap?.videos as unknown[])?.length ? 'vídeo' : (snap?.images as unknown[])?.length ? 'imagem' : 'carrossel'

    // Resolve start date from multiple possible fields
    const tsRaw = ad.start_date as number | undefined
    const formatted = ad.start_date_formatted as string | undefined
    const deliveryStart = ad.ad_delivery_start_time as string | undefined
    let startLabel = 'unknown'
    if (typeof tsRaw === 'number' && tsRaw > 1000000000) {
      startLabel = new Date(tsRaw * 1000).toISOString().slice(0, 10)
    } else if (formatted) {
      startLabel = formatted
    } else if (deliveryStart) {
      startLabel = deliveryStart
    }

    const days = startLabel !== 'unknown'
      ? Math.floor((Date.now() - new Date(startLabel).getTime()) / 86400000)
      : null

    // Primeiros 15 ads: texto completo (candidatos a top criativos). Restante: truncado.
    const bodyText = i < 15 ? String(body) : String(body).slice(0, 300)
    return `[Anúncio ${i + 1}] Formato: ${format} | Start: ${startLabel}${days !== null ? ` | Rodando há ${days} dias` : ''}
Texto: ${bodyText}
Título: ${String(title).slice(0, 150)}
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
  ],
  "top_criativos": [
    {
      "index": 1,
      "texto_completo": "copy completa do anúncio 1",
      "hook": "primeira frase/hook",
      "formato": "vídeo|imagem|carrossel",
      "dias_rodando": 42,
      "score": 9,
      "angulo": "descrição curta do ângulo"
    },
    {
      "index": 2,
      "texto_completo": "copy completa do anúncio 2",
      "hook": "primeira frase/hook",
      "formato": "vídeo|imagem|carrossel",
      "dias_rodando": 30,
      "score": 8,
      "angulo": "descrição curta do ângulo"
    },
    {
      "index": 3,
      "texto_completo": "copy completa do anúncio 3",
      "hook": "primeira frase/hook",
      "formato": "vídeo|imagem|carrossel",
      "dias_rodando": 15,
      "score": 7,
      "angulo": "descrição curta do ângulo"
    }
  ]
}

REGRA OBRIGATÓRIA: top_criativos DEVE ter entre 3 e 6 itens. Selecione os anúncios com TEXTOS MAIS DIFERENTES entre si (hooks e ângulos distintos). Ordene por score decrescente. Se houver menos de 3 anúncios únicos, inclua todos.

━━━ CÁLCULO DA NOTA DE ENTRADA (0-10) ━━━
A nota é a SOMA EXATA de 3 critérios. Siga rigorosamente:

CRITÉRIO 1 — Volume de anúncios ativos (0 a 4 pontos):
- 0-9 anúncios → 0 pts
- 10-19 anúncios → 2 pts
- 20-49 anúncios → 3 pts
- 50+ anúncios → 4 pts

CRITÉRIO 2 — Tempo rodando (0 a 3 pontos):
Use o campo "TEMPO RODANDO" fornecido no prompt (já calculado pelo sistema).
- Menos de 2 dias → 0 pts
- 2 dias → 1 pt
- 3 dias → 2 pts
- 4+ dias → 3 pts
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

━━━ TOP 6 CRIATIVOS MAIS ESCALADOS ━━━
Dos anúncios recebidos, selecione os 6 MAIS ESCALADOS (priorizando: mais tempo rodando > mais variações de copy similar > formato vídeo).

Para cada um:
- index: posição (1 a 6)
- texto_completo: o copy COMPLETO do anúncio (body text), sem cortar
- hook: a primeira frase/gancho do anúncio
- formato: vídeo, imagem ou carrossel
- dias_rodando: quantos dias o anúncio está ativo (use o campo Start fornecido em cada anúncio, senão estime)
- score: nota de 1-10 baseada em qualidade do copy (hook forte, CTA claro, gatilhos emocionais)
- angulo: descrição curta do ângulo emocional (ex: "medo de perder", "curiosidade + prova social")

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

        send({ type: 'progress', text: `📊 ${ads.length} anúncios encontrados. Analisando...` })

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
          max_tokens: 16000,
          system: SYSTEM_PROMPT_PHASE1,
          messages: [{ role: 'user', content: prompt }],
        })

        const text = response.content.find(b => b.type === 'text')
        const rawText = text?.type === 'text' ? text.text : ''

        let report: Record<string, unknown>
        try {
          const firstBrace = rawText.indexOf('{')
          const lastBrace = rawText.lastIndexOf('}')
          const jsonStr = (firstBrace >= 0 && lastBrace > firstBrace) ? rawText.slice(firstBrace, lastBrace + 1) : rawText
          report = JSON.parse(jsonStr)
        } catch {
          // Try to repair truncated JSON
          console.error('[Phase1] JSON parse failed, attempting repair. Length:', rawText.length, 'stop:', 'check logs')
          try {
            let fixable = rawText.slice(rawText.indexOf('{'))
            const openBraces = (fixable.match(/{/g) || []).length
            const closeBraces = (fixable.match(/}/g) || []).length
            const openBrackets = (fixable.match(/\[/g) || []).length
            const closeBrackets = (fixable.match(/]/g) || []).length
            // Truncate at last complete value
            const lastCleanCut = Math.max(fixable.lastIndexOf('",'), fixable.lastIndexOf('"],'), fixable.lastIndexOf('},'))
            if (lastCleanCut > fixable.length * 0.5) fixable = fixable.slice(0, lastCleanCut + 1)
            // Close arrays and braces
            for (let i = 0; i < openBrackets - closeBrackets; i++) fixable += ']'
            for (let i = 0; i < openBraces - closeBraces; i++) fixable += '}'
            report = JSON.parse(fixable)
            console.log('[Phase1] JSON repaired successfully')
          } catch {
            console.error('[Phase1] Repair failed. Raw:', rawText.slice(0, 500))
            throw new Error('Claude retornou JSON inválido na Fase 1')
          }
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

        // Attach real media URLs to top_criativos from the ads data
        const topCriativos = report.top_criativos as { index: number; texto_completo: string; hook: string; formato: string; media_url?: string }[] | undefined
        if (topCriativos && Array.isArray(topCriativos)) {
          // Collect ALL media from ads (images + videos)
          const allImages: string[] = []
          const allVideos: string[] = []
          const adMediaByText = new Map<string, { images: string[]; videos: string[] }>()

          for (const ad of ads) {
            const snap = ad.snapshot as Record<string, unknown> | undefined
            if (!snap) continue
            const bodyText = ((snap.body as Record<string, unknown>)?.text as string) || (snap.body_text as string) || ''
            const images: string[] = []
            const videos: string[] = []
            const snapImages = snap.images as Array<Record<string, string>> | undefined
            if (Array.isArray(snapImages)) {
              for (const img of snapImages) {
                const url = img.original_image_url || img.resized_image_url || img.url || ''
                if (url.startsWith('http')) { images.push(url); allImages.push(url) }
              }
            }
            const snapVideos = snap.videos as Array<Record<string, string>> | undefined
            if (Array.isArray(snapVideos)) {
              for (const vid of snapVideos) {
                const url = vid.video_hd_url || vid.video_sd_url || ''
                if (url.startsWith('http')) { videos.push(url); allVideos.push(url) }
              }
            }
            const cards = snap.cards as Array<Record<string, unknown>> | undefined
            if (Array.isArray(cards)) {
              for (const card of cards) {
                const imgUrl = (card.original_image_url || card.resized_image_url) as string
                if (imgUrl?.startsWith('http')) { images.push(imgUrl); allImages.push(imgUrl) }
              }
            }
            if (bodyText && (images.length > 0 || videos.length > 0)) {
              adMediaByText.set(bodyText.slice(0, 80).toLowerCase().trim(), { images, videos })
            }
          }

          // Dedupe + fix low-res thumbnails (Facebook adds stp=dst-jpg_s60x60)
          const uniqueVideos = [...new Set(allVideos)]
          const uniqueImages = [...new Set(allImages)].map(url => {
            try {
              const u = new URL(url)
              const stp = u.searchParams.get('stp')
              if (stp && stp.includes('s60x60')) {
                u.searchParams.set('stp', stp.replace(/dst-jpg_s\d+x\d+/g, 'dst-jpg_s600x600'))
              }
              return u.toString()
            } catch { return url }
          })
          console.log(`[Phase1] Media: ${uniqueVideos.length} videos, ${uniqueImages.length} images from ${ads.length} ads`)

          // Match each top criativo to media — try text match first, then round-robin
          const usedUrls = new Set<string>()
          let fallbackIdx = 0
          const fallbackPool = [...uniqueVideos, ...uniqueImages]

          for (const criativo of topCriativos) {
            const searchKey = (criativo.texto_completo || criativo.hook || '').slice(0, 80).toLowerCase().trim()
            // Try text match
            let media: { images: string[]; videos: string[] } | undefined
            if (searchKey) {
              media = adMediaByText.get(searchKey)
              if (!media) {
                for (const [key, val] of adMediaByText.entries()) {
                  if (searchKey.includes(key.slice(0, 30)) || key.includes(searchKey.slice(0, 30))) {
                    media = val; break
                  }
                }
              }
            }
            const isVid = (criativo.formato || '').toLowerCase().includes('v')
            if (media) {
              // Prioriza vídeo pra criativos tipo vídeo, imagem pra imagem
              const urls = isVid ? [...media.videos, ...media.images] : [...media.images, ...media.videos]
              const unused = urls.find(u => !usedUrls.has(u))
              if (unused) { criativo.media_url = unused; usedUrls.add(unused) }
              else if (urls[0]) { criativo.media_url = urls[0] }
            }
            // Fallback: round-robin — vídeos primeiro pra criativos de vídeo
            if (!criativo.media_url && fallbackPool.length > 0) {
              const pool = isVid ? [...uniqueVideos, ...uniqueImages] : [...uniqueImages, ...uniqueVideos]
              const unused = pool.find(u => !usedUrls.has(u))
              if (unused) { criativo.media_url = unused; usedUrls.add(unused) }
              else { criativo.media_url = pool[fallbackIdx % pool.length] }
              fallbackIdx++
            }
          }
          report.top_criativos = topCriativos
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
