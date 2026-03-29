import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'clickclone-secret-change-in-prod'
)

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/webhook', '/_next', '/favicon']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (pathname === '/' || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token =
    req.cookies.get('cc_token')?.value ||
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', String(payload.sub))
    requestHeaders.set('x-user-email', String(payload.email))

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete('cc_token')
    return res
  }
}

export const config = {
  matcher: ['/tool/:path*', '/api/analyze/:path*', '/api/edit/:path*'],
}
