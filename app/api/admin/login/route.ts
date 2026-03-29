import { NextRequest, NextResponse } from 'next/server'
import { signAdminToken } from '@/lib/admin-jwt'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const adminSecret = process.env.ADMIN_SECRET
if (!adminSecret || password !== adminSecret) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }
  const token = await signAdminToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set('cc_admin', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 12,
    path: '/',
  })
  return res
}
