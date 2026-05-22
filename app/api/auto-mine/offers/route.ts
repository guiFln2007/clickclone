import { NextRequest, NextResponse } from 'next/server'
import { dbGetMinedOffers } from '@/lib/db'

const SECRET = process.env.SCRAPER_SECRET || ''

export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token || token !== SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { offers } = await dbGetMinedOffers({ limit: 200 })
  return NextResponse.json({
    offers: offers.map(o => ({
      page_id: o.page_id,
      page_name: o.page_name,
      ad_count: o.ad_count,
      landing_url: o.landing_url,
      dias_rodando: o.dias_rodando,
      fb_followers: o.fb_followers,
      ig_followers: o.ig_followers,
    }))
  })
}
