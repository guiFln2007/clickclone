import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
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

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

// Strategy 1: Replace by <!-- cc:X --> section markers (reliable for new pages)
function applySectionReplacements(html: string, fullText: string): { result: string; applied: number } {
  const sectionRegex = /<CC_SECTION\s+id="([^"]+)">([\s\S]*?)<\/CC_SECTION>/g
  let result = html
  let applied = 0
  let match

  while ((match = sectionRegex.exec(fullText)) !== null) {
    const id = match[1]
    const newHtml = match[2].trim()
    const commentPattern = new RegExp(`<!-- cc:${id} -->[\\s\\S]*?<!-- /cc:${id} -->`)
    if (commentPattern.test(result)) {
      result = result.replace(
        new RegExp(`<!-- cc:${id} -->[\\s\\S]*?<!-- /cc:${id} -->`),
        `<!-- cc:${id} -->\n${newHtml}\n<!-- /cc:${id} -->`
      )
      applied++
      console.log(`[Section] Substituiu seção cc:${id}`)
    } else {
      console.log(`[Section] Marcador cc:${id} não encontrado na página`)
    }
  }

  return { result, applied }
}

// Strategy 2: Text-based CC_PATCH (fallback for pages without cc markers)
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
      console.log('[Patch] Aplicado via busca exata')
      continue
    }

    const oldTrimmed = oldStr.trim()
    const idx = result.indexOf(oldTrimmed)
    if (idx !== -1) {
      result = result.slice(0, idx) + newStr.trim() + result.slice(idx + oldTrimmed.length)
      applied++
      console.log('[Patch] Aplicado via busca trimmed')
      continue
    }

    const oldNorm = normalizeWhitespace(oldStr)
    const resultNorm = normalizeWhitespace(result)
    const normIdx = resultNorm.indexOf(oldNorm)
    if (normIdx !== -1 && oldNorm.length > 20) {
      const anchor1 = oldStr.slice(0, 40).trim()
      const anchor2 = oldStr.slice(-40).trim()
      const start = anchor1.length > 10 ? result.indexOf(anchor1) : -1
      const end = anchor2.length > 10 ? result.lastIndexOf(anchor2) : -1
      if (start !== -1 && end !== -1 && end > start) {
        result = result.slice(0, start) + newStr + result.slice(end + anchor2.length)
        applied++
        console.log('[Patch] Aplicado via fuzzy (âncoras)')
        continue
      }
    }

    console.log('[Patch] FALHOU para trecho:', oldStr.slice(0, 80))
  }
  return { result, applied }
}

// Detect if message is a simple edit (text/color/price) → use Haiku (7x cheaper)
function isSimpleEdit(message: string): boolean {
  const lower = message.toLowerCase()
  const simplePatterns = [
    /^(muda|mude|mudar|troca|troque|trocar|altera|altere|alterar|coloca|coloque)\s/,
    /\b(cor|cores|preço|preco|texto|título|titulo|headline|botão|botao|fundo|background)\b/,
    /\b(fonte|tamanho|bold|negrito|itálico|italico|maiúsculo|minúsculo)\b/,
    /r\$\s*[\d,]+/,
  ]
  const wordCount = message.trim().split(/\s+/).length
  return wordCount <= 20 && simplePatterns.some(p => p.test(lower))
}

const SYSTEM_PROMPT = `REGRA NÚMERO 1 — INVIOLÁVEL: Você JAMAIS escreve HTML, CSS ou JavaScript fora dos blocos CC_SECTION, CC_PATCH ou CC_HTML. Zero exceções. Se a edição for pequena, use CC_SECTION ou CC_PATCH. Se for rebuild, use CC_HTML. Se você escrever uma única tag HTML fora desses blocos, a edição quebra e o usuário vê código bruto no chat. Isso destrói a experiência. Nunca faça isso.

Editor de páginas de vendas HTML brasileiro. Copywriter sênior + dev front-end — cirúrgico e direto.

FORMATO PRINCIPAL — CC_SECTION (use SEMPRE que a seção tiver marcador cc:):
Substitui uma seção inteira pelo seu ID de marcador.

[1 frase explicando a mudança]
<CC_SECTION id="[id]">
<!-- cc:[id] -->
[HTML completo e atualizado da seção]
<!-- /cc:[id] -->
</CC_SECTION>

IDs disponíveis: announce · hero · benefits · testimonials · guarantee · faq · cta-final

FORMATO FALLBACK — CC_PATCH (use para edições em <style> ou <script>, ou páginas sem marcadores cc:):
<CC_PATCH>
<<<OLD>>>
[trecho MÍNIMO e ÚNICO — no máximo 2 linhas, sem alterar whitespace]
<<<NEW>>>
[trecho substituído]
<<<END>>>
</CC_PATCH>

FORMATO REDESIGN — CC_HTML (use SOMENTE quando pedido explicitamente):
[1 frase]
<CC_HTML>
[HTML completo da página]
</CC_HTML>

REGRAS:
- CC_SECTION > CC_PATCH > CC_HTML — use sempre o mais cirúrgico possível
- Dentro do CC_SECTION, mantenha os comentários <!-- cc:X --> e <!-- /cc:X -->
- Copy: específico ("perca 4kg em 21 dias"), "você", direto
- Preserve __B64_N__ intactos (placeholders de imagens base64)
- Preserve todos os IDs, classes, data-attributes e scripts existentes
- Sem markdown no HTML
- Máximo de 1 CC_SECTION por resposta (salvo se o usuário pedir várias mudanças)`

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

    // Tell Claude which editing strategy to use based on page type
    const hasCcMarkers = strippedHtml.includes('<!-- cc:')
    const markerHint = hasCcMarkers
      ? 'Esta página tem marcadores CC — use SEMPRE CC_SECTION identificando o marcador correto.'
      : 'Esta página não tem marcadores CC — use CC_PATCH com trechos mínimos e únicos (máx 2 linhas).'

    const contextLine = `CONTEXTO: ${analysis?.page_name || 'Página de vendas'} | Score: ${analysis?.score || '?'}/10 | Ângulo: ${analysis?.dominant_angle || ''} | ${markerHint}`

    const historyText = (history as Array<{ role: string; content: unknown }>)
      .slice(-8)
      .map((m) => {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        return `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${content.slice(0, 300)}`
      })
      .join('\n')

    const prompt = [
      contextLine,
      historyText ? `Histórico:\n${historyText}` : '',
      `HTML:\n<CC_HTML>\n${strippedHtml}\n</CC_HTML>`,
      `Edição: ${message}`,
    ].filter(Boolean).join('\n\n')

    // Use Haiku for simple text/color/price edits (7x cheaper), Sonnet for structural
    const model = isSimpleEdit(message) ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6'
    console.log(`[Edit] Modelo: ${model} | Simple: ${isSimpleEdit(message)} | CC markers: ${hasCcMarkers}`)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullText = ''

          const sdkStream = anthropic.messages.stream({
            model,
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: prompt }],
          })

          let ccBlockFound = false

          for await (const event of sdkStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const text = event.delta.text
              fullText += text

              // Only stream text that comes BEFORE any CC block — stop as soon as HTML starts
              if (!ccBlockFound) {
                const ccIdx = fullText.search(/<CC_SECTION|<CC_PATCH>|<CC_HTML>/)
                if (ccIdx === -1) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'text', chunk: text })}\n\n`),
                  )
                } else {
                  ccBlockFound = true
                  // Send only the part of this chunk that's still before the CC block
                  const alreadySent = fullText.length - text.length
                  const safeEnd = ccIdx - alreadySent
                  if (safeEnd > 0) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'text', chunk: text.slice(0, safeEnd) })}\n\n`),
                    )
                  }
                }
              }
            }
          }

          if (!fullText) throw new Error('Resposta vazia do modelo')

          const hasSectionReplace = fullText.includes('<CC_SECTION')
          const hasPatch = fullText.includes('<CC_PATCH>')
          const hasFullHtml = fullText.includes('<CC_HTML>')

          let updatedHtml: string
          let reply: string
          let editType = 'patch'

          if (hasSectionReplace) {
            // Strategy 1: section replacement by cc: markers
            const { result: patched, applied } = applySectionReplacements(strippedHtml, fullText)
            if (applied > 0) {
              updatedHtml = restoreBase64Images(patched, b64Map)
              reply = fullText.split('<CC_SECTION')[0].trim() || 'Feito!'
              editType = 'patch'
            } else if (hasPatch) {
              // Fallback to CC_PATCH if section not found
              const { result: patched2, applied: applied2 } = applyPatches(strippedHtml, fullText)
              updatedHtml = restoreBase64Images(applied2 > 0 ? patched2 : strippedHtml, b64Map)
              reply = applied2 > 0 ? (fullText.split('<CC_PATCH>')[0].trim() || 'Feito!') : '⚠️ Não encontrei a seção para editar. Tente redescrever ou peça um redesign.'
              editType = applied2 > 0 ? 'patch' : 'none'
            } else {
              updatedHtml = restoreBase64Images(strippedHtml, b64Map)
              reply = '⚠️ Não encontrei o marcador da seção na página. Tente pedir um redesign completo.'
              editType = 'none'
            }
          } else if (hasPatch) {
            // Strategy 2: text-based patch
            const { result: patched, applied } = applyPatches(strippedHtml, fullText)
            updatedHtml = restoreBase64Images(applied > 0 ? patched : strippedHtml, b64Map)
            reply = fullText.split('<CC_PATCH>')[0].trim() || 'Feito!'
            editType = applied > 0 ? 'patch' : 'none'
            if (applied === 0) reply = '⚠️ Não consegui localizar o trecho. Tente descrever diferente ou peça um redesign completo.'
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

          // Decrement credits after successful edit
          const actualCost = editType === 'full' ? Math.max(cost, 3) : editType === 'patch' ? cost : 0
          if (editType !== 'none') {
            if (userId) {
              await dbDecrementCreditosN(userId, actualCost)
            } else {
              await dbIncrementFreeCreditos(ip, sessionId)
            }
          }

          let newCreditos: number | undefined
          if (userId && editType !== 'none') {
            const updatedUser = await dbGetUserById(userId)
            newCreditos = updatedUser?.creditos
          }

          const patchFailed = (hasSectionReplace || hasPatch) && editType === 'none'
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
