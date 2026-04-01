import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById, dbCreateTrackedOffer, dbGetTrackedOffers, dbDeleteTrackedOffer } from '@/lib/db'

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
  const { pagina_nome, ad_library_url, landing_url, nicho, snapshot_ads, snapshot_data } = body

  if (!pagina_nome || !ad_library_url) {
    return NextResponse.json({ error: 'pagina_nome e ad_library_url sao obrigatorios' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  await dbCreateTrackedOffer({
    id,
    user_id: userId,
    pagina_nome,
    ad_library_url,
    landing_url,
    nicho,
    primeiro_snapshot_ads: snapshot_ads,
    primeiro_snapshot_data: snapshot_data ? JSON.stringify(snapshot_data) : undefined,
  })

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
