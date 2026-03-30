import { NextRequest } from 'next/server'
import { dbGetUserById, dbGetFreeUsage } from '@/lib/db'

export const maxDuration = 300

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function captureScreenshots(url: string): Promise<string[]> {
  const screenshots: string[] = []

  try {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    })

    try {
      // Desktop 1440px
      const page = await browser.newPage()
      await page.setUserAgent(UA)
      await page.setViewport({ width: 1440, height: 900 })
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 })
      await new Promise(r => setTimeout(r, 2000))

      // Scroll to load lazy content
      await page.evaluate(() => {
        return new Promise<void>(resolve => {
          let total = document.body.scrollHeight
          let pos = 0
          const step = () => {
            pos += 600
            window.scrollTo(0, pos)
            if (pos < total) {
              total = document.body.scrollHeight
              setTimeout(step, 150)
            } else {
              window.scrollTo(0, 0)
              resolve()
            }
          }
          step()
        })
      })
      await new Promise(r => setTimeout(r, 1000))

      const desktopShot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 60 })
      screenshots.push(Buffer.from(desktopShot).toString('base64'))

      // Mobile 375px
      await page.setViewport({ width: 375, height: 812 })
      await page.reload({ waitUntil: 'networkidle2', timeout: 20000 })
      await new Promise(r => setTimeout(r, 2000))
      const mobileShot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 60 })
      screenshots.push(Buffer.from(mobileShot).toString('base64'))

      await page.close()
    } finally {
      await browser.close()
    }
  } catch (e) {
    console.warn('[Phase2] Puppeteer falhou:', (e as Error).message)
  }

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
          screenshots = await captureScreenshots(url)
          if (screenshots.length > 0) {
            send({ type: 'progress', text: `✅ ${screenshots.length} screenshots capturados` })
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

        // Add screenshots if available (max 2 to keep tokens reasonable)
        for (const img of screenshots.slice(0, 2)) {
          // Resize check — skip if too large (>1MB base64 ≈ 750KB image)
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
