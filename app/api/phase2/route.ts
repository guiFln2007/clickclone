import { NextRequest } from 'next/server'
import { dbGetUserById, dbGetFreeUsage } from '@/lib/db'

export const maxDuration = 300

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
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

async function fetchPageMedia(url: string): Promise<{ images: string[], videos: string[], ogImage: string | null }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    if (!res.ok) return { images: [], videos: [], ogImage: null }
    const html = await res.text()

    // Extract OG image
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    const ogImage = ogMatch?.[1] || null

    // Extract all image srcs
    const imgRegex = /<img[^>]*(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*/gi
    const images: string[] = []
    let match
    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1]
      if (src.startsWith('http') && !src.includes('data:') && !src.includes('pixel') && !src.includes('tracking') && !src.includes('facebook.com') && !src.includes('google-analytics')) {
        images.push(src)
      }
    }

    // Extract video srcs
    const vidRegex = /<(?:video|source)[^>]*src=["']([^"']+)["']/gi
    const videos: string[] = []
    while ((match = vidRegex.exec(html)) !== null) {
      if (match[1].startsWith('http')) videos.push(match[1])
    }

    return {
      images: Array.from(new Set(images)).slice(0, 15),
      videos: Array.from(new Set(videos)).slice(0, 5),
      ogImage
    }
  } catch {
    return { images: [], videos: [], ogImage: null }
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
- O prompt DEVE instruir a usar as URLS DE MÍDIA REAIS fornecidas abaixo (imagens e vídeos do concorrente)
- ESTRUTURA OBRIGATÓRIA DO FUNIL (nesta ordem exata):
  1. Hero (primeira seção) — headline forte, subheadline, CTA principal, imagem hero do concorrente
  2. O que você vai receber — lista de benefícios/módulos com ícones
  3. Bônus Exclusivos — grid de bônus com valores riscados
  4. Depoimentos — cards com foto, nome, cidade e resultado
  5. Oferta — preço âncora, preço real, botão CTA grande
  6. Garantia — selo de 7 dias, texto de confiança
  7. Dúvidas Frequentes — accordion com 5+ perguntas
  8. Rodapé — links, disclaimer, copyright
- O prompt deve incluir as URLs de imagens reais para que o Lovable as use diretamente
- Copy em português BR, tom informal/emocional (padrão low ticket)
- NÃO incluir preços ou links de checkout — o usuário preenche depois
- O prompt deve ter no mínimo 1000 palavras para ser detalhado o suficiente
- Incluir instruções de design: cores sugeridas, estilo visual, mobile-first, dark mode

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

        const [pageText, pageMedia] = await Promise.all([
          fetchPageText(url),
          fetchPageMedia(url),
        ])

        send({ type: 'progress', text: pageText.length > 100
          ? `\u2705 P\u00e1gina escaneada (${pageText.length} chars)`
          : '\u26A0\uFE0F P\u00e1gina bloqueada \u2014 gerando com dados dos an\u00fancios' })

        send({ type: 'progress', text: '\uD83E\uDDE0 Gerando análise da página...' })

        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const prompt = `URL DO CONCORRENTE: ${url}

RELAT\u00d3RIO FASE 1 (an\u00e1lise dos criativos):
${JSON.stringify(phase1Report, null, 2)}

TEXTO DA P\u00c1GINA DE DESTINO DO CONCORRENTE (primeiros 15000 caracteres):
${pageText || '(p\u00e1gina n\u00e3o acess\u00edvel \u2014 gere o prompt com base nos dados dos an\u00fancios)'}

M\u00cdDIAS REAIS DO CONCORRENTE (inclua estas URLs no prompt gerado):
${pageMedia.ogImage ? `OG Image: ${pageMedia.ogImage}` : ''}
Imagens (${pageMedia.images.length}): ${pageMedia.images.slice(0, 10).join('\n')}
${pageMedia.videos.length > 0 ? `V\u00eddeos (${pageMedia.videos.length}): ${pageMedia.videos.join('\n')}` : 'Nenhum v\u00eddeo encontrado'}

INSTRU\u00c7\u00c3O: O prompt_lovable DEVE referenciar estas URLs de imagens/v\u00eddeos para que o Lovable use as m\u00eddias reais do concorrente na p\u00e1gina gerada.

Gere o prompt pronto para Lovable/Bolt com o funil completo modelado a partir deste concorrente. Retorne o JSON estruturado.`

        let rawText = ''
        // Usar streaming pra manter conexão viva no Hostinger (evita timeout)
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 16000,
          system: SYSTEM_PROMPT_PHASE2,
          messages: [{ role: 'user', content: prompt }],
        })
        let chunkCount = 0
        stream.on('text', (text) => {
          rawText += text
          chunkCount++
          // Mandar keepalive a cada 20 chunks pra não dar timeout
          if (chunkCount % 20 === 0) {
            send({ type: 'progress', text: `Analisando página... (${Math.min(Math.round(rawText.length / 160), 99)}%)` })
          }
        })
        const finalMessage = await stream.finalMessage()
        console.log(`[Phase2] Claude response: ${rawText.length} chars, stop: ${finalMessage.stop_reason}`)
        if (rawText.length < 50) throw new Error(`Resposta muito curta (${rawText.length} chars)`)

        let report: Record<string, unknown>
        try {
          // Try to find the outermost JSON object
          let jsonStr = rawText
          const firstBrace = rawText.indexOf('{')
          const lastBrace = rawText.lastIndexOf('}')
          if (firstBrace >= 0 && lastBrace > firstBrace) {
            jsonStr = rawText.slice(firstBrace, lastBrace + 1)
          }
          report = JSON.parse(jsonStr)
        } catch {
          // If JSON is truncated (stop_reason=max_tokens), try to fix it
          console.error('[Phase2] JSON parse failed, attempting repair. Raw length:', rawText.length)
          try {
            let fixable = rawText.slice(rawText.indexOf('{'))
            // Close any unclosed strings and braces
            const openBraces = (fixable.match(/{/g) || []).length
            const closeBraces = (fixable.match(/}/g) || []).length
            if (openBraces > closeBraces) {
              // Truncate at last complete field, close the JSON
              const lastComma = fixable.lastIndexOf('",')
              if (lastComma > 0) fixable = fixable.slice(0, lastComma + 1)
              for (let i = 0; i < openBraces - closeBraces; i++) fixable += '}'
            }
            report = JSON.parse(fixable)
          } catch {
            console.error('[Phase2] Repair also failed:', rawText.slice(0, 500))
            throw new Error('Claude retornou JSON inválido na Fase 2')
          }
        }

        if (!report.url_analisada) report.url_analisada = url

        send({ type: 'done', report })
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro interno'
        console.error('[Phase2] FATAL:', msg)
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`
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
