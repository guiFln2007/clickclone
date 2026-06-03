import { cookies } from 'next/headers'
import { dbGetMcStats } from '@/lib/db'

export async function GET() {
  const c = await cookies()
  if (!c.get('cc_admin')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const stats = await dbGetMcStats()
  return Response.json(stats)
}
