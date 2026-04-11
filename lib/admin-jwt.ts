import { SignJWT, jwtVerify } from 'jose'

const ADMIN_SECRET = new TextEncoder().encode(
  process.env.ADMIN_SECRET || (() => { throw new Error('ADMIN_SECRET env var is required') })()
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
