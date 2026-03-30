import { NextRequest } from 'next/server'
import { dbDeleteCachedAnalysis } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[/api/projects/delete] body recebido:', JSON.stringify(body))
    const { pageId } = body
    console.log('[/api/projects/delete] pageId extraído:', JSON.stringify(pageId), '| tipo:', typeof pageId)
    if (!pageId || typeof pageId !== 'string') {
      console.log('[/api/projects/delete] pageId inválido — retornando 400')
      return Response.json({ error: 'pageId obrigatório' }, { status: 400 })
    }
    await dbDeleteCachedAnalysis(pageId)
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[/api/projects/delete] erro:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
