import { NextRequest } from 'next/server'
import { dbGetUserById, dbGetFreeUsage } from '@/lib/db'

export const maxDuration = 300

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    })
    if (!res.ok) {
      console.warn(`[Phase2] Landing page HTTP ${res.status}: ${url}`)
      return 'ERRO_AO_ACESSAR_PAGINA'
    }
    const html = await res.text()
    const cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000)

    if (cleaned.length < 100) {
      console.warn(`[Phase2] Landing page quase vazia (${cleaned.length} chars): ${url}`)
      return 'PAGINA_VAZIA_OU_BLOQUEADA'
    }
    console.log(`[Phase2] Landing page OK: ${cleaned.length} chars extraídos`)
    return cleaned
  } catch (err) {
    console.error('[Phase2] Erro ao buscar landing page:', (err as Error).message)
    return 'ERRO_AO_ACESSAR_PAGINA'
  }
}

const SYSTEM_PROMPT_PHASE2 = `Você é um especialista em construir funis de vendas de alta conversão no mercado brasileiro de infoprodutos low ticket.

Sua tarefa: baseado na análise dos criativos (Fase 1) e no texto da página do concorrente, gere um PROMPT PRONTO para o usuário colar no Lovable/Bolt e ter o funil completo criado automaticamente.

Retorne APENAS o JSON abaixo, sem texto antes ou depois:

{
  "url_analisada": "...",
  "tipo_de_funil": "página de vendas | quiz | vsl | freemium | typebot | híbrido",
  "promessa_central": "a promessa principal modelada em 1-2 frases",
  "prompt_lovable": "O PROMPT COMPLETO AQUI — veja regras abaixo",
  "estrutura_funil": ["Etapa 1: descrição curta", "Etapa 2: ...", "Etapa 3: ..."],
  "diferenciais_aplicados": ["O que foi melhorado em relação ao concorrente 1", "Melhoria 2", "Melhoria 3"]
}

REGRAS PARA O prompt_lovable:
- Deve ser um prompt COMPLETO e DETALHADO que o usuário cola direto no Lovable ou Bolt.new
- O prompt deve instruir a criação de um funil de vendas COMPLETO com:
  1. Página de vendas responsiva com headline, subheadline, seções de benefícios, prova social, FAQ, garantia e CTA
  2. Se o concorrente usa quiz/typebot, incluir o fluxo de quiz antes da página de vendas
  3. Cores, fontes e tom de voz definidos no prompt
  4. Copy completa de cada seção (não genérica — baseada no nicho e ângulo do concorrente)
  5. Seções de urgência/escassez se o concorrente usar
- O prompt deve MODELAR o que funciona do concorrente mas CORRIGIR os pontos fracos identificados na Fase 1
- Usar o ângulo dominante e os gatilhos que o concorrente usa pra vender
- A copy deve ser em português BR, tom informal/emocional (padrão low ticket)
- NÃO incluir preços ou links de checkout — o usuário preenche depois
- O prompt deve ter no mínimo 800 palavras para ser detalhado o suficiente
- Incluir instruções de design: cores sugeridas, estilo visual, mobile-first

REGRAS PARA estrutura_funil:
- Liste as etapas do funil na ordem que o visitante percorre
- Ex: ["Quiz de 5 perguntas com barra de progresso", "Página de resultado personalizado", "Página de vendas com VSL e depoimentos", "Checkout com order bump"]

REGRAS PARA diferenciais_aplicados:
- Liste 3-5 melhorias concretas que o funil gerado tem em relação ao concorrente
- Baseado nos pontos fracos e "o que corrigir" da Fase 1

TRATAMENTO DE PÁGINA INACESSÍVEL:
Se o conteúdo da página for "PAGINA_VAZIA_OU_BLOQUEADA" ou "ERRO_AO_ACESSAR_PAGINA":
- Gere o prompt baseado APENAS nos dados dos anúncios da Fase 1
- Use o ângulo dominante, nicho e gatilhos para construir o funil
- Ainda assim gere um prompt completo e funcional`

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

        send({ type: 'progress', text: '\uD83D\uDD0D Escaneando p\u00e1gina do concorrente...' })

        const pageText = await fetchPageText(url)

        send({ type: 'progress', text: pageText.length > 100
          ? `\u2705 P\u00e1gina escaneada (${pageText.length} chars)`
          : '\u26A0\uFE0F P\u00e1gina bloqueada \u2014 gerando com dados dos an\u00fancios' })

        send({ type: 'progress', text: '\uD83E\uDDE0 Gerando prompt do funil...' })

        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const prompt = `URL DO CONCORRENTE: ${url}

RELAT\u00d3RIO FASE 1 (an\u00e1lise dos criativos):
${JSON.stringify(phase1Report, null, 2)}

TEXTO DA P\u00c1GINA DE DESTINO DO CONCORRENTE (primeiros 15000 caracteres):
${pageText || '(p\u00e1gina n\u00e3o acess\u00edvel \u2014 gere o prompt com base nos dados dos an\u00fancios)'}

Gere o prompt pronto para Lovable/Bolt com o funil completo modelado a partir deste concorrente. Retorne o JSON estruturado.`

        let rawText = ''
        let lastErr: Error | null = null
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 12000,
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
