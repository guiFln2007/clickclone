import jwt from 'jsonwebtoken'

const SECRET: string = process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET env var is required') })()

export type JwtPayload = {
  sub: number   // user id
  email: string
  iat?: number
  exp?: number
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as unknown as JwtPayload
  } catch {
    return null
  }
}
