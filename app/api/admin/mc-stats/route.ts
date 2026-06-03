import { cookies } from 'next/headers'
import { dbGetMcStats, dbGetMcSales } from '@/lib/db'

export async function GET() {
  const c = await cookies()
  if (!c.get('cc_admin')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [clicks, sales] = await Promise.all([dbGetMcStats(), dbGetMcSales()])
  return Response.json({ ...clicks, sales })
}
