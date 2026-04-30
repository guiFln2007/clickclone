import { NextRequest, NextResponse } from 'next/server'
import { dbUpsertVisitor, dbLogPageView } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, page, referrer, utm_source, utm_medium, utm_campaign, user_id, email } = body

    if (!session_id || !page) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
    const ua = req.headers.get('user-agent') || ''

    // Detect device type from user agent
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua)
    const device = isMobile ? 'mobile' : 'desktop'

    const prevPage = body._prevPage as string | undefined

    await dbUpsertVisitor({
      session_id,
      user_id: user_id || null,
      email: email || null,
      page,
      referrer: referrer || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      ip,
      user_agent: ua,
      device,
    })

    // Log page view only on page change
    if (!prevPage || prevPage !== page) {
      await dbLogPageView(session_id, user_id || null, page)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
