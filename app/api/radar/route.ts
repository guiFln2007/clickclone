import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById, dbCreateTrackedOffer, dbGetTrackedOffers, dbDeleteTrackedOffer, dbCreateSnapshot } from '@/lib/db'

export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const user = await dbGetUserById(userId)
  if (!user || !user.ativo) return NextResponse.json({ error: 'Conta inativa' }, { status: 403 })

  const offers = await dbGetTrackedOffers(userId)
  return NextResponse.json({ offers })
}

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const user = await dbGetUserById(userId)
  if (!user || !user.ativo) return NextResponse.json({ error: 'Conta inativa' }, { status: 403 })

  const body = await req.json()
  const { pagina_nome, ad_library_url, landing_url, nicho, snapshot_ads, snapshot_data, page_id: bodyPageId } = body

  if (!pagina_nome || !ad_library_url) {
    return NextResponse.json({ error: 'pagina_nome e ad_library_url sao obrigatorios' }, { status: 400 })
  }

  // Checa limite de slots do radar
  const existing = await dbGetTrackedOffers(userId)
  const maxSlots = user.max_slots_radar ?? 5
  if (existing.length >= maxSlots) {
    return NextResponse.json({ error: `Limite de ${maxSlots} ofertas no radar atingido. Adquirir Vers\u00e3o Completa.` }, { status: 402 })
  }

  // Extract numeric page_id from URL (only count numeric IDs as real page_ids for matching)
  const extractRealPageId = (url: string): string | null => {
    try { const v = new URL(url).searchParams.get('view_all_page_id'); return v && /^\d+$/.test(v) ? v : null } catch { return null }
  }
  const realPageId = (bodyPageId && /^\d+$/.test(bodyPageId)) ? bodyPageId : extractRealPageId(ad_library_url)
  const dup = existing.find(o => {
    if (realPageId && o.page_id === realPageId) return true
    if (realPageId && extractRealPageId(o.ad_library_url) === realPageId) return true
    if (o.ad_library_url === ad_library_url) return true
    if (o.pagina_nome === pagina_nome) return true
    return false
  })
  if (dup) {
    return NextResponse.json({ id: dup.id, message: 'Oferta ja existe no radar', duplicate: true })
  }

  const id = crypto.randomUUID()
  await dbCreateTrackedOffer({
    id,
    user_id: userId,
    pagina_nome,
    page_id: realPageId ?? undefined,
    ad_library_url,
    landing_url,
    nicho,
    primeiro_snapshot_ads: snapshot_ads,
    primeiro_snapshot_data: snapshot_data ? JSON.stringify(snapshot_data) : undefined,
  })

  // Create initial snapshot if we have ads count
  if (snapshot_ads && snapshot_ads > 0) {
    await dbCreateSnapshot({
      id: crypto.randomUUID(),
      tracked_offer_id: id,
      ads_count: snapshot_ads,
      variacao: 0,
      variacao_percent: 0,
    })
  }

  return NextResponse.json({ id, message: 'Oferta salva no radar' })
}

export async function DELETE(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'))
  if (!userId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })

  const ok = await dbDeleteTrackedOffer(id, userId)
  if (!ok) return NextResponse.json({ error: 'Oferta nao encontrada' }, { status: 404 })

  return NextResponse.json({ message: 'Removida do radar' })
}
