import { NextRequest, NextResponse } from 'next/server'
import { dbGetUserById } from '@/lib/db'

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ user: null })
  const user = await dbGetUserById(Number(userId))
  if (!user) return NextResponse.json({ user: null })
  return NextResponse.json({ user: { nome: user.name, email: user.email } })
}
