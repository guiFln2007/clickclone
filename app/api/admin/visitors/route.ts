import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-jwt'
import { dbGetActiveVisitors, dbGetVisitorStats, dbCleanOldVisitors } from '@/lib/db'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('cc_admin')?.value
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try { await verifyAdminToken(token) } catch { return NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }

  await dbCleanOldVisitors()

  const [visitors, stats] = await Promise.all([
    dbGetActiveVisitors(2),
    dbGetVisitorStats(),
  ])

  return NextResponse.json({ visitors, stats })
}
