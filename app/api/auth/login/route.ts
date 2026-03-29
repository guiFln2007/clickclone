import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { dbGetUserByEmail, dbSetHash } from '@/lib/db'
import { signToken } from '@/lib/jwt'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return Response.json({ error: 'Email e senha obrigatórios' }, { status: 400 })
    }

    const user = await dbGetUserByEmail(email.toLowerCase().trim())

    if (!user) {
      return Response.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (!user.ativo) {
      return Response.json({ error: 'Conta inativa. Entre em contato com o suporte.' }, { status: 403 })
    }

    // First login — no hash yet → set password
    if (!user.hash) {
      const hash = await bcrypt.hash(password, 10)
      await dbSetHash(email, hash)
    } else {
      const ok = await bcrypt.compare(password, user.hash)
      if (!ok) {
        return Response.json({ error: 'Senha incorreta' }, { status: 401 })
      }
    }

    const token = signToken({ sub: user.id, email: user.email })

    const res = Response.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, plano: user.plano },
    })

    // Set httpOnly cookie (30 days)
    const headers = new Headers(res.headers)
    headers.set(
      'Set-Cookie',
      `cc_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
    )

    return new Response(res.body, { status: 200, headers })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
