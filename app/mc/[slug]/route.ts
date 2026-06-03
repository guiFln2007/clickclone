import { NextRequest, NextResponse } from 'next/server'
import { dbLogMcClick } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Log click in background (don't block redirect)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || ''
  const ua = request.headers.get('user-agent') || ''
  dbLogMcClick(slug, ip, ua).catch(() => {})

  const url = new URL('https://ratoads.com.br/')
  url.searchParams.set('utm_source', 'manychat')
  url.searchParams.set('utm_medium', 'instagram_dm')
  url.searchParams.set('utm_campaign', 'ratoads')
  url.searchParams.set('utm_content', 'reels')
  url.searchParams.set('utm_term', slug)

  const res = NextResponse.redirect(url, 302)
  res.cookies.set('mc_slug', slug, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
    httpOnly: false,
    sameSite: 'lax',
  })
  return res
}
