import { NextRequest } from 'next/server'
import { dbGetUserById, dbGetFreeUsage } from '@/lib/db'

export const maxDuration = 300

async function capturePageScreenshots(url: string): Promise<string[]> {
  const accessKey = process.env.SCREENSHOTONE_API_KEY
  if (!accessKey) {
    console.warn('[Phase2] SCREENSHOTONE_API_KEY não configurada')
    return []
  }

  const baseUrl = 'https://api.screenshotone.com/take'

  // Step 1: full page to get total height
  const fullPageUrl = `${baseUrl}?url=${encodeURIComponent(url)}&access_key=${accessKey}&full_page=true&viewport_width=1440&format=jpg&image_quality=70&response_type=json`

  let pageHeight = 6000
  try {
    const metaRes = await fetch(fullPageUrl, { signal: AbortSignal.timeout(20000) })
    if (metaRes.ok) {
      const meta = await metaRes.json()
      pageHeight = meta?.page_height ?? 6000
    }
  } catch (e) {
    console.warn('[Phase2] Falhou ao obter page_height, usando 6000px fallback:', (e as Error).message)
  }

  // Step 2: divide into 900px sections with 100px overlap
  const sectionHeight = 900
  const overlap = 100
  const scrollPositions: number[] = []
  let scrollY = 0
  while (scrollY < pageHeight) {
    scrollPositions.push(scrollY)
    scrollY += sectionHeight - overlap
  }

  // Step 3: build screenshot URLs for each scroll position + mobile full page
  const shotUrls: string[] = [
    ...scrollPositions.map(sy =>
      `${baseUrl}?url=${encodeURIComponent(url)}&access_key=${accessKey}&viewport_width=1440&viewport_height=${sectionHeight}&scroll_position=${sy}&format=jpg&image_quality=75`
    ),
    // Mobile full page
    `${baseUrl}?url=${encodeURIComponent(url)}&access_key=${accessKey}&full_page=true&viewport_width=375&format=jpg&image_quality=70`,
  ]

  // Step 4: fire all in parallel, discard failures
  const results = await Promise.allSettled(
    shotUrls.map(async (shotUrl) => {
      const res = await fetch(shotUrl, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buffer = await res.arrayBuffer()
      return Buffer.from(buffer).toString('base64')
    })
  )

  const screenshots = results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<string>).value)

  console.log(`[Phase2] Screenshots: ${screenshots.length}/${shotUrls.length} (${scrollPositions.length} seções + 1 mobile)`)
  return screenshots
}

const SYSTEM_PROMPT_PHASE2 = `Você é um analista de funis de alta conversão especializado no mercado brasileiro de infoprodutos low ticket. Sua função é dissecar completamente a página de destino de uma campanha.

RETORNE APENAS O JSON ABAIXO, sem texto antes ou depois:

{
  "url_analisada": "...",
  "tipo_de_funil": "página de vendas | quiz | vsl | freemium | typebot | híbrido",
  "total_secoes": 0,
  "tempo_estimado_leitura": "X min",
  "estrutura": [
    {
      "posicao": 1,
      "nome": "Hero",
      "elementos": ["Headline", "CTA"],
      "copy_principal": "texto exato",
      "funcao_de_conversao": "...",
      "qualidade": "forte | médio | fraco",
      "justificativa": "..."
    }
  ],
  "analise_de_copy": {
    "mecanismo_de_dor": "...",
    "promessa_central": "...",
    "como_comunica_garantia": "...",
    "linguagem": "formal | informal | técnica | emocional",
    "palavras_gatilho": ["palavra1", "palavra2"],
    "gap_anuncio_pagina": "diferença entre o que os anúncios prometem e o que a página entrega"
  },
  "analise_de_design": {
    "paleta_dominante": ["#hex1", "#hex2", "#hex3"],
    "tipografia": { "heading": "nome ou descrição", "body": "nome ou descrição" },
    "tom_visual": "místico | urgente | confiável | emocional | profissional",
    "problemas_de_design": ["problema 1", "problema 2"],
    "acertos_de_design": ["acerto 1", "acerto 2"]
  },
  "assets_reaproveitaveis": {
    "imagens": [{ "url": "...", "descricao": "...", "onde_usar": "..." }],
    "videos": [{ "url": "...", "descricao": "...", "onde_usar": "..." }],
    "icones_ou_badges": [{ "descricao": "...", "onde_usar": "..." }]
  },
  "pontos_fracos": [
    { "rank": 1, "problema": "...", "impacto": "alto | médio | baixo", "como_corrigir": "..." }
  ],
  "elementos_que_funcionam": ["elemento 1", "elemento 2"],
  "instrucoes_para_fase3": {
    "preservar": ["o que manter"],
    "corrigir": ["o que corrigir"],
    "adicionar": ["o que adicionar"]
  }
}`

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

        // Light auth check (Phase 2 is part of Phase 1 flow, already charged)
        if (!userId) {
          const freeUsage = await dbGetFreeUsage(ip, sessionId)
          if ((freeUsage?.analises_usadas ?? 0) <= 0) {
            send({ type: 'error', message: 'Sessão inválida.' })
            controller.close(); return
          }
        } else {
          const user = await dbGetUserById(userId)
          if (!user || !user.ativo) {
            send({ type: 'error', message: 'Conta inativa.' })
            controller.close(); return
          }
        }

        const { url, phase1Report } = await req.json()
        if (!url) throw new Error('URL não fornecida')

        send({ type: 'progress', text: '📸 Tirando screenshots da página...' })

        let screenshots: string[] = []
        try {
          screenshots = await capturePageScreenshots(url)
          if (screenshots.length > 0) {
            send({ type: 'progress', text: `✅ ${screenshots.length} screenshots capturados (seção por seção)` })
          } else {
            send({ type: 'progress', text: '⚠️ Screenshots não disponíveis — analisando via texto' })
          }
        } catch (e) {
          send({ type: 'progress', text: '⚠️ Screenshots falharam — continuando com análise textual' })
          console.warn('[Phase2] Screenshot error:', e)
        }

        send({ type: 'progress', text: '🧠 Analisando estrutura da página com Claude...' })

        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        type ContentBlock = { type: string; text?: string; source?: { type: string; media_type: string; data: string } }
        const userContent: ContentBlock[] = [
          {
            type: 'text',
            text: `URL: ${url}

RELATÓRIO FASE 1:
${JSON.stringify(phase1Report, null, 2)}

Analise a página completa usando as screenshots fornecidas e retorne o JSON de análise.`,
          },
        ]

        // Add screenshots — up to 6 sections to cover the full funnel
        for (const img of screenshots.slice(0, 6)) {
          // Skip if too large (>1MB base64 ≈ 750KB image)
          if (img.length > 1400000) continue
          userContent.push({
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: img },
          })
        }

        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          system: SYSTEM_PROMPT_PHASE2,
          messages: [{ role: 'user', content: userContent as Parameters<typeof client.messages.create>[0]['messages'][0]['content'] }],
        })

        const text = response.content.find(b => b.type === 'text')
        const rawText = text?.type === 'text' ? text.text : ''

        let report: Record<string, unknown>
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/)
          report = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
        } catch {
          throw new Error('Claude retornou JSON inválido na Fase 2')
        }

        if (!report.url_analisada) report.url_analisada = url

        send({ type: 'done', report, screenshots })
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
