import { NextRequest } from 'next/server'
import { query } from '@anthropic-ai/claude-agent-sdk'
import {
  dbGetUserById,
  dbDecrementCreditos,
  dbGetFreeUsage,
  dbIncrementFreeCreditos,
} from '@/lib/db'

export const maxDuration = 300

function stripBase64Images(html: string): { stripped: string; map: Record<string, string> } {
  const map: Record<string, string> = {}
  let i = 0
  const stripped = html.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, (match) => {
    const key = `__B64_${i++}__`
    map[key] = match
    return key
  })
  return { stripped, map }
}

function restoreBase64Images(html: string, map: Record<string, string>): string {
  let result = html
  for (const [key, value] of Object.entries(map)) {
    result = result.replaceAll(key, value)
  }
  return result
}

function applyPatches(html: string, fullText: string): { result: string; applied: number } {
  const patchRegex = /<CC_PATCH>([\s\S]*?)<\/CC_PATCH>/g
  let result = html
  let applied = 0
  let match
  while ((match = patchRegex.exec(fullText)) !== null) {
    const content = match[1]
    const oldMatch = content.match(/<<<OLD>>>([\s\S]*?)<<<NEW>>>/)
    const newMatch = content.match(/<<<NEW>>>([\s\S]*?)<<<END>>>/)
    if (!oldMatch || !newMatch) continue
    const oldStr = oldMatch[1].replace(/^\n/, '').replace(/\n$/, '')
    const newStr = newMatch[1].replace(/^\n/, '').replace(/\n$/, '')
    if (result.includes(oldStr)) {
      result = result.replace(oldStr, newStr)
      applied++
    } else {
      const oldTrimmed = oldStr.trim()
      const idx = result.indexOf(oldTrimmed)
      if (idx !== -1) {
        result = result.slice(0, idx) + newStr.trim() + result.slice(idx + oldTrimmed.length)
        applied++
      }
    }
  }
  return { result, applied }
}

const SYSTEM_PROMPT = `Você é o melhor editor de páginas de vendas HTML do Brasil. Age como um copywriter sênior + dev front-end — cirúrgico, rápido, opinionado.

━━━ COMO RESPONDER ━━━

Para QUALQUER edição, escolha o formato correto:

▸ EDIÇÃO SIMPLES (texto, cor, preço, um elemento, copy de uma seção):
Use CC_PATCH — retorna APENAS o trecho alterado. MUITO mais rápido.

[mensagem em 1 frase]
<CC_PATCH>
<<<OLD>>>
[trecho HTML EXATO copiado literalmente do HTML recebido — mínimo necessário]
<<<NEW>>>
[trecho HTML novo]
<<<END>>>
</CC_PATCH>

Pode usar múltiplos <CC_PATCH> se precisar mudar mais de um lugar.

▸ EDIÇÃO ESTRUTURAL (adicionar/remover seção inteira, redesign completo):
Use CC_HTML — retorna o HTML completo.

[mensagem em 1 frase]
<CC_HTML>
[HTML completo]
</CC_HTML>

━━━ REGRAS DE QUALIDADE ━━━

COPY:
- Seja ultra-específico: "perca 4kg em 21 dias" não "emagreça rápido"
- Headlines: curtas, impactantes, com palavra de poder
- Bullets: resultado + prazo/contexto em cada um
- Tom: direto, caloroso, sem enrolação — como um amigo especialista
- Sempre "você" — nunca "tu" ou "pessoal"

TÉCNICO:
- Preserve TODOS os __B64_N__ (são imagens, não altere)
- Preserve IDs, classes e scripts do original
- CSS inline quando necessário
- Sem markdown ou comentários no HTML

QUANDO PEDIREM:
- "muda headline/título" → reescreve com copy mais forte, mantém tag HTML
- "troca cor" → atualiza todas as ocorrências relevantes (background, border, color)
- "melhora copy" → reescreve mais específico, mais emocional, mais direto
- "adiciona urgência" → insere countdown ou aviso de escassez com copy real
- "deixa mais impactante" → reescreve headline + subheadline + CTA com linguagem de conversão
- "adiciona depoimento" → insere card com o mesmo estilo dos existentes
- "muda preço" → atualiza todos os preços visíveis na página`

export async function POST(req: NextRequest) {
  try {
    const userIdHeader = req.headers.get('x-user-id')
    const userId = userIdHeader ? Number(userIdHeader) : null

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    const sessionId = req.headers.get('x-session-id') || 'anonymous'

    if (!userId) {
      const freeUsage = await dbGetFreeUsage(ip, sessionId)
      if ((freeUsage?.creditos_usados ?? 0) >= 5) {
        return Response.json({
          error: 'Créditos gratuitos esgotados. Acesse o ClickClone completo com 100 créditos por apenas R$XX.',
          upgrade: true,
        }, { status: 402 })
      }
    } else {
      const user = await dbGetUserById(userId)
      if (!user || !user.ativo) {
        return Response.json({ error: 'Conta inativa ou não encontrada.' }, { status: 403 })
      }
      if (user.creditos <= 0) {
        return Response.json({
          error: 'Créditos esgotados. Faça upgrade para continuar.',
          upgrade: true,
        }, { status: 402 })
      }
    }

    const { html, message, analysis, history = [] } = await req.json()

    const encoder = new TextEncoder()
    const { stripped: strippedHtml, map: b64Map } = stripBase64Images(html)

    const contextLine = `CONTEXTO: ${analysis?.page_name || 'Página de vendas'} | Score: ${analysis?.score || '?'}/10 | Ângulo: ${analysis?.dominant_angle || ''}`

    const historyText = (history as Array<{ role: string; content: unknown }>)
      .slice(-6)
      .map((m) => {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        return `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${content}`
      })
      .join('\n')

    const prompt = [
      contextLine,
      historyText ? `Histórico:\n${historyText}` : '',
      `HTML:\n<CC_HTML>\n${strippedHtml}\n</CC_HTML>`,
      `Edição: ${message}`,
    ].filter(Boolean).join('\n\n')

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullText = ''

          for await (const message of query({
            prompt,
            options: {
              allowedTools: [],
              maxTurns: 1,
              systemPrompt: SYSTEM_PROMPT,
            },
          })) {
            if ('result' in message && typeof (message as { result: string }).result === 'string') {
              const chunkText = (message as { result: string }).result
              if (chunkText) {
                fullText += chunkText
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'text', chunk: chunkText })}\n\n`),
                )
              }
              break
            }
          }

          if (!fullText) throw new Error('Resposta vazia do modelo')

          const hasPatch = fullText.includes('<CC_PATCH>')
          const hasFullHtml = fullText.includes('<CC_HTML>')

          let updatedHtml: string
          let reply: string
          let editType = 'patch'

          if (hasPatch) {
            const { result: patched, applied } = applyPatches(strippedHtml, fullText)
            updatedHtml = restoreBase64Images(applied > 0 ? patched : strippedHtml, b64Map)
            reply = fullText.split('<CC_PATCH>')[0].trim() || 'Feito!'
            editType = 'patch'
          } else if (hasFullHtml) {
            const htmlMatch = fullText.match(/<CC_HTML>([\s\S]*?)<\/CC_HTML>/)
            const rawHtml = htmlMatch ? htmlMatch[1].trim() : strippedHtml
            updatedHtml = restoreBase64Images(rawHtml, b64Map)
            reply = fullText.replace(/<CC_HTML>[\s\S]*?<\/CC_HTML>/, '').trim() || 'Feito!'
            editType = 'full'
          } else {
            updatedHtml = html
            reply = fullText.trim() || 'Feito!'
            editType = 'none'
          }

          // Decrementa crédito após edição bem-sucedida
          if (editType !== 'none') {
            if (userId) {
              await dbDecrementCreditos(userId)
            } else {
              await dbIncrementFreeCreditos(ip, sessionId)
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done', html: updatedHtml, message: reply, editType })}\n\n`,
            ),
          )
          controller.close()
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : 'Erro interno' })}\n\n`,
            ),
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
