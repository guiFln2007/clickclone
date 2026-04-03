import { NextRequest, NextResponse } from 'next/server'
import { dbGetActiveTrackedOffers, dbUpdateTrackedOffer, dbCreateOfferAlert } from '@/lib/db'
import crypto from 'crypto'

export const maxDuration = 300

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''

async function getAdsCount(pageName: string): Promise<number> {
  if (!SCRAPER_URL) return -1
  try {
    const res = await fetch(`${SCRAPER_URL}/count-ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
      body: JSON.stringify({ pageName }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) return -1
    const data = await res.json() as { count: number }
    return data.count
  } catch {
    return -1
  }
}

async function getPageHash(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!res.ok) return null
    let html = await res.text()
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    html = html.replace(/\d{10,13}/g, '')
    return crypto.createHash('sha256').update(html).digest('hex')
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ofertas = await dbGetActiveTrackedOffers()
  let verificadas = 0
  let alertasCriados = 0

  for (const oferta of ofertas) {
    try {
      const adsCount = await getAdsCount(oferta.pagina_nome)
      const landingHash = oferta.landing_url ? await getPageHash(oferta.landing_url) : null

      const anterior = oferta.ultimo_snapshot_ads ?? oferta.primeiro_snapshot_ads ?? 0
      const alertas: { tipo: string; mensagem: string }[] = []

      if (adsCount >= 0) {
        const diff = adsCount - anterior
        if (adsCount === 0 && anterior > 0) {
          alertas.push({ tipo: 'morreu', mensagem: `${oferta.pagina_nome} parou de rodar - 0 anuncios ativos` })
        } else if (diff >= 10) {
          alertas.push({ tipo: 'escalou', mensagem: `${oferta.pagina_nome} adicionou ${diff} novos anuncios` })
        } else if (diff <= -10) {
          alertas.push({ tipo: 'queda', mensagem: `${oferta.pagina_nome} removeu ${Math.abs(diff)} anuncios` })
        }
      }

      if (landingHash && oferta.landing_hash && landingHash !== oferta.landing_hash) {
        alertas.push({ tipo: 'pagina_mudou', mensagem: `${oferta.pagina_nome} alterou a pagina de destino` })
      }

      for (const alerta of alertas) {
        await dbCreateOfferAlert({
          id: crypto.randomUUID(),
          tracked_offer_id: oferta.id,
          tipo: alerta.tipo,
          mensagem: alerta.mensagem,
          dados_anteriores: JSON.stringify({ ads: anterior, hash: oferta.landing_hash }),
          dados_novos: JSON.stringify({ ads: adsCount, hash: landingHash }),
        })
        alertasCriados++
      }

      const newStatus = adsCount === 0 && anterior > 0 ? 'morta'
        : adsCount >= 0 && adsCount - anterior >= 10 ? 'escalando'
        : adsCount >= 0 && anterior - adsCount >= 10 ? 'caindo'
        : oferta.status

      await dbUpdateTrackedOffer(oferta.id, {
        ultimo_snapshot_ads: adsCount >= 0 ? adsCount : undefined,
        landing_hash: landingHash ?? undefined,
        status: newStatus,
        alertas_nao_lidos: oferta.alertas_nao_lidos + alertas.length,
      })

      verificadas++
    } catch (err) {
      console.error(`[Cron] Erro ao verificar oferta ${oferta.id}:`, err)
      continue
    }
  }

  return NextResponse.json({ verificadas, alertasCriados, total: ofertas.length })
}
