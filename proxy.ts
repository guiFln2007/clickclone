import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET env var is required')
  return new TextEncoder().encode(s)
}

function getAdminSecret(): Uint8Array {
  const s = process.env.ADMIN_SECRET
  if (!s) throw new Error('ADMIN_SECRET env var is required')
  return new TextEncoder().encode(s)
}

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/webhook', '/_next', '/favicon']

// Rotas de API que permitem uso sem auth (plano gratuito por IP/sessão)
const FREE_API_PATHS = ['/api/analyze', '/api/edit']

// Security headers applied to all responses
function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Admin login sempre público (página e API)
  if (pathname === '/admin/login' || pathname === '/api/admin/login') return addSecurityHeaders(NextResponse.next())

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
      await jwtVerify(adminToken, getAdminSecret())
      return addSecurityHeaders(NextResponse.next())
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
    return addSecurityHeaders(NextResponse.next())
  }

  const token =
    req.cookies.get('cc_token')?.value ||
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    // APIs com plano gratuito → passa sem header x-user-id (rota trata internamente)
    if (FREE_API_PATHS.some((p) => pathname.startsWith(p))) {
      return addSecurityHeaders(NextResponse.next())
    }
    // Outras APIs → 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    // Páginas → redireciona para login
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, getSecret())
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', String(payload.sub))
    requestHeaders.set('x-user-email', String(payload.email || ''))

    return addSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }))
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
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/analyze/:path*',
    '/api/edit/:path*',
    '/api/phase1/:path*',
    '/api/phase2/:path*',
    '/api/mine/:path*',
    '/api/radar/:path*',
    '/api/demo-scan/:path*',
    '/api/projects/:path*',
  ],
}
