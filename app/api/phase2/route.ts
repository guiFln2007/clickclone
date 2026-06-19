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

const SYSTEM_PROMPT_PHASE2 = `Você é um especialista em análise competitiva de funis de vendas no mercado brasileiro de infoprodutos low ticket.

Sua tarefa: baseado na análise dos criativos (Fase 1) e no texto da página do concorrente, faça uma análise completa da estratégia de funil e página de vendas.

Retorne APENAS o JSON abaixo, sem texto antes ou depois:

{
  "url_analisada": "...",
  "tipo_de_funil": "página de vendas | quiz | vsl | freemium | typebot | híbrido",
  "promessa_central": "a promessa principal da oferta em 1-2 frases",
  "estrutura_pagina": "descrição da estrutura da página (seções, ordem, CTAs)",
  "gatilhos_mentais": ["gatilho 1", "gatilho 2", ...],
  "estrategia_preco": "como apresentam o preço (âncora, parcelamento, bônus, etc)",
  "pontos_fortes_pagina": ["ponto forte 1", "ponto forte 2", ...],
  "pontos_fracos_pagina": ["ponto fraco 1", "ponto fraco 2", ...],
  "oportunidades": ["oportunidade que o concorrente não explora 1", "oportunidade 2", ...]
}

REGRAS:
- Analise a página como um estrategista de tráfego pago avaliando um concorrente
- Foque em elementos práticos: headline, sub, CTAs, prova social, garantia, preço, urgência
- gatilhos_mentais: liste todos os gatilhos usados (escassez, autoridade, prova social, reciprocidade, etc)
- pontos_fortes_pagina: o que a página faz bem e vale modelar
- pontos_fracos_pagina: falhas, elementos faltando, copy fraca, mobile quebrado, etc
- oportunidades: ângulos e elementos que o concorrente NÃO usa e você poderia usar

TRATAMENTO DE PÁGINA INACESSÍVEL:
Se o conteúdo da página for "PAGINA_VAZIA_OU_BLOQUEADA" ou "ERRO_AO_ACESSAR_PAGINA":
- Analise baseado APENAS nos dados dos anúncios da Fase 1
- Infira a estratégia de funil pelo ângulo dos criativos`

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
          max_tokens: 8000,
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
          // Strip markdown code fences if present
          let cleaned = rawText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '')
          // Find outermost JSON object
          const firstBrace = cleaned.indexOf('{')
          const lastBrace = cleaned.lastIndexOf('}')
          if (firstBrace >= 0 && lastBrace > firstBrace) {
            cleaned = cleaned.slice(firstBrace, lastBrace + 1)
          }
          report = JSON.parse(cleaned)
        } catch {
          console.error('[Phase2] JSON parse failed, attempting repair. Raw length:', rawText.length, 'stop:', finalMessage.stop_reason)
          try {
            let fixable = rawText.slice(rawText.indexOf('{'))
            // Fix common issues: control chars inside strings
            fixable = fixable.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ')

            // Try parse as-is first (maybe just had leading/trailing junk)
            try { report = JSON.parse(fixable) } catch {
              // Truncated JSON repair: find last cleanly closed field
              // Look for the last complete "key": "value" or "key": [...] pattern
              const lastCleanCut = Math.max(
                fixable.lastIndexOf('",\n'),
                fixable.lastIndexOf('",\r'),
                fixable.lastIndexOf('"\n'),
                fixable.lastIndexOf('"],'),
                fixable.lastIndexOf(']'),
              )
              if (lastCleanCut > fixable.length * 0.3) {
                fixable = fixable.slice(0, lastCleanCut + 1)
              }
              // Close unclosed strings
              const quoteCount = (fixable.match(/(?<!\\)"/g) || []).length
              if (quoteCount % 2 !== 0) fixable += '"'
              // Close unclosed arrays
              const openBrackets = (fixable.match(/\[/g) || []).length
              const closeBrackets = (fixable.match(/\]/g) || []).length
              for (let i = 0; i < openBrackets - closeBrackets; i++) fixable += ']'
              // Close unclosed braces
              const openBraces = (fixable.match(/{/g) || []).length
              const closeBraces = (fixable.match(/}/g) || []).length
              for (let i = 0; i < openBraces - closeBraces; i++) fixable += '}'
              report = JSON.parse(fixable)
            }
          } catch (repairErr) {
            console.error('[Phase2] Repair failed:', (repairErr as Error).message, '| First 500 chars:', rawText.slice(0, 500))
            // Last resort: extract what we can with regex
            const extract = (key: string) => {
              const m = rawText.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))
              return m?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') || ''
            }
            report = {
              url_analisada: url,
              tipo_de_funil: extract('tipo_de_funil') || 'página de vendas',
              promessa_central: extract('promessa_central'),
              prompt_lovable: extract('prompt_lovable'),
              estrutura_funil: [],
              diferenciais_aplicados: [],
              _repaired: true,
            }
            if (!report.prompt_lovable) {
              throw new Error('Claude retornou JSON inválido na Fase 2 — tente novamente')
            }
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
