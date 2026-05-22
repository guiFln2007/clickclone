import { NextRequest, NextResponse } from 'next/server'
import { dbUpsertMinedOffer, dbUpdateMinedOfferStatus } from '@/lib/db'

const SECRET = process.env.SCRAPER_SECRET || ''

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
  'gillette', 'premier league', 'la liga', 'nba', 'nfl', 'fifa', 'brasil paralelo',
  'espaçolaser', 'espacolaser', 'smart fit', 'growth supplements', 'growth suplementos',
  'disney', 'warner', 'paramount', 'hbo', 'marvel', 'dc comics',
  'nike', 'adidas', 'puma', 'reebok', 'new balance',
  'loreal', "l'oréal", 'maybelline', 'avon', 'natura', 'boticário', 'o boticario',
]

const BLOCKED_LANDING_DOMAINS = [
  'instagram.com', 'facebook.com', 'fb.com',
  'tiktok.com', 'youtube.com', 'youtu.be', 'twitter.com', 'x.com',
  't.me', 'telegram', 'itunes.apple.com', 'apps.apple.com', 'play.google.com',
  'app.adjust.com', 'onelink.me', 'bit.ly', 'linktr.ee',
  'workers.dev', 'split-traffic', 'splittraffic', 'cloaker',
]

// POST — Recebe ofertas do scraper auto-mine e salva no Turso
export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (token !== SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { keyword, offers } = await req.json()
  if (!keyword || !Array.isArray(offers)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  let saved = 0
  for (const o of offers) {
    const nameLower = (o.pagina_nome || '').toLowerCase()
    const url = (o.landing_url || '').toLowerCase()

    // Filtros (mesmos da mineração manual)
    if (o.total_anuncios < 5 || o.total_anuncios > 140) continue
    if (BRAND_BLACKLIST.some(brand => nameLower.includes(brand))) continue
    if (nameLower.endsWith(' oficial') || nameLower.includes('® ') || nameLower.includes('™')) continue
    if (o.dias_rodando !== null && o.dias_rodando < 3) continue
    if ((o.fb_followers ?? 0) >= 30000 || (o.ig_followers ?? 0) >= 30000) continue
    if (url && BLOCKED_LANDING_DOMAINS.some(domain => url.includes(domain))) continue

    try {
      await dbUpsertMinedOffer({
        page_name: o.pagina_nome,
        page_id: o.page_id,
        ad_count: o.total_anuncios,
        landing_url: o.landing_url,
        thumbnail_url: `https://graph.facebook.com/${o.page_id}/picture?type=large`,
        nicho: null,
        keyword_source: keyword,
        dias_rodando: o.dias_rodando,
      })
      // Salvar followers se disponível
      if (o.fb_followers || o.ig_followers || o.ig_handle) {
        await dbUpdateMinedOfferStatus(o.page_id, 'ativa', undefined, {
          fb_followers: o.fb_followers ?? null,
          ig_followers: o.ig_followers ?? null,
          ig_handle: o.ig_handle ?? null,
        })
      }
      saved++
    } catch { /* duplicate or error, skip */ }
  }

  console.log(`[auto-mine] Saved ${saved}/${offers.length} offers for "${keyword}"`)
  return NextResponse.json({ saved, total: offers.length })
}
