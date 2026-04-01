import { NextRequest } from 'next/server'
import { dbGetUserById, dbGetFreeUsage } from '@/lib/db'
import sharp from 'sharp'

const MAX_DIM = 7000

async function resizeIfNeeded(base64: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64, 'base64')
    const meta = await sharp(buffer).metadata()
    if ((meta.width ?? 0) <= MAX_DIM && (meta.height ?? 0) <= MAX_DIM) return base64
    const resized = await sharp(buffer)
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer()
    return resized.toString('base64')
  } catch {
    return base64
  }
}

export const maxDuration = 300

async function extractPageAssets(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!res.ok) return []
    const html = await res.text()
    const urls = new Set<string>()

    // <img src>
    const imgRe = /<img[^>]+src=["']([^"']+)["']/gi
    let m: RegExpExecArray | null
    while ((m = imgRe.exec(html)) !== null) {
      if (m[1].startsWith('http') && !m[1].startsWith('data:')) urls.add(m[1])
    }

    // <video src> e <source src>
    const videoRe = /<(?:video|source)[^>]+src=["']([^"']+)["']/gi
    while ((m = videoRe.exec(html)) !== null) {
      if (m[1].startsWith('http')) urls.add(m[1])
    }

    // background-image: url(...)
    const bgRe = /url\(["']?(https?:[^"')]+)["']?\)/gi
    while ((m = bgRe.exec(html)) !== null) urls.add(m[1])

    // data-src (lazy load)
    const lazyRe = /data-src=["']([^"']+)["']/gi
    while ((m = lazyRe.exec(html)) !== null) {
      if (m[1].startsWith('http')) urls.add(m[1])
    }

    return Array.from(urls).slice(0, 60)
  } catch {
    return []
  }
}

async function capturePageScreenshots(url: string): Promise<string[]> {
  const accessKey = process.env.SCREENSHOTONE_API_KEY
  if (!accessKey) {
    console.warn('[Phase2] SCREENSHOTONE_API_KEY não configurada')
    return []
  }

  const base = 'https://api.screenshotone.com/take'
  const common = `access_key=${accessKey}&block_ads=true&block_cookie_banners=true&format=jpg&image_quality=75`

  // 2 API calls: full-page desktop + mobile hero
  const [desktopResult, mobileResult] = await Promise.allSettled([
    fetch(`${base}?url=${encodeURIComponent(url)}&${common}&full_page=true&viewport_width=1440`, { signal: AbortSignal.timeout(40000) })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer() })
      .then(b => Buffer.from(b).toString('base64')),
    fetch(`${base}?url=${encodeURIComponent(url)}&${common}&viewport_width=375&viewport_height=812`, { signal: AbortSignal.timeout(30000) })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer() })
      .then(b => Buffer.from(b).toString('base64')),
  ])

  const sections: string[] = []

  // Split full-page desktop into 900px sections with sharp (up to 6 sections)
  if (desktopResult.status === 'fulfilled') {
    try {
      const fullBuf = Buffer.from(desktopResult.value, 'base64')
      const meta = await sharp(fullBuf).metadata()
      const W = meta.width ?? 1440
      const H = meta.height ?? 0
      if (H > 0) {
        const secH = 900
        const overlap = 100
        let y = 0
        let count = 0
        while (y < H && count < 6) {
          const h = Math.min(secH, H - y)
          const sec = await sharp(fullBuf)
            .extract({ left: 0, top: y, width: W, height: h })
            .jpeg({ quality: 70 })
            .toBuffer()
          sections.push(sec.toString('base64'))
          y += secH - overlap
          count++
        }
        console.log(`[Phase2] Desktop ${W}x${H}px → ${count} seções`)
      }
    } catch (e) {
      console.warn('[Phase2] Falhou split de seções, usando full resized:', (e as Error).message)
      const resized = await resizeIfNeeded(desktopResult.value)
      sections.push(resized)
    }
  } else {
    console.warn('[Phase2] Desktop screenshot falhou:', (desktopResult as PromiseRejectedResult).reason)
  }

  // Add mobile screenshot
  if (mobileResult.status === 'fulfilled') {
    const resized = await resizeIfNeeded(mobileResult.value)
    sections.push(resized)
  } else {
    console.warn('[Phase2] Mobile screenshot falhou:', (mobileResult as PromiseRejectedResult).reason)
  }

  console.log(`[Phase2] Total seções para Claude: ${sections.length}`)
  return sections
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
  "assets_classificados": [
    {
      "url": "https://...",
      "tipo": "mockup_produto | foto_perfil_expert | print_whatsapp | badge_garantia | icone_beneficio | foto_background | video_vsl | video_depoimento | logo | outro",
      "descricao": "Mockup do ebook em perspectiva 3D com capa roxa",
      "contexto_visual": "Aparece no Hero, lado direito, tamanho grande — elemento principal de desejo",
      "onde_replicar": "Hero section — posição exata do mockup do produto",
      "prioridade": "alta | média | baixa",
      "justificativa_posicao": "É o principal elemento visual da oferta, deve ficar no mesmo lugar no funil gerado"
    }
  ],
  "pontos_fracos": [
    { "rank": 1, "problema": "...", "impacto": "alto | médio | baixo", "como_corrigir": "..." }
  ],
  "elementos_que_funcionam": ["elemento 1", "elemento 2"],
  "instrucoes_para_fase3": {
    "preservar": ["o que manter"],
    "corrigir": ["o que corrigir"],
    "adicionar": ["o que adicionar"]
  }
}

━━━ EXTRAÇÃO E CLASSIFICAÇÃO DE ASSETS ━━━
Analise as screenshots e o HTML visível para identificar TODOS os assets reais da página.
Para cada imagem e vídeo encontrado, classifique usando os tipos:
- mockup_produto → produto físico ou digital renderizado (ebook 3D, caixa, mockup de celular)
- foto_perfil_expert → foto de rosto/busto do criador/expert
- print_whatsapp → captura de tela de conversa do WhatsApp ou Telegram
- badge_garantia → selos de garantia, certificados, ícones de segurança
- icone_beneficio → ícones pequenos usados em listas de benefícios
- foto_background → imagem de fundo de seção
- video_vsl → vídeo de vendas principal (player grande no topo)
- video_depoimento → vídeo de depoimento de cliente
- logo → logotipo da marca
- outro → qualquer coisa que não se encaixe acima

Regras de prioridade:
- alta: mockup_produto, video_vsl, foto_perfil_expert, badge_garantia
- média: print_whatsapp, video_depoimento, logo
- baixa: icone_beneficio, foto_background, outro`

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

        send({ type: 'progress', text: '📸 Capturando screenshots e assets da página...' })

        let screenshots: string[] = []
        let pageAssets: string[] = []

        // Run screenshots + asset extraction in parallel
        const [screenshotsResult, assetsResult] = await Promise.allSettled([
          capturePageScreenshots(url),
          extractPageAssets(url),
        ])

        if (screenshotsResult.status === 'fulfilled') {
          screenshots = screenshotsResult.value
          send({ type: 'progress', text: `✅ ${screenshots.length} screenshots capturados` })
        } else {
          send({ type: 'progress', text: '⚠️ Screenshots falharam — continuando com análise textual' })
        }

        if (assetsResult.status === 'fulfilled') {
          pageAssets = assetsResult.value
          send({ type: 'progress', text: `🖼️ ${pageAssets.length} assets extraídos do HTML` })
        }

        send({ type: 'progress', text: '🧠 Analisando estrutura da página com Claude...' })

        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        const assetsSection = pageAssets.length > 0
          ? `\n\nASSETS REAIS EXTRAÍDOS DO HTML (URLs para reaproveitamento na Fase 3):\n${pageAssets.join('\n')}`
          : ''

        type ContentBlock = { type: string; text?: string; source?: { type: string; media_type: string; data: string } }
        const userContent: ContentBlock[] = [
          {
            type: 'text',
            text: `URL: ${url}

RELATÓRIO FASE 1:
${JSON.stringify(phase1Report, null, 2)}${assetsSection}

Analise a página completa usando as screenshots e a lista de assets reais. Para cada asset identificado, use a URL real da lista acima no campo "url" do JSON.`,
          },
        ]

        // Resize screenshots to stay within Claude's 8000px dimension limit, then send up to 6
        const safeScreenshots = await Promise.all(screenshots.slice(0, 6).map(resizeIfNeeded))
        for (const img of safeScreenshots) {
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
