import { NextRequest, NextResponse } from 'next/server'
import { dbGetActiveTrackedOffers, dbUpdateTrackedOffer, dbCreateOfferAlert } from '@/lib/db'
import crypto from 'crypto'

export const maxDuration = 300

async function getAdsCount(adLibraryUrl: string): Promise<number> {
  const token = process.env.APIFY_TOKEN
  if (!token) return -1

  // Extract page_id from URL
  const match = adLibraryUrl.match(/view_all_page_id=(\d+)/)
  if (!match) return -1

  try {
    const runUrl = `https://api.apify.com/v2/acts/apify~facebook-ads-scraper/runs?token=${token}`
    const res = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: adLibraryUrl }],
        maxItems: 1,
        activeStatus: 'active',
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) return -1
    const run = await res.json()
    const datasetId = run?.data?.defaultDatasetId
    if (!datasetId) return -1

    // Wait for run to finish (poll)
    let attempts = 0
    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 2000))
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${run.data.id}?token=${token}`)
      const statusData = await statusRes.json()
      if (statusData?.data?.status === 'SUCCEEDED') break
      if (statusData?.data?.status === 'FAILED') return -1
      attempts++
    }

    const countRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=1`)
    const items = await countRes.json()
    // The scraper returns total in the dataset stats
    const statsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}?token=${token}`)
    const stats = await statsRes.json()
    return stats?.data?.itemCount ?? items.length
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
    // Remove dynamic timestamps/scripts to reduce false positives
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
      const adsCount = await getAdsCount(oferta.ad_library_url)
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

      // Save alerts
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

      // Update offer
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
