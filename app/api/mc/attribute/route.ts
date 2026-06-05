import { NextRequest } from 'next/server'
import { dbSaveMcPending } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { mc_slug, email } = await req.json()
    if (!mc_slug || typeof mc_slug !== 'string') {
      return Response.json({ error: 'mc_slug required' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || ''
    const sanitizedSlug = mc_slug.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50)
    const sanitizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : undefined

    await dbSaveMcPending(ip, sanitizedSlug, sanitizedEmail)

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[mc/attribute]', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
