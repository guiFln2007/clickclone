import { NextRequest, NextResponse } from 'next/server'
import db, { initDb } from '@/lib/db'

// POST /api/presence — heartbeat (register/update presence)
// Body: { uid: string, product: string }
export async function POST(req: NextRequest) {
  await initDb()
  try {
    const { uid, product } = await req.json() as { uid?: string; product?: string }
    if (!uid || !product) return NextResponse.json({ error: 'uid and product required' }, { status: 400 })

    await db.execute({
      sql: 'INSERT OR REPLACE INTO presence (uid, product, last_seen) VALUES (?, ?, ?)',
      args: [uid, product, Date.now()],
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

// GET /api/presence?product=oab500 — count online (active in last 90s)
export async function GET(req: NextRequest) {
  await initDb()
  const product = req.nextUrl.searchParams.get('product')
  if (!product) return NextResponse.json({ error: 'product required' }, { status: 400 })

  const cutoff = Date.now() - 90000 // 90 seconds

  // Cleanup old entries
  await db.execute({ sql: 'DELETE FROM presence WHERE last_seen < ?', args: [cutoff - 300000] })

  // Count active
  const res = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM presence WHERE product = ? AND last_seen > ?',
    args: [product, cutoff],
  })

  const count = (res.rows[0] as Record<string, unknown>)?.count as number ?? 0

  // CORS headers for external sites
  return new NextResponse(JSON.stringify({ online: count }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
