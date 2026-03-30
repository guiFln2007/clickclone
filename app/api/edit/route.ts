import { NextRequest } from 'next/server'
import {
  dbGetUserById,
  dbDecrementCreditosN,
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

const SYSTEM_PROMPT = `Editor de páginas de vendas HTML brasileiro. Copywriter sênior + dev front-end — cirúrgico e direto.

EDIÇÃO SIMPLES (texto, cor, preço, elemento, seção):
Use CC_PATCH — retorna só o trecho alterado.

[1 frase]
<CC_PATCH>
<<<OLD>>>
[HTML exato do original]
<<<NEW>>>
[HTML novo]
<<<END>>>
</CC_PATCH>

Múltiplos CC_PATCH se necessário.

EDIÇÃO ESTRUTURAL (seção nova, redesign):
Use CC_HTML — retorna HTML completo.

[1 frase]
<CC_HTML>
[HTML completo]
</CC_HTML>

REGRAS:
- Copy: específico ("perca 4kg em 21 dias"), "você", direto
- Preserve __B64_N__ intactos (imagens)
- Preserve IDs, classes e scripts
- Sem markdown no HTML`

export async function POST(req: NextRequest) {
  try {
    const userIdHeader = req.headers.get('x-user-id')
    const userId = userIdHeader ? Number(userIdHeader) : null

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    const sessionId = req.headers.get('x-session-id') || 'anonymous'

    const { html, message, analysis, history = [], estimatedCost } = await req.json()
    const cost = typeof estimatedCost === 'number' ? estimatedCost : 1

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
          error: 'Créditos esgotados. Compre mais créditos para continuar.',
          upgrade: true,
          creditos: 0,
        }, { status: 402 })
      }
      if (user.creditos < cost) {
        return Response.json({
          error: `Créditos insuficientes. Esta edição custa ${cost} créditos, mas você tem ${user.creditos}.`,
          upgrade: true,
          creditos: user.creditos,
        }, { status: 402 })
      }
    }

    const encoder = new TextEncoder()
    const { stripped: strippedHtml, map: b64Map } = stripBase64Images(html)

    const contextLine = `CONTEXTO: ${analysis?.page_name || 'Página de vendas'} | Score: ${analysis?.score || '?'}/10 | Ângulo: ${analysis?.dominant_angle || ''}`

    const historyText = (history as Array<{ role: string; content: unknown }>)
      .slice(-12)
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

          const Anthropic = (await import('@anthropic-ai/sdk')).default
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
          const stream = await client.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: prompt }],
          })
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta' &&
              event.delta.text
            ) {
              fullText += event.delta.text
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'text', chunk: event.delta.text })}\n\n`),
              )
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
            editType = applied > 0 ? 'patch' : 'none'
            if (applied === 0) reply = '⚠️ Não consegui localizar o trecho para editar. Tente descrever de forma diferente ou peça um redesign completo.'
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

          // Decrementa créditos após edição bem-sucedida (proporcional)
          const actualCost = editType === 'full' ? Math.max(cost, 3) : editType === 'patch' ? cost : 0
          if (editType !== 'none') {
            if (userId) {
              await dbDecrementCreditosN(userId, actualCost)
            } else {
              await dbIncrementFreeCreditos(ip, sessionId)
            }
          }

          // Fetch new credit balance
          let newCreditos: number | undefined
          if (userId && editType !== 'none') {
            const updatedUser = await dbGetUserById(userId)
            newCreditos = updatedUser?.creditos
          }

          const patchFailed = hasPatch && editType === 'none'
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done', html: updatedHtml, message: reply, editType, creditosGastos: actualCost, creditos: newCreditos, ...(patchFailed ? { patchFailed: true } : {}) })}\n\n`,
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
