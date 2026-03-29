import { SignJWT, jwtVerify } from 'jose'

const ADMIN_SECRET = new TextEncoder().encode(
  process.env.ADMIN_SECRET || 'admin-fallback-change-in-prod'
)

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(ADMIN_SECRET)
}

export async function verifyAdminToken(token: string) {
  return jwtVerify(token, ADMIN_SECRET)
}
