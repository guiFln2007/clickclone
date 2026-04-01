import { NextRequest } from 'next/server'
import { dbGetUserById, dbGetFreeUsage } from '@/lib/db'

export const maxDuration = 300

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!res.ok) return ''
    const html = await res.text()
    // Strip scripts/styles, keep text
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return cleaned.slice(0, 8000)
  } catch {
    return ''
  }
}

const SYSTEM_PROMPT_PHASE2 = `Você é um analista de funis de alta conversão especializado no mercado brasileiro de infoprodutos low ticket.

Analise o texto da página de destino e retorne APENAS o JSON abaixo, sem texto antes ou depois:

{
  "url_analisada": "...",
  "tipo_de_funil": "página de vendas | quiz | vsl | freemium | typebot | híbrido",
  "promessa_central": "a promessa principal da página em 1-2 frases",
  "pontos_fortes_pagina": [
    "ponto forte 1 — o que funciona bem na página",
    "ponto forte 2",
    "ponto forte 3"
  ],
  "pontos_fracos_pagina": [
    { "problema": "descrição do problema", "impacto": "alto | médio | baixo" },
    { "problema": "...", "impacto": "..." }
  ],
  "o_que_melhorar_pagina": [
    "sugestão concreta de melhoria 1",
    "sugestão concreta de melhoria 2",
    "sugestão concreta de melhoria 3"
  ],
  "analise_de_copy": {
    "mecanismo_de_dor": "qual dor é explorada e como",
    "como_comunica_garantia": "como a garantia é apresentada",
    "linguagem": "formal | informal | técnica | emocional",
    "palavras_gatilho": ["palavra1", "palavra2", "palavra3"],
    "gap_anuncio_pagina": "diferença entre o que os anúncios prometem e o que a página entrega"
  }
}

REGRAS:
- pontos_fortes_pagina: mínimo 3 itens, máximo 6
- pontos_fracos_pagina: rankeados por impacto (alto primeiro), com descrição acionável
- o_que_melhorar_pagina: sugestões concretas e específicas, não genéricas
- promessa_central: extraia a promessa EXATA que a página faz ao visitante
- Se o texto da página estiver vazio ou incompleto, analise com base no relatório da Fase 1`

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

        send({ type: 'progress', text: '📄 Extraindo texto da página de destino...' })

        const pageText = await fetchPageText(url)

        send({ type: 'progress', text: pageText.length > 100
          ? `✅ ${pageText.length} caracteres extraídos`
          : '⚠️ Pouco texto extraído — analisando com dados dos anúncios' })

        send({ type: 'progress', text: '🧠 Analisando página com Claude...' })

        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const prompt = `URL: ${url}

RELATÓRIO FASE 1:
${JSON.stringify(phase1Report, null, 2)}

TEXTO DA PÁGINA DE DESTINO (primeiros 8000 caracteres):
${pageText || '(página não acessível — analise com base nos dados dos anúncios)'}

Analise a página de destino e retorne o JSON estruturado.`

        let rawText = ''
        let lastErr: Error | null = null
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 6000,
              system: SYSTEM_PROMPT_PHASE2,
              messages: [{ role: 'user', content: prompt }],
            })
            const textBlock = response.content.find(b => b.type === 'text')
            rawText = textBlock?.type === 'text' ? textBlock.text : ''
            console.log(`[Phase2] Claude response: ${rawText.length} chars, stop: ${response.stop_reason}`)
            if (rawText.length > 50) { lastErr = null; break }
            lastErr = new Error(`Resposta muito curta (${rawText.length} chars)`)
          } catch (e) {
            lastErr = e as Error
            console.error(`[Phase2] Attempt ${attempt + 1} failed:`, (e as Error).message)
            if (attempt === 0) send({ type: 'progress', text: '⚠️ Retentando análise...' })
          }
        }
        if (lastErr) throw lastErr

        let report: Record<string, unknown>
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/)
          report = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
        } catch {
          console.error('[Phase2] JSON parse failed:', rawText.slice(0, 500))
          throw new Error('Claude retornou JSON inválido na Fase 2')
        }

        if (!report.url_analisada) report.url_analisada = url

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
