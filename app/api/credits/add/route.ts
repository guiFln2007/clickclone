import { NextRequest } from 'next/server'
import { dbAddAnalises, dbAddMineracoes, dbGetUserByEmail } from '@/lib/db'
import { verifyToken } from '@/lib/jwt'

const VALID_TYPES = ['analises', 'mineracoes'] as const
const VALID_QTYS = [5, 10, 20] as const

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('cc_token')?.value
    if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload?.email) return Response.json({ error: 'Token inválido' }, { status: 401 })

    const { type, qty } = await req.json()

    if (!VALID_TYPES.includes(type)) {
      return Response.json({ error: 'Tipo inválido (analises ou mineracoes)' }, { status: 400 })
    }
    if (!VALID_QTYS.includes(qty)) {
      return Response.json({ error: 'Quantidade inválida (5, 10 ou 20)' }, { status: 400 })
    }

    const user = await dbGetUserByEmail(payload.email)
    if (!user || !user.ativo) {
      return Response.json({ error: 'Usuário inativo' }, { status: 403 })
    }

    if (type === 'analises') {
      await dbAddAnalises(payload.email, qty)
    } else {
      await dbAddMineracoes(payload.email, qty)
    }

    return Response.json({
      ok: true,
      type,
      qty,
      new_total: type === 'analises' ? user.analises + qty : user.mineracoes + qty,
    })
  } catch (err) {
    console.error('[credits/add]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
