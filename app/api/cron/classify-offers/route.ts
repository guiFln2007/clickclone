import { NextRequest, NextResponse } from 'next/server'
import { dbGetUnclassifiedOffers, dbUpdateMinedOfferStatus } from '@/lib/db'

const CRON_SECRET = process.env.CRON_SECRET || ''

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const offers = await dbGetUnclassifiedOffers(10)
  if (offers.length === 0) {
    return NextResponse.json({ ok: true, classified: 0, message: 'Nenhuma oferta pra classificar' })
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Batch classify — manda todas de uma vez pro Claude pra economizar tokens
  const offersList = offers.map((o, i) =>
    `[${i + 1}] "${o.page_name}" | ${o.ad_count} ads | ${o.dias_rodando ?? '?'} dias | landing: ${o.landing_url || 'sem'} | keyword: ${o.keyword_source || '?'}`
  ).join('\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: `Você classifica ofertas de anúncios do Facebook para mineração de low ticket.

Para cada oferta, responda APENAS com um JSON array. Cada item:
- index: número da oferta
- status: "ouro" (boa pra modelar, sem expert forte, produto digital/low ticket) | "descartada" (marca grande, app, serviço, expert forte, loja física)
- nicho: nicho curto (ex: "emagrecimento", "educação", "serralheria", "artesanato", "finanças", "relacionamento", "saúde")
- motivo: 1 frase curta do porquê

Critérios pra "ouro":
- Produto digital (pack, kit, ebook, planilha, moldes, projetos, receitas)
- Sem expert/pessoa famosa identificável no nome da página
- Landing page é site de vendas (não app, não loja física)
- Preço baixo / low ticket

Critérios pra "descartada":
- Nome parece pessoa real (Nome Sobrenome)
- Marca corporativa conhecida
- App / software / SaaS
- Loja física / e-commerce de produto físico
- Serviço presencial

RETORNE APENAS o JSON array, sem texto.`,
    messages: [{ role: 'user', content: `Classifique estas ofertas:\n${offersList}` }],
  })

  const text = response.content.find(b => b.type === 'text')
  const rawText = text?.type === 'text' ? text.text : '[]'

  let classifications: { index: number; status: string; nicho: string; motivo: string }[] = []
  try {
    const match = rawText.match(/\[[\s\S]*\]/)
    classifications = JSON.parse(match ? match[0] : rawText)
  } catch {
    console.error('[Classify] JSON parse failed:', rawText.slice(0, 300))
    return NextResponse.json({ ok: false, error: 'JSON inválido do classificador' })
  }

  let ouro = 0, descartada = 0
  for (const c of classifications) {
    const offer = offers[c.index - 1]
    if (!offer) continue
    const status = c.status === 'ouro' ? 'ouro' : 'descartada'
    await dbUpdateMinedOfferStatus(offer.page_id, status, c.nicho || undefined)
    if (status === 'ouro') ouro++
    else descartada++
    console.log(`[Classify] ${offer.page_name}: ${status} (${c.nicho}) — ${c.motivo}`)
  }

  return NextResponse.json({ ok: true, classified: classifications.length, ouro, descartada })
}
