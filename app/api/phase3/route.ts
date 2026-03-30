import { NextRequest } from 'next/server'
import { dbGetUserById, dbDecrementCreditosN, dbGetFreeUsage, dbIncrementFreeCreditos } from '@/lib/db'

export const maxDuration = 300

function computeCredits(inputTokens: number, outputTokens: number): number {
  // Claude Opus pricing: $5/1M input, $25/1M output → ~$0.005 input, $0.025 output per 1k
  const costUSD = (inputTokens / 1000 * 0.005) + (outputTokens / 1000 * 0.025)
  return Math.max(5, Math.ceil(costUSD / 0.01))
}

const SYSTEM_PROMPT_PHASE3 = `Você é um especialista em funis de alta conversão para o mercado brasileiro de infoprodutos low ticket. Sua missão é gerar um funil completo em HTML single-file que seja SUPERIOR ao original analisado.

RETORNE APENAS HTML VÁLIDO — sem explicações, sem markdown, sem blocos de código. Comece com <!DOCTYPE html>.

━━━ REGRAS ABSOLUTAS ━━━
1. HTML completo e funcional — inline CSS + JavaScript no mesmo arquivo
2. Todos os elementos interativos funcionando (quiz JS, inputs com simulação, countdown)
3. Design SUPERIOR ao original — mais moderno, mais animado, mais impactante
4. Copy baseado no relatório da análise — não invente nada genérico
5. Responsivo: overflow-x:hidden; grids com auto-fit/minmax ou 1fr em mobile; padding ≤16px mobile
6. ZERO IntersectionObserver — todo conteúdo visível no load

━━━ MARCADORES OBRIGATÓRIOS ━━━
Adicione <!-- cc:X --> e <!-- /cc:X --> em CADA seção principal (hero, benefits, testimonials, pricing, faq, etc.)
Adicione data-component="nome-da-seção" em cada section/div de seção principal
Estes marcadores permitem edição cirúrgica no editor visual.
Exemplo:
<!-- cc:hero -->
<section data-component="hero" class="hero">...</section>
<!-- /cc:hero -->

━━━ PALETA E DESIGN ━━━
Use variáveis CSS no :root. Baseie-se na paleta_dominante e tom_visual do relatório de análise.
Aplique: animações CSS (pulse no CTA, hover:transform nos cards, gradiente animado), transições suaves.

━━━ ESTRUTURA POR TIPO DE FUNIL ━━━

PÁGINA DE VENDAS:
[0] Announce bar sticky
[1] Hero: headline PAS + sub + CTA acima do fold (min-height:100vh)
[2] Problema/Agitação: 3-4 dores do nicho com emojis
[3] Solução: como o produto resolve
[4] Benefícios: grid de cards com ícones SVG inline
[5] Prova social: 4 depoimentos reais ou ultra-realistas
[6] Quem é o expert: credenciais + foto placeholder
[7] O que está incluído: lista do conteúdo
[8] Bônus: grid com valores riscados
[9] Pricing: âncora riscado → preço real, botão CTA
[10] Garantia: 7-30 dias, explicação
[11] FAQ: 5-7 perguntas, accordion CSS puro
[12] CTA final: urgência + botão

QUIZ FUNNEL:
[0] Intro page com CTA "Começar quiz"
[1-5] 5 perguntas com opções clicáveis (JS nextStep)
[6] Loading: "Analisando..." spinner 2s
[7] Resultado bloqueado: blur(8px) + overlay + CTA compra

VSL (Video Sales Letter):
[0] Announce bar sticky
[1] Hero: headline curiosidade + player de vídeo grande (placeholder funcional)
[2] Transcrição parcial bloqueada: texto visível + blur + CTA
[3] Prova social abaixo do player
[4] Pricing
[5] Garantia + FAQ

FERRAMENTA FREEMIUM:
[0] Navbar com logo e botão upgrade
[1] Hero: H1 + input principal + CTA analisar
[2] Demo interativa: input funcional com simulação JS
[3] Features grid (grátis vs pro)
[4] Depoimentos
[5] Pricing: plano grátis vs pro lado a lado
[6] FAQ

TYPEBOT/WHATSAPP:
[0] Hero com botão WhatsApp verde (#25D366) + ícone SVG
[1] Como funciona: 3 passos
[2] Depoimentos
[3] CTA final + botão WhatsApp sticky mobile

━━━ JAVASCRIPT OBRIGATÓRIO SE APLICÁVEL ━━━
- Quiz: currentStep=0; nextStep() mostra próxima pergunta; armazena respostas
- Demo ferramenta: captura input → spinner 1.5s → exibe resultado verossímil personalizado
- Countdown: 24h a partir do load (se urgência detectada no original)
- Accordion FAQ: apenas CSS (input[type=checkbox] + label), sem JS
- Scroll suave: document.querySelectorAll('[href^="#"]') → behavior:'smooth'

━━━ QUALIDADE FINAL ━━━
Antes de fechar </html>, verifique:
□ Mecanismo central presente e funcional
□ Preço real aparece na página
□ CTA principal aparece ≥3 vezes
□ Marcadores <!-- cc:X --> em todas as seções
□ data-component em todos os containers de seção
□ Animações CSS no CTA e nos cards
□ ≥8 seções completas com conteúdo real
□ Responsivo: mobile-first, sem scroll horizontal`

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

        // Auth / quota check
        if (!userId) {
          const freeUsage = await dbGetFreeUsage(ip, sessionId)
          if ((freeUsage?.creditos_usados ?? 0) >= 5) {
            send({ type: 'error', message: 'Créditos gratuitos esgotados.', upgrade: true })
            controller.close(); return
          }
        } else {
          const user = await dbGetUserById(userId)
          if (!user || !user.ativo) {
            send({ type: 'error', message: 'Conta inativa.' })
            controller.close(); return
          }
          if (user.creditos <= 0) {
            send({ type: 'error', message: 'Créditos esgotados. Compre mais créditos para continuar.', upgrade: true, creditos: 0 })
            controller.close(); return
          }
        }

        const { phase1Report, phase2Report, screenshots } = await req.json()
        if (!phase1Report || !phase2Report) throw new Error('Relatórios das fases 1 e 2 são obrigatórios')

        send({ type: 'progress', text: '🚀 Iniciando geração do funil com Claude Opus...' })

        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        // Build user content
        type ContentBlock = { type: string; text?: string; source?: { type: string; media_type: string; data: string } }
        const userContent: ContentBlock[] = [
          {
            type: 'text',
            text: `━━━ RELATÓRIO FASE 1 — ANÁLISE DOS ANÚNCIOS ━━━
${JSON.stringify(phase1Report, null, 2)}

━━━ RELATÓRIO FASE 2 — ANÁLISE DA PÁGINA ━━━
${JSON.stringify(phase2Report, null, 2)}

━━━ INSTRUÇÕES ESPECÍFICAS (da análise) ━━━
PRESERVAR: ${JSON.stringify(phase2Report.instrucoes_para_fase3?.preservar ?? [])}
CORRIGIR: ${JSON.stringify(phase2Report.instrucoes_para_fase3?.corrigir ?? [])}
ADICIONAR: ${JSON.stringify(phase2Report.instrucoes_para_fase3?.adicionar ?? [])}

Tipo de funil: ${phase2Report.tipo_de_funil ?? 'página de vendas'}
Ângulo dominante dos anúncios: ${phase1Report.angulo_dominante ?? ''}
Promessa central: ${phase2Report.analise_de_copy?.promessa_central ?? ''}
Linguagem: ${phase2Report.analise_de_copy?.linguagem ?? 'informal'}
Tom visual: ${phase2Report.analise_de_design?.tom_visual ?? 'urgente'}
Paleta: ${JSON.stringify(phase2Report.analise_de_design?.paleta_dominante ?? [])}

Gere agora o HTML completo do funil melhorado. Comece com <!DOCTYPE html>.`,
          }
        ]

        // Add screenshots for visual reference (max 2)
        if (screenshots && Array.isArray(screenshots)) {
          for (const img of screenshots.slice(0, 2)) {
            if (typeof img === 'string' && img.length < 1400000) {
              userContent.push({
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: img },
              })
            }
          }
        }

        send({ type: 'progress', text: '⚙️ Claude Opus processando o funil...' })

        // Stream the HTML generation
        const sdkStream = client.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: 32000,
          system: SYSTEM_PROMPT_PHASE3,
          messages: [{ role: 'user', content: userContent as Parameters<typeof client.messages.create>[0]['messages'][0]['content'] }],
        })

        let fullText = ''
        let chunkCount = 0

        for await (const event of sdkStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text
            chunkCount++
            // Send progress updates periodically
            if (chunkCount % 100 === 0) {
              const approxKb = Math.round(fullText.length / 1024)
              send({ type: 'progress', text: `⚙️ Gerando funil... ${approxKb}KB` })
            }
          }
        }

        const finalMsg = await sdkStream.finalMessage()
        const inputTokens = finalMsg.usage.input_tokens
        const outputTokens = finalMsg.usage.output_tokens

        if (!fullText || !fullText.includes('<html')) {
          throw new Error('Claude não retornou HTML válido na Fase 3')
        }

        // Extract HTML — strip any markdown code fences if present
        let html = fullText
        const htmlMatch = fullText.match(/<!DOCTYPE html[\s\S]*<\/html>/i)
        if (htmlMatch) html = htmlMatch[0]

        // Compute and deduct credits
        const creditsCost = computeCredits(inputTokens, outputTokens)

        if (userId) {
          await dbDecrementCreditosN(userId, creditsCost)
        } else {
          await dbIncrementFreeCreditos(ip, sessionId)
        }

        let newCreditos: number | undefined
        if (userId) {
          const updatedUser = await dbGetUserById(userId)
          newCreditos = updatedUser?.creditos
        }

        send({
          type: 'done',
          html,
          creditosGastos: creditsCost,
          creditos: newCreditos,
          improvements_applied: phase2Report.instrucoes_para_fase3?.corrigir ?? [],
        })
        controller.close()
      } catch (err) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : 'Erro interno na Fase 3' })}\n\n`
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
