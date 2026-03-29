import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'clickclone-secret-change-in-prod'
)

const ADMIN_SECRET = new TextEncoder().encode(
  process.env.ADMIN_SECRET || 'admin-fallback-change-in-prod'
)

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/webhook', '/_next', '/favicon']

// Rotas de API que permitem uso sem auth (plano gratuito por IP/sessão)
const FREE_API_PATHS = ['/api/analyze', '/api/edit']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Admin login sempre público (página e API)
  if (pathname === '/admin/login' || pathname === '/api/admin/login') return NextResponse.next()

  // Proteção das rotas /admin e /api/admin
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const adminToken = req.cookies.get('cc_admin')?.value
    if (!adminToken) {
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
    try {
      await jwtVerify(adminToken, ADMIN_SECRET)
      return NextResponse.next()
    } catch {
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
      }
      const res = NextResponse.redirect(new URL('/admin/login', req.url))
      res.cookies.delete('cc_admin')
      return res
    }
  }

  // Rotas sempre públicas
  if (pathname === '/' || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token =
    req.cookies.get('cc_token')?.value ||
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    // APIs com plano gratuito → passa sem header x-user-id (rota trata internamente)
    if (FREE_API_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.next()
    }
    // Outras APIs → 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    // Páginas → redireciona para login
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', String(payload.sub))
    requestHeaders.set('x-user-email', String(payload.email || ''))

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
  matcher: [
    '/tool/:path*',
    '/settings/:path*',
    '/api/analyze/:path*',
    '/api/edit/:path*',
    '/admin/:path*',
    '/api/admin/:path*',
  ],
}
