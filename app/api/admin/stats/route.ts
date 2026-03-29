import { NextResponse } from 'next/server'
import { dbAdminGetStats } from '@/lib/db'

export async function GET() {
  const stats = await dbAdminGetStats()
  return NextResponse.json(stats)
}
