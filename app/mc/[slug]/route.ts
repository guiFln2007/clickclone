import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const url = new URL('/', request.url)
  url.searchParams.set('utm_source', 'manychat')
  url.searchParams.set('utm_medium', 'instagram_dm')
  url.searchParams.set('utm_campaign', 'ratoads')
  url.searchParams.set('utm_content', 'reels')
  url.searchParams.set('utm_term', slug)

  return NextResponse.redirect(url, 302)
}
