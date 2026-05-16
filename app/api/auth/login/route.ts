import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbGetUserByEmail, dbSetHash } from '@/lib/db'
import { signToken } from '@/lib/jwt'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return Response.json({ error: 'Email e senha obrigat\u00f3rios' }, { status: 400 })
    }

    const user = await dbGetUserByEmail(email.toLowerCase().trim())

    // Generic error to prevent user enumeration
    if (!user || !user.ativo) {
      return Response.json({ error: 'Email ou senha incorretos' }, { status: 401 })
    }

    // First login — set password from webhook-generated temp password
    if (!user.hash) {
      const hash = await bcrypt.hash(password, 10)
      await dbSetHash(email, hash)
    } else {
      const ok = await bcrypt.compare(password, user.hash)
      if (!ok) {
        return Response.json({ error: 'Email ou senha incorretos' }, { status: 401 })
      }
    }

    const token = signToken({ sub: user.id, email: user.email })

    const res = Response.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, plano: user.plano },
    })

    // Set httpOnly cookie (7 days, matching JWT expiry)
    const headers = new Headers(res.headers)
    headers.set(
      'Set-Cookie',
      `cc_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    )

    return new Response(res.body, { status: 200, headers })
  } catch (err) {
    console.error('[Login] Error:', err)
    return Response.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}
