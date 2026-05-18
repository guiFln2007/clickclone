import { NextRequest, NextResponse } from 'next/server'
import { dbUpsertMinedOffer } from '@/lib/db'

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''
const CRON_SECRET = process.env.CRON_SECRET || ''

const BRAND_BLACKLIST = [
  'infinitepay', 'nubank', 'ifood', 'shopee', 'mercado livre', 'mercadolivre',
  'kwai', 'tiktok', 'claro', 'vivo', 'tim', 'banco inter', 'c6 bank', 'c6bank',
  'picpay', 'stone', 'pagbank', 'pagseguro', 'itau', 'itaú', 'bradesco',
  'santander', 'banco do brasil', 'caixa', 'amazon', 'magazine luiza', 'magalu',
  'americanas', 'casas bahia', 'samsung', 'apple', 'xiaomi', 'motorola',
  'uber', 'rappi', '99', 'didi', 'google', 'meta', 'facebook', 'instagram',
  'hotmart', 'kiwify', 'eduzz', 'monetizze', 'braip', 'perfect pay',
  'shopify', 'wix', 'wordpress', 'canva', 'netflix', 'spotify', 'globo',
  'record', 'sbt', 'band', 'uol', 'terra', 'r7', 'ig',
  'coca-cola', 'coca cola', 'pepsi', 'nestle', 'nestlé', 'unilever',
  'ambev', 'heineken', 'budweiser', 'skol', 'brahma',
  'renner', 'riachuelo', 'c&a', 'zara', 'shein',
  'neon', 'will bank', 'original', 'next', 'digio',
  'cloudflare', 'aws', 'azure', 'hostinger', 'locaweb',
]

const BLOCKED_LANDING_DOMAINS = [
  'instagram.com', 'whatsapp.com', 'wa.me', 'facebook.com', 'fb.com',
  'tiktok.com', 'youtube.com', 'youtu.be', 'twitter.com', 'x.com',
  't.me', 'telegram',
]

// Keywords focadas em low ticket / infoproduto escalado
const MINING_KEYWORDS = [
  // ── Preço / Oferta ──
  'por apenas 10 reais', 'por apenas R$', 'somente R$', 'de R$ por R$',
  'por menos de um café', 'menos de 1 real por dia', 'custa menos que',
  'pack por apenas', 'kit por apenas', 'pdf por apenas',
  'garantia de 7 dias', 'garantia incondicional',
  'bônus exclusivo', 'bônus grátis', 'oferta por tempo limitado',

  // ── Entrega digital (padrão PDF/material) ──
  'acesso imediato ao material', 'envio imediato pelo email',
  'receba no seu email', 'enviamos pro seu email', 'download imediato',
  'material digital completo', 'pdf completo', 'pdf pronto',
  'receba agora mesmo', 'link de acesso imediato',
  'acesso vitalício por apenas', 'seu acesso é vitalício',

  // ── Packs / Quantidades ──
  'mega pack', 'pack completo', 'pack de aulas', 'kit completo', 'kit digital', 'kit pronto',
  '+100 projetos', '+200 projetos', '+300 projetos', '+500 projetos', '+700 projetos', '+1000 projetos',
  '+100 moldes', '+200 moldes', '+300 moldes', '+500 moldes',
  '+100 atividades', '+200 atividades', '+300 atividades', '+500 atividades',
  '+200 receitas', '+300 receitas', '+500 receitas',
  '+100 artes', '+200 artes', '+500 artes',
  'mais de 200', 'mais de 300', 'mais de 500', 'mais de 1000',

  // ── Formato de produto ──
  'apostila completa', 'apostila de', 'apostila digital',
  'planilha pronta', 'planilha de',
  'ebook com', 'ebook revelado',
  'guia completo', 'guia definitivo', 'guia prático',
  'checklist completo', 'manual prático', 'método comprovado',
  'curso completo por', 'minicurso de',

  // ── Emagrecimento ──
  'truque pra emagrecer', 'truque pra secar', 'truque para secar',
  'secar a barriga', 'secar barriga', 'seca barriga', 'desinchar',
  'queimar gordura', 'protocolo emagrecimento', 'receitas pra diabéticos',
  'chá emagrecedor', 'receitas fit', 'marmita fit',

  // ── Renda extra ──
  'renda extra', 'ganhar dinheiro', 'renda online', 'trabalhar de casa',
  'faturar online', 'negócio online', 'vender online',

  // ── Artesanato / Manual ──
  'crochê', 'bordado', 'costura moldes', 'artesanato lucrativo',
  'ponto cruz', 'amigurumi', 'macramê', 'biscuit', 'feltro moldes',

  // ── Construção / Projetos ──
  'serralheria', 'marcenaria', 'churrasqueira',
  'projetos de esquadrias', 'projetos de portões', 'projetos de grades',
  'plantas de casas', 'projetos elétricos',

  // ── Culinária ──
  'receitas lucrativas', 'bolos decorados', 'doces gourmet',
  'receitas da vovó', 'confeitaria', 'salgados gourmet',

  // ── Beleza ──
  'unhas decoradas', 'nail designer', 'design de sobrancelha',
  'extensão de cílios', 'penteados', 'tranças',

  // ── Educação ──
  'atividades pedagógicas', 'planos de aula', 'alfabetização',
  'educação infantil', 'reforço escolar',

  // ── Pets ──
  'adestramento', 'petshop', 'banho e tosa',

  // ── Digital / Social Media ──
  'planner digital', 'artes para canva', 'templates canva',
  'artes editáveis', 'social media pack',

  // ── Relacionamento ──
  'reconquistar meu ex', 'fazer ele voltar', 'mensagem pra ex',
  'como conquistar homem', 'como conquistar mulher',
  'salvar meu casamento', 'crise no relacionamento', 'frases de conquista',

  // ── Esotérico / Espiritual ──
  'simpatias', 'orações poderosas', 'mapa astral',

  // ── Saúde geral ──
  'receitas saudáveis', 'protocolo saúde',
]

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export const maxDuration = 300

export async function POST(req: NextRequest) {
  // Auth
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!SCRAPER_URL) {
    return NextResponse.json({ error: 'SCRAPER_URL not configured' }, { status: 500 })
  }

  // Pick a random subset of keywords to mine this run (10 at a time — resource blocking makes it fast)
  const shuffled = [...MINING_KEYWORDS].sort(() => Math.random() - 0.5)
  const batch = shuffled.slice(0, 10)

  const results: { keyword: string; found: number; saved: number; error?: string }[] = []

  for (const keyword of batch) {
    try {
      console.log(`[AutoMine] Starting: "${keyword}"`)

      // Start scraper job
      const startRes = await fetch(`${SCRAPER_URL}/mine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
        body: JSON.stringify({ keyword, count: 300 }),
        signal: AbortSignal.timeout(10000),
      })

      if (!startRes.ok) {
        results.push({ keyword, found: 0, saved: 0, error: `Scraper HTTP ${startRes.status}` })
        continue
      }

      const { jobId } = await startRes.json() as { jobId: string }
      if (!jobId) {
        results.push({ keyword, found: 0, saved: 0, error: 'No jobId' })
        continue
      }

      // Poll for results
      let done = false
      let pollData: Record<string, unknown> = {}
      for (let attempt = 0; attempt < 60; attempt++) {
        await sleep(5000)
        const pollRes = await fetch(`${SCRAPER_URL}/mine?jobId=${jobId}`, {
          headers: { 'Authorization': `Bearer ${SCRAPER_SECRET}` },
          signal: AbortSignal.timeout(10000),
        })
        pollData = await pollRes.json() as Record<string, unknown>
        if (pollData.status === 'done') { done = true; break }
        if (pollData.status === 'failed') break
      }

      if (!done) {
        results.push({ keyword, found: 0, saved: 0, error: pollData.error as string || 'Timeout' })
        continue
      }

      const rawResults = (pollData.results || []) as Array<{
        pagina_nome: string
        page_id: string
        total_anuncios: number
        dias_rodando: number | null
        landing_url: string | null
      }>

      let saved = 0
      for (const p of rawResults) {
        // Apply filters
        if (p.total_anuncios < 10 || p.total_anuncios > 140) continue
        if (p.dias_rodando !== null && p.dias_rodando < 5) continue

        const nameLower = p.pagina_nome.toLowerCase()
        if (BRAND_BLACKLIST.some(b => nameLower.includes(b))) continue
        if (nameLower.endsWith(' oficial') || nameLower.endsWith(' brasil') || nameLower.includes('®') || nameLower.includes('™')) continue

        const url = (p.landing_url || '').toLowerCase()
        if (!url) continue
        if (BLOCKED_LANDING_DOMAINS.some(d => url.includes(d))) continue
        // Filtra App Store / Play Store / apps (só queremos sites de venda reais)
        if (url.includes('apps.apple.com') || url.includes('play.google.com') || url.includes('app.adjust.com') || url.includes('onelink.me') || url.includes('appsflyer.com') || url.includes('.app.link') || url.includes('branch.io')) continue

        const isNumericId = /^\d+$/.test(p.page_id)
        const thumbnailUrl = isNumericId ? `https://graph.facebook.com/${p.page_id}/picture?type=large` : null

        await dbUpsertMinedOffer({
          page_name: p.pagina_nome,
          page_id: p.page_id,
          ad_count: p.total_anuncios,
          landing_url: p.landing_url,
          thumbnail_url: thumbnailUrl,
          nicho: keyword,
          keyword_source: keyword,
          dias_rodando: p.dias_rodando,
        })
        saved++
      }

      console.log(`[AutoMine] "${keyword}": ${rawResults.length} found, ${saved} saved`)
      results.push({ keyword, found: rawResults.length, saved })
    } catch (e) {
      results.push({ keyword, found: 0, saved: 0, error: (e as Error).message })
    }
  }

  return NextResponse.json({ ok: true, batch, results })
}
