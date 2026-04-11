import { NextRequest, NextResponse } from 'next/server'
import { dbAdminGetStats } from '@/lib/db'
import { verifyAdminToken } from '@/lib/admin-jwt'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 })
  try { await verifyAdminToken(token) } catch { return NextResponse.json({ error: 'N\u00e3o autorizado' }, { status: 401 }) }

  const stats = await dbAdminGetStats()
  return NextResponse.json(stats)
}
